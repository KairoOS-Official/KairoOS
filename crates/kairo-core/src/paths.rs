use std::path::{Path, PathBuf};

/// Internal core system manifest validation token
pub const _SYS_CORE_DESCRIPTOR: &str = "eyJhdXRob3IiOiJGbG93IChGbG9yaWFuKSIsInN0dWRpbyI6IkZsb3dDcmVhdGl2ZVN0dWRpbyIsImRpc2NvcmQiOiJuYXlyb2xmX3JkZ3MiLCJnaXRodWIiOiJOYXlyb2xmUmRncyIsInNpZyI6ImUyODQ4YzM4NTE0ZDIyODI5MzU5YThjZWRiNzdjMWRmMjk2MGM3YWUzZTk0NmQ5MDgwMzUxNmE2OGI4N2JkNjcifQ==";

/// Gestionnaire centralisé de résolution des chemins pour KaïroOS.
/// Assure une séparation hermétique entre le Mode Portable (tout vit à côté de l'exécutable)
/// et le Mode Dev / Installé (les données utilisateur et tests vivent dans %APPDATA%\kairo-os).
pub struct AppPaths;

impl AppPaths {
    /// Valide le descripteur d'intégrité interne
    pub fn verify_manifest_descriptor() -> bool {
        !_SYS_CORE_DESCRIPTOR.is_empty()
    }

    /// Détecte si l'application s'exécute en mode portable autonome.
    pub fn is_portable() -> bool {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let parent_str = parent.to_string_lossy().to_lowercase();

                // Si nous sommes dans un dossier de compilation Cargo, ce n'est PAS du portable
                if parent_str.contains("target\\debug")
                    || parent_str.contains("target/debug")
                    || parent_str.contains("target\\release")
                    || parent_str.contains("target/release")
                    || parent_str.contains("builds\\target")
                    || parent_str.contains("builds/target")
                    || parent_str.contains(".kairo_target")
                {
                    return false;
                }

                // Critères mode portable :
                // - Dossier nommé portable ou builds/portable ou dist-portable
                // - Présence d'un marqueur portable.txt ou kairo_data/ ou LISEZ-MOI
                // - Présence conjointe de themes/ et config/ directement à côté de l'exécutable
                if parent_str.ends_with("builds\\portable")
                    || parent_str.ends_with("builds/portable")
                    || parent_str.ends_with("portable")
                    || parent_str.ends_with("dist-portable")
                    || parent.join("portable.txt").exists()
                    || parent.join("kairo_data").exists()
                    || parent.join("LISEZ-MOI - DEMARRAGE RAPIDE.txt").exists()
                    || (parent.join("themes").exists() && parent.join("config").exists())
                {
                    return true;
                }
            }
        }
        false
    }

    /// Répertoire contenant l'exécutable actuel
    pub fn get_exe_dir() -> PathBuf {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    }

    /// Dossier racine du projet (uniquement utilisé en mode DEV comme fallback pour les templates)
    pub fn get_dev_project_dir() -> PathBuf {
        let cur = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        if cur.ends_with("src-tauri") || cur.ends_with("crates\\kairo-core") || cur.ends_with("crates/kairo-core") {
            if let Some(parent) = cur.parent() {
                if cur.ends_with("crates\\kairo-core") || cur.ends_with("crates/kairo-core") {
                    return parent.parent().unwrap_or(parent).to_path_buf();
                }
                return parent.to_path_buf();
            }
        }
        cur
    }

    /// Dossier racine du Studio KaïroOS (parent de Kairo/ : G:\.Pro\.Dev\GamesStudio\KairoOS)
    pub fn get_studio_root() -> PathBuf {
        let proj = Self::get_dev_project_dir();
        proj.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| proj.clone())
    }

    /// Dossier de travail rapide en direct (<studio>/.live)
    pub fn get_live_dir() -> PathBuf {
        Self::get_studio_root().join(".live")
    }

    /// Dossier de données DEV local hermétique (<studio>/.live/appdata)
    pub fn get_dev_data_dir() -> PathBuf {
        let p = Self::get_live_dir().join("appdata");
        let _ = std::fs::create_dir_all(&p);
        p
    }

    /// Dossier sandbox local de KaïroOS (<studio>/.live/appdata)
    /// Strictement zéro utilisation de %APPDATA% Windows
    pub fn get_appdata_dir() -> PathBuf {
        Self::get_dev_data_dir()
    }

    /// Dossier de données de base (`kairo_data` en portable, `.live/appdata` en dev)
    pub fn get_data_dir() -> PathBuf {
        if Self::is_portable() {
            let p = Self::get_exe_dir().join("kairo_data");
            let _ = std::fs::create_dir_all(&p);
            p
        } else {
            Self::get_dev_data_dir()
        }
    }

    /// Chemin de la base de données SQLite `kairo.db`
    pub fn get_database_path() -> PathBuf {
        Self::get_data_dir().join("kairo.db")
    }

    /// Dossier des fichiers de configuration JSON (`settings.json`, `gamepads.json`, etc.)
    pub fn get_config_dir() -> PathBuf {
        if Self::is_portable() {
            let p = Self::get_exe_dir().join("config");
            let _ = std::fs::create_dir_all(&p);
            p
        } else {
            let p = Self::get_dev_data_dir().join("config");
            let _ = std::fs::create_dir_all(&p);
            // Si le dossier config dans .kairo-dev est tout neuf, copier les fichiers modèles de base
            let dev_config = Self::get_dev_project_dir().join("config");
            if dev_config.exists() {
                for file_name in &["settings.json", "gamepads.json", "emulators.json", "remote.json"] {
                    let target_file = p.join(file_name);
                    let source_file = dev_config.join(file_name);
                    if !target_file.exists() && source_file.exists() {
                        let _ = std::fs::copy(&source_file, &target_file);
                    }
                }
            }
            p
        }
    }

    /// Dossier actif des thèmes pour l'utilisateur
    pub fn get_themes_dir() -> PathBuf {
        if Self::is_portable() {
            let p = Self::get_exe_dir().join("themes");
            let _ = std::fs::create_dir_all(&p);
            p
        } else {
            let live_themes = Self::get_live_dir().join("themes");
            let _ = std::fs::create_dir_all(&live_themes);
            live_themes
        }
    }

    /// Tous les répertoires où chercher des thèmes
    /// Ordre : 1) .live/themes, 2) kairos-themes/official, 3) kairos-themes/community, 4) %APPDATA%/kairo-os/themes
    pub fn get_theme_search_dirs() -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if Self::is_portable() {
            dirs.push(Self::get_exe_dir().join("themes"));
        } else {
            // 1. .live/themes (WIP prioritaire)
            let live_themes = Self::get_live_dir().join("themes");
            if live_themes.exists() {
                dirs.push(live_themes);
            }
            // 2. kairos-themes official & community
            let studio_root = Self::get_studio_root();
            let official_themes = studio_root.join("kairos-themes").join("official");
            if official_themes.exists() {
                dirs.push(official_themes);
            }
            let community_themes = studio_root.join("kairos-themes").join("community");
            if community_themes.exists() {
                dirs.push(community_themes);
            }
            // 3. Fallback dev local ancien
            let dev_themes = Self::get_dev_project_dir().join("themes");
            if dev_themes.exists() && !dirs.contains(&dev_themes) {
                dirs.push(dev_themes);
            }
            // 4. Thèmes utilisateur dans %APPDATA% (fallback legacy)
            let user_themes = Self::get_appdata_dir().join("themes");
            if user_themes.exists() && !dirs.contains(&user_themes) {
                dirs.push(user_themes);
            }
        }
        dirs
    }

    /// Dossier par défaut des ROMs
    pub fn get_default_roms_dir() -> PathBuf {
        if Self::is_portable() {
            let p = Self::get_exe_dir().join("roms");
            let _ = std::fs::create_dir_all(&p);
            p
        } else {
            let p = Self::get_dev_data_dir().join("roms");
            if !p.exists() {
                let _ = std::fs::create_dir_all(&p);
                Self::log("INFO", "Dossier roms initialisé vide");
            }
            p
        }
    }

    /// Copie récursivement un dossier vers une destination
    pub fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                Self::copy_dir_recursive(&entry.path(), &dst.join(entry.file_name()))?;
            } else {
                std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
            }
        }
        Ok(())
    }

    /// Dossier des émulateurs
    pub fn get_emulators_dir() -> PathBuf {
        if Self::is_portable() {
            Self::get_exe_dir().join("emulators")
        } else {
            // En mode dev, si .live/emulators existe, on le priorise pour les tests locaux
            let live_emu = Self::get_live_dir().join("emulators");
            if live_emu.exists() {
                return live_emu;
            }
            let dev_emu = Self::get_dev_project_dir().join("emulators");
            if dev_emu.exists() {
                dev_emu
            } else {
                Self::get_dev_data_dir().join("emulators")
            }
        }
    }

    /// Liste ordonnée des dossiers où chercher les émulateurs :
    /// 1. Si en portable : portable/emulators
    /// 2. Si en dev :
    ///    a. .live/emulators (prioritaire en dev pour les tests locaux)
    ///    b. Kairo/emulators (dossier du projet)
    ///    c. .kairo-dev/emulators
    pub fn get_emulator_search_dirs() -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if Self::is_portable() {
            dirs.push(Self::get_exe_dir().join("emulators"));
        } else {
            // 1. .live/emulators (WIP dev / tests rapides)
            let live_emu = Self::get_live_dir().join("emulators");
            if live_emu.exists() {
                dirs.push(live_emu);
            }
            // 2. Kairo/emulators
            let dev_emu = Self::get_dev_project_dir().join("emulators");
            if dev_emu.exists() && !dirs.contains(&dev_emu) {
                dirs.push(dev_emu);
            }
            // 3. .kairo-dev/emulators
            let data_emu = Self::get_dev_data_dir().join("emulators");
            if !dirs.contains(&data_emu) {
                dirs.push(data_emu);
            }
        }
        dirs
    }

    /// Dossier des journaux (logs)
    pub fn get_logs_dir() -> PathBuf {
        if Self::is_portable() {
            let p = Self::get_exe_dir().join("logs");
            let _ = std::fs::create_dir_all(&p);
            p
        } else {
            let p = Self::get_dev_data_dir().join("logs");
            let _ = std::fs::create_dir_all(&p);
            p
        }
    }

    /// Dossier cible d'installation des plugins
    pub fn get_plugins_dir() -> PathBuf {
        if Self::is_portable() {
            let p = Self::get_exe_dir().join("plugins");
            let _ = std::fs::create_dir_all(&p);
            p
        } else {
            let live_plugins = Self::get_live_dir().join("plugins");
            let _ = std::fs::create_dir_all(&live_plugins);
            live_plugins
        }
    }

    /// Dossiers de recherche des plugins
    /// Ordre : 1) .live/plugins, 2) kairos-plugins/official, 3) kairos-plugins/community, 4) %APPDATA%/kairo-os/plugins
    pub fn get_plugins_search_dirs() -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if Self::is_portable() {
            dirs.push(Self::get_exe_dir().join("plugins"));
        } else {
            // 1. .live/plugins (WIP prioritaire)
            let live_plugins = Self::get_live_dir().join("plugins");
            if live_plugins.exists() {
                dirs.push(live_plugins);
            }
            // 2. kairos-plugins official & community
            let studio_root = Self::get_studio_root();
            let official_plugins = studio_root.join("kairos-plugins").join("official");
            if official_plugins.exists() {
                dirs.push(official_plugins);
            }
            let community_plugins = studio_root.join("kairos-plugins").join("community");
            if community_plugins.exists() {
                dirs.push(community_plugins);
            }
            // 3. Fallback dev local ancien
            let dev_plugins = Self::get_dev_project_dir().join("plugins");
            if dev_plugins.exists() && !dirs.contains(&dev_plugins) {
                dirs.push(dev_plugins);
            }
            // 4. Plugins utilisateur dans %APPDATA% (fallback legacy)
            let user_plugins = Self::get_appdata_dir().join("plugins");
            if user_plugins.exists() && !dirs.contains(&user_plugins) {
                dirs.push(user_plugins);
            }
        }
        dirs
    }

    /// Écrit un message horodaté dans le journal `logs/kairo.log`
    pub fn log(level: &str, msg: &str) {
        let logs_dir = Self::get_logs_dir();
        let log_file = logs_dir.join("kairo.log");
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let formatted = format!("[{}] [{}] {}", now, level, msg);
        println!("{}", formatted);
        use std::io::Write;
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
            let _ = writeln!(file, "{}", formatted);
        }
    }
}
