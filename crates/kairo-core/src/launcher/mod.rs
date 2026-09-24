use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use chrono::Utc;
use thiserror::Error;

use crate::db::{Database, DbError};
use crate::models::{Emulator, Game, GameConfig, LaunchStatus, System};
use crate::paths::AppPaths;

#[derive(Error, Debug)]
pub enum LauncherError {
    #[error("Erreur de base de données: {0}")]
    Db(#[from] DbError),
    #[error("Émulateur non configuré ou introuvable: {0}")]
    EmulatorNotFound(String),
    #[error("Exécutable introuvable au chemin: {0}")]
    ExecutableNotFound(String),
    #[error("Fichier ROM/Jeu introuvable: {0}")]
    RomNotFound(String),
    #[error("Un jeu est déjà en cours d'exécution (PID: {0})")]
    AlreadyRunning(u32),
    #[error("Erreur système d'exécution (I/O): {0}")]
    Io(#[from] std::io::Error),
    #[error("Erreur de formatage des arguments CLI: {0}")]
    ArgFormat(String),
}

#[derive(Clone)]
pub struct Launcher {
    db: Database,
    status: Arc<RwLock<LaunchStatus>>,
    current_child: Arc<Mutex<Option<Child>>>,
}

impl Launcher {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            status: Arc::new(RwLock::new(LaunchStatus::default())),
            current_child: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_status(&self) -> LaunchStatus {
        let status = self.status.read().unwrap();
        let mut copy = status.clone();

        if copy.is_running {
            if let Some(start) = copy.start_time {
                let elapsed = Utc::now().signed_duration_since(start).num_seconds();
                if elapsed >= 0 {
                    copy.elapsed_seconds = Some(elapsed as u64);
                }
            }
        }

        copy
    }

    pub fn resolve_emulator_exe(
        emulator_id: &str,
        configured_path: Option<&str>,
    ) -> Result<PathBuf, LauncherError> {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));

        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

        // 1. Si un chemin est explicitement configuré et existe
        if let Some(p_str) = configured_path {
            if !p_str.trim().is_empty() {
                let p = PathBuf::from(p_str);
                if p.exists() {
                    return Ok(p);
                }
                let relative_to_current = current_dir.join(&p);
                if relative_to_current.exists() {
                    return Ok(relative_to_current);
                }
                let relative_to_exe = exe_dir.join(&p);
                if relative_to_exe.exists() {
                    return Ok(relative_to_exe);
                }
            }
        }

        let emu_dirs = AppPaths::get_emulator_search_dirs();

        // 2. Détection automatique selon le nom de l'émulateur dans tous les dossiers de recherche
        let mut candidates: Vec<PathBuf> = Vec::new();
        for dir in &emu_dirs {
            match emulator_id {
                "retroarch" => {
                    candidates.push(dir.join("RetroArch/retroarch.exe"));
                    candidates.push(dir.join("retroarch/retroarch.exe"));
                    candidates.push(dir.join("retroarch.exe"));
                }
                "pcsx2" => {
                    candidates.push(dir.join("PCSX2/pcsx2-qt.exe"));
                    candidates.push(dir.join("PCSX2/pcsx2.exe"));
                    candidates.push(dir.join("pcsx2-qt.exe"));
                }
                "dolphin" => {
                    candidates.push(dir.join("Dolphin/Dolphin.exe"));
                    candidates.push(dir.join("dolphin/Dolphin.exe"));
                    candidates.push(dir.join("Dolphin.exe"));
                }
                "ryujinx" => {
                    candidates.push(dir.join("Ryujinx/Ryujinx.exe"));
                    candidates.push(dir.join("Ryujinx/Ryubing.exe"));
                    candidates.push(dir.join("Ryujinx.exe"));
                }
                "rpcs3" => {
                    candidates.push(dir.join("RPCS3/rpcs3.exe"));
                    candidates.push(dir.join("rpcs3.exe"));
                }
                _ => {}
            }
        }

        for candidate in candidates {
            if candidate.exists() {
                return Ok(candidate);
            }
        }

        Err(LauncherError::ExecutableNotFound(format!(
            "Émulateur '{}' introuvable (vérifiez que le dossier emulators/ contient l'exécutable)",
            emulator_id
        )))
    }

    pub fn build_command(
        &self,
        game: &Game,
        system: &System,
        emulator: &Emulator,
        config: Option<&GameConfig>,
    ) -> Result<Command, LauncherError> {
        // Résoudre le chemin de la ROM : absolu, ou relatif à exe_dir / data_dir / current_dir
        let rom_path_raw = Path::new(&game.file_path);
        let rom_path: std::borrow::Cow<Path> = if rom_path_raw.is_absolute() {
            std::borrow::Cow::Borrowed(rom_path_raw)
        } else {
            let exe_dir = AppPaths::get_exe_dir();
            let candidate_exe = exe_dir.join(rom_path_raw);
            if candidate_exe.exists() {
                std::borrow::Cow::Owned(candidate_exe)
            } else {
                let candidate_data = AppPaths::get_data_dir().join(rom_path_raw);
                if candidate_data.exists() {
                    std::borrow::Cow::Owned(candidate_data)
                } else {
                    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                    let candidate_cwd = current_dir.join(rom_path_raw);
                    if candidate_cwd.exists() {
                        std::borrow::Cow::Owned(candidate_cwd)
                    } else {
                        std::borrow::Cow::Borrowed(rom_path_raw)
                    }
                }
            }
        };

        if !rom_path.exists() {
            return Err(LauncherError::RomNotFound(game.file_path.clone()));
        }

        let is_native = emulator.id == "native" || system.id == "windows";

        let (exe_path_buf, args_template) = if is_native {
            let exe = PathBuf::from(&game.file_path);
            let args = config
                .and_then(|c| c.custom_cli_args.clone())
                .unwrap_or_default();
            (exe, args)
        } else {
            let exe = Self::resolve_emulator_exe(&emulator.id, emulator.exe_path.as_deref())?;
            let args = config
                .and_then(|c| c.custom_cli_args.clone())
                .unwrap_or_else(|| emulator.default_args.clone());
            (exe, args)
        };

        // Canonicaliser l'exécutable pour garantir un chemin absolu propre sans préfixe \\?\
        let clean_exe_path = if let Ok(canonical) = std::fs::canonicalize(&exe_path_buf) {
            let s = canonical.to_string_lossy().to_string();
            PathBuf::from(s.strip_prefix(r"\\?\").unwrap_or(&s))
        } else {
            exe_path_buf
        };

        let mut cmd = Command::new(&clean_exe_path);

        if is_native {
            if let Some(parent) = rom_path.parent() {
                cmd.current_dir(parent);
            }
        } else if let Some(parent) = clean_exe_path.parent() {
            cmd.current_dir(parent);
        }

        // Résolution du core RetroArch
        let core_name = config
            .and_then(|c| c.custom_core.clone())
            .or_else(|| system.default_core.clone())
            .unwrap_or_default();

        let core_path = if !core_name.is_empty() {
            let mut resolved = core_name.clone();
            if let Some(emu_parent) = clean_exe_path.parent() {
                let candidate1 = emu_parent.join("cores").join(&core_name);
                let candidate2 = emu_parent.join(&core_name);
                if candidate1.exists() {
                    let s = std::fs::canonicalize(&candidate1)
                        .map(|c| c.to_string_lossy().to_string())
                        .unwrap_or_else(|_| candidate1.to_string_lossy().to_string());
                    resolved = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
                } else if candidate2.exists() {
                    let s = std::fs::canonicalize(&candidate2)
                        .map(|c| c.to_string_lossy().to_string())
                        .unwrap_or_else(|_| candidate2.to_string_lossy().to_string());
                    resolved = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
                } else {
                    for search_dir in AppPaths::get_emulator_search_dirs() {
                        let c3 = search_dir.join("cores").join(&core_name);
                        if c3.exists() {
                            let s = std::fs::canonicalize(&c3)
                                .map(|c| c.to_string_lossy().to_string())
                                .unwrap_or_else(|_| c3.to_string_lossy().to_string());
                            resolved = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
                            break;
                        }
                        let c4 = search_dir.join(&core_name);
                        if c4.exists() {
                            let s = std::fs::canonicalize(&c4)
                                .map(|c| c.to_string_lossy().to_string())
                                .unwrap_or_else(|_| c4.to_string_lossy().to_string());
                            resolved = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
                            break;
                        }
                    }
                }
            }
            resolved
        } else {
            String::new()
        };

        // Formater le chemin de la ROM en chemin propre (sans préfixe UNC \\?\ si Windows)
        let clean_rom_path = if let Ok(canonical) = std::fs::canonicalize(rom_path) {
            let s = canonical.to_string_lossy().to_string();
            if let Some(stripped) = s.strip_prefix(r"\\?\") {
                stripped.to_string()
            } else {
                s
            }
        } else {
            game.file_path.clone()
        };

        let processed_args = Self::format_cli_arguments(
            &args_template,
            &clean_rom_path,
            &game.title,
            &core_path,
        );

        let parsed_tokens = Self::tokenize_arguments(&processed_args);
        for arg in parsed_tokens {
            cmd.arg(arg);
        }

        // 4. Injection dynamique des paramètres avancés type RetroBat
        let app_settings = self.db.get_app_settings().unwrap_or_default();
        let is_retroarch = emulator.id.to_lowercase() == "retroarch";

        if is_retroarch {
            // Configuration manettes prioritaire (dissociation P1/P2 & boutons d'arcade)
            if let Some(emu_dir) = clean_exe_path.parent() {
                let local_cfg = emu_dir.join("kairo_gamepads.cfg");
                if local_cfg.exists() {
                    let s = local_cfg
                        .canonicalize()
                        .map(|c| c.to_string_lossy().to_string())
                        .unwrap_or_else(|_| local_cfg.to_string_lossy().to_string());
                    let clean = s.strip_prefix(r"\\?\").unwrap_or(&s);
                    cmd.arg(format!("--appendconfig={}", clean));
                } else if let Ok(abs_cfg) = std::fs::canonicalize("emulators/RetroArch/kairo_gamepads.cfg") {
                    let s = abs_cfg.to_string_lossy().to_string();
                    let clean = s.strip_prefix(r"\\?\").unwrap_or(&s);
                    cmd.arg(format!("--appendconfig={}", clean));
                }
            }

            // Shaders
            let chosen_shader = config
                .and_then(|c| c.shader.clone())
                .or_else(|| app_settings.retroarch_shader.clone())
                .unwrap_or_else(|| "none".into());
            match chosen_shader.as_str() {
                "scanlines_light" => {
                    cmd.arg("--set-shader").arg("shaders/shaders_glsl/scanline.glslp");
                }
                "scanlines_strong" => {
                    cmd.arg("--set-shader").arg("shaders/shaders_glsl/scanline-strong.glslp");
                }
                "crt_curved" => {
                    cmd.arg("--set-shader").arg("shaders/shaders_glsl/crt-easymode.glslp");
                }
                "none" => {
                    cmd.arg("--set-shader").arg("none");
                }
                custom if !custom.is_empty() => {
                    cmd.arg("--set-shader").arg(custom);
                }
                _ => {}
            }

            // Mode plein écran forcé
            let fullscreen_mode = config
                .and_then(|c| c.forced_fullscreen.clone())
                .or_else(|| app_settings.forced_fullscreen.clone())
                .unwrap_or_else(|| "per_game".into());
            if fullscreen_mode == "always" {
                cmd.arg("-F");
            }

            // Dossier de sauvegardes custom
            if let Some(ref saves) = app_settings.saves_dir {
                if !saves.trim().is_empty() && Path::new(saves).exists() {
                    cmd.arg("-s").arg(saves);
                }
            }
        }

        cmd.stdin(Stdio::null());
        Ok(cmd)
    }


    pub fn launch_game_by_id(&self, game_id: &str) -> Result<LaunchStatus, LauncherError> {
        {
            let status = self.status.read().unwrap();
            if status.is_running {
                if let Some(pid) = status.pid {
                    if status.current_game_id.as_deref() == Some(game_id) {
                        return Ok(status.clone());
                    }
                    return Err(LauncherError::AlreadyRunning(pid));
                }
            }
        }

        let game = self
            .db
            .get_game_by_id(game_id)?
            .ok_or_else(|| LauncherError::RomNotFound(format!("Jeu ID {}", game_id)))?;

        let system = self
            .db
            .get_system_by_id(&game.system_id)?
            .ok_or_else(|| LauncherError::EmulatorNotFound(format!("Système {}", game.system_id)))?;

        let config = self.db.get_game_config(game_id)?;

        let emulator_id = config
            .as_ref()
            .and_then(|c| c.emulator_id_override.as_ref())
            .unwrap_or(&system.default_emulator_id);

        let emulator = self
            .db
            .get_emulator_by_id(emulator_id)?
            .ok_or_else(|| LauncherError::EmulatorNotFound(emulator_id.clone()))?;

        let mut cmd = self.build_command(&game, &system, &emulator, config.as_ref())?;

        let start_time = Utc::now();
        let child = cmd.spawn()?;
        let pid = child.id();

        {
            let mut status = self.status.write().unwrap();
            status.is_running = true;
            status.current_game_id = Some(game.id.clone());
            status.current_game_title = Some(game.title.clone());
            status.current_system_id = Some(system.id.clone());
            status.pid = Some(pid);
            status.start_time = Some(start_time);
            status.elapsed_seconds = Some(0);
        }

        let status_arc = Arc::clone(&self.status);
        let current_child_arc = Arc::clone(&self.current_child);
        let db_clone = self.db.clone();
        let game_id_owned = game.id.clone();

        {
            let mut current = current_child_arc.lock().unwrap();
            *current = Some(child);
        }

        thread::spawn(move || {
            loop {
                // 1. Détection du combo Arcade Coin + 1P Start (clavier / encodeurs USB arcade)
                #[cfg(windows)]
                {
                    unsafe {
                        use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
                        // Coin : touche '5' (0x35) ou 'c'/'C' (0x43)
                        let coin_pressed = (GetAsyncKeyState(0x35) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(0x43) as u16 & 0x8000 != 0);
                        // 1P Start : touche '1' (0x31) ou Entrée (0x0D)
                        let start_pressed = (GetAsyncKeyState(0x31) as u16 & 0x8000 != 0)
                            || (GetAsyncKeyState(0x0D) as u16 & 0x8000 != 0);

                        if coin_pressed && start_pressed {
                            let mut guard = current_child_arc.lock().unwrap();
                            if let Some(child) = guard.as_mut() {
                                let _ = child.kill();
                            }
                            break;
                        }
                    }
                }

                // 2. Vérifier si le processus s'est arrêté de lui-même
                let has_exited = {
                    let mut guard = current_child_arc.lock().unwrap();
                    if let Some(child) = guard.as_mut() {
                        match child.try_wait() {
                            Ok(Some(_)) => true,
                            Ok(None) => false,
                            Err(_) => true,
                        }
                    } else {
                        true
                    }
                };

                if has_exited {
                    break;
                }

                thread::sleep(std::time::Duration::from_millis(100));
            }

            {
                let mut guard = current_child_arc.lock().unwrap();
                let _ = guard.take();
            }

            let end_time = Utc::now();
            let duration = end_time.signed_duration_since(start_time).num_seconds().max(0) as u64;

            let _ = db_clone.record_play_session(&game_id_owned, duration, start_time, end_time);

            {
                let mut status = status_arc.write().unwrap();
                status.is_running = false;
                status.current_game_id = None;
                status.current_game_title = None;
                status.current_system_id = None;
                status.pid = None;
                status.start_time = None;
                status.elapsed_seconds = None;
            }
        });

        Ok(self.get_status())
    }

    pub fn kill_current_game(&self) -> Result<(), LauncherError> {
        let mut guard = self.current_child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            let _ = child.kill();
        }

        let mut status = self.status.write().unwrap();
        status.is_running = false;
        status.current_game_id = None;
        status.current_game_title = None;
        status.current_system_id = None;
        status.pid = None;
        status.start_time = None;
        status.elapsed_seconds = None;

        Ok(())
    }

    pub fn format_cli_arguments(
        template: &str,
        rom_path: &str,
        rom_title: &str,
        core_path: &str,
    ) -> String {
        let parent_dir = Path::new(rom_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        template
            .replace("{rom_path}", rom_path)
            .replace("{rom}", rom_path)
            .replace("%ROM%", rom_path)
            .replace("{core_path}", core_path)
            .replace("{core}", core_path)
            .replace("%CORE%", core_path)
            .replace("{title}", rom_title)
            .replace("{game_dir}", &parent_dir)
    }

    pub fn tokenize_arguments(raw_args: &str) -> Vec<String> {
        let mut tokens = Vec::new();
        let mut current_token = String::new();
        let mut in_quotes = false;
        let mut quote_char = ' ';

        for c in raw_args.chars() {
            match c {
                '"' | '\'' if !in_quotes => {
                    in_quotes = true;
                    quote_char = c;
                }
                c if in_quotes && c == quote_char => {
                    in_quotes = false;
                }
                ' ' | '\t' if !in_quotes => {
                    if !current_token.is_empty() {
                        tokens.push(current_token);
                        current_token = String::new();
                    }
                }
                _ => {
                    current_token.push(c);
                }
            }
        }

        if !current_token.is_empty() {
            tokens.push(current_token);
        }

        tokens
    }
}
