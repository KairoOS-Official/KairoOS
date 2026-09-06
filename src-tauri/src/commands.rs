use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use kairo_core::{
    AppSettings, Database, Emulator, Game, GameConfig, Launcher, LaunchStatus,
    LocalGameMetadata, RemoteConfig, RomScanner, ScanStats, System,
};
use tauri::{State, Window};

pub struct AppState {
    pub db: Database,
    pub launcher: Launcher,
    pub app_mode: Arc<RwLock<String>>,
    pub plugin_manager: kairo_core::PluginManager,
}

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.db.get_app_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_app_settings(
    settings: AppSettings,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let _ = window.set_fullscreen(settings.fullscreen);
    let _ = window.set_always_on_top(settings.always_on_top);
    state.db.save_app_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_fullscreen(fullscreen: bool, window: Window) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_always_on_top(always_on_top: bool, window: Window, state: State<'_, AppState>) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    if let Ok(mut settings) = state.db.get_app_settings() {
        settings.always_on_top = always_on_top;
        let _ = state.db.save_app_settings(&settings);
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_fullscreen(window: Window) -> Result<bool, String> {
    let current = window.is_fullscreen().map_err(|e| e.to_string())?;
    let next = !current;
    window.set_fullscreen(next).map_err(|e| e.to_string())?;
    Ok(next)
}

#[tauri::command]
pub fn get_systems(state: State<'_, AppState>) -> Result<Vec<System>, String> {
    state.db.get_systems().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_system_by_id(id: String, state: State<'_, AppState>) -> Result<Option<System>, String> {
    state.db.get_system_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_emulators(state: State<'_, AppState>) -> Result<Vec<Emulator>, String> {
    state.db.get_emulators().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_emulator_path(
    id: String,
    exe_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .db
        .update_emulator_path(&id, exe_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_games_by_system(system_id: String, state: State<'_, AppState>) -> Result<Vec<Game>, String> {
    state.db.get_games_by_system(&system_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_games(state: State<'_, AppState>) -> Result<Vec<Game>, String> {
    state.db.get_all_games().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_favorite_games(state: State<'_, AppState>) -> Result<Vec<Game>, String> {
    state.db.get_favorite_games().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_recent_games(limit: Option<usize>, state: State<'_, AppState>) -> Result<Vec<Game>, String> {
    state
        .db
        .get_recently_played_games(limit.unwrap_or(20))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_game_details(
    game_id: String,
    state: State<'_, AppState>,
) -> Result<(Option<Game>, Option<GameConfig>), String> {
    let game = state.db.get_game_by_id(&game_id).map_err(|e| e.to_string())?;
    let config = state.db.get_game_config(&game_id).map_err(|e| e.to_string())?;
    Ok((game, config))
}

#[tauri::command]
pub fn toggle_favorite(game_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.db.toggle_favorite(&game_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_game_config(config: GameConfig, state: State<'_, AppState>) -> Result<(), String> {
    state.db.upsert_game_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_roms_directory(
    path: String,
    calculate_hashes: Option<bool>,
    state: State<'_, AppState>,
) -> Result<ScanStats, String> {
    let resolved_path = if path.is_empty() || path == "./roms" || path == "roms" {
        kairo_core::paths::AppPaths::get_default_roms_dir()
    } else {
        std::path::PathBuf::from(&path)
    };
    let scanner = RomScanner::new(state.db.clone())
        .with_hash_calculation(calculate_hashes.unwrap_or(false));
    scanner.scan_directory(resolved_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn organize_game_into_franchise(
    game_id: String,
    franchise_name: String,
    target_base_dir: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let game = state
        .db
        .get_game_by_id(&game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Jeu introuvable: {}", game_id))?;

    let base_dir = if let Some(dir) = target_base_dir {
        PathBuf::from(dir)
    } else {
        Path::new(&game.file_path)
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf()
    };

    let scanner = RomScanner::new(state.db.clone());
    let new_path = scanner
        .organize_game_into_franchise(&game_id, &franchise_name, &base_dir)
        .map_err(|e| e.to_string())?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_local_game_metadata(
    game_id: String,
    metadata: LocalGameMetadata,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut game = state
        .db
        .get_game_by_id(&game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Jeu introuvable: {}", game_id))?;

    // 1. Mettre à jour en base SQLite
    game.title = metadata.title.clone();
    if metadata.franchise.is_some() {
        game.franchise = metadata.franchise.clone();
    }
    if metadata.genre.is_some() {
        game.genre = metadata.genre.clone();
    }
    if metadata.developer.is_some() {
        game.developer = metadata.developer.clone();
    }
    if metadata.publisher.is_some() {
        game.publisher = metadata.publisher.clone();
    }
    if metadata.release_date.is_some() {
        game.release_date = metadata.release_date.clone();
    }
    if metadata.synopsis.is_some() {
        game.synopsis = metadata.synopsis.clone();
    }
    if metadata.rating.is_some() {
        game.rating = metadata.rating;
    }
    if metadata.players.is_some() {
        game.players = metadata.players;
    }
    if metadata.cover_url.is_some() {
        game.cover_url = metadata.cover_url.clone();
    }
    if metadata.backdrop_url.is_some() {
        game.backdrop_url = metadata.backdrop_url.clone();
    }
    // Note: Since DB game struct doesn't have screenshots or video_url, we just store them in metadata.json if we want.

    state.db.update_game(&game).map_err(|e| e.to_string())?;

    // 2. Écrire le fichier JSON adjacent à la ROM
    let rom_path = Path::new(&game.file_path);
    if let Some(parent) = rom_path.parent() {
        let json_path = parent.join("metadata.json");
        if let Ok(json_str) = serde_json::to_string_pretty(&metadata) {
            let _ = fs::write(json_path, json_str);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn launch_game(game_id: String, state: State<'_, AppState>) -> Result<LaunchStatus, String> {
    state.launcher.launch_game_by_id(&game_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_launcher_status(state: State<'_, AppState>) -> LaunchStatus {
    state.launcher.get_status()
}

#[tauri::command]
pub fn kill_running_game(state: State<'_, AppState>) -> Result<(), String> {
    state.launcher.kill_current_game().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_gamepad_mappings(state: State<'_, AppState>) -> Result<Vec<kairo_core::GamepadMapping>, String> {
    state.db.get_gamepad_mappings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_gamepad_mappings(
    mappings: Vec<kairo_core::GamepadMapping>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.save_gamepad_mappings(&mappings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_mode(state: State<'_, AppState>) -> String {
    state.app_mode.read().map(|m| m.clone()).unwrap_or_else(|_| "admin".to_string())
}

#[tauri::command]
pub fn set_app_mode(
    mode: String,
    pin: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let remote_cfg = RemoteConfig::load();
    let current_mode = state.app_mode.read().map(|m| m.clone()).unwrap_or_else(|_| "admin".to_string());

    if current_mode == "kiosk" && mode == "admin" {
        // Validation du PIN pour passer de Kiosk à Admin
        let provided = pin.unwrap_or_default();
        if provided.trim() != remote_cfg.pin.trim() {
            return Err("Code PIN incorrect".into());
        }
    }

    if let Ok(mut mode_guard) = state.app_mode.write() {
        *mode_guard = mode.clone();
    }

    // Persister dans les paramètres
    if let Ok(mut settings) = state.db.get_app_settings() {
        settings.kiosk_mode = mode == "kiosk";
        let _ = state.db.save_app_settings(&settings);
    }

    Ok(mode)
}

#[tauri::command]
pub fn get_remote_config() -> RemoteConfig {
    RemoteConfig::load()
}

#[tauri::command]
pub fn save_remote_config(config: RemoteConfig, state: State<'_, AppState>) -> Result<(), String> {
    RemoteConfig::save(&config).map_err(|e| e.to_string())?;
    // Redémarre tout plugin fournissant le service builtin remote_server
    state.plugin_manager.restart_by_builtin_service("remote_server");
    Ok(())
}

#[tauri::command]
pub fn add_manual_game(
    file_path: String,
    system_id: String,
    title: Option<String>,
    cover_url: Option<String>,
    franchise: Option<String>,
    genre: Option<String>,
    developer: Option<String>,
    release_date: Option<String>,
    synopsis: Option<String>,
    rating: Option<f32>,
    players: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Game, String> {
    let path = Path::new(&file_path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = if path.exists() {
        path.metadata().map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let clean_title = title.unwrap_or_else(|| {
        RomScanner::clean_game_title(&file_name)
    });

    let short_id = uuid::Uuid::new_v4().to_string().replace('-', "");
    let id = format!("{}-{}", system_id, &short_id[..8]);
    let now = chrono::Utc::now();

    let game = Game {
        id: id.clone(),
        system_id,
        title: clean_title,
        original_title: None,
        file_path: file_path.clone(),
        file_name,
        file_size,
        file_hash: None,
        franchise,
        cover_url,
        backdrop_url: None,
        logo_url: None,
        release_date,
        publisher: None,
        developer,
        genre,
        players: players.or(Some(1)),
        rating: rating.or(Some(4.5)),
        synopsis,
        favorite: false,
        hidden: false,
        play_count: 0,
        play_time_seconds: 0,
        last_played: None,
        created_at: now,
        updated_at: now,
    };

    state.db.insert_game(&game).map_err(|e| e.to_string())?;

    let config = GameConfig {
        id: format!("cfg-{}", id),
        game_id: id,
        emulator_id_override: None,
        custom_cli_args: None,
        custom_core: None,
        screen_ratio: None,
        shader: None,
        auto_save_state: true,
        forced_fullscreen: None,
    };
    let _ = state.db.upsert_game_config(&config);

    Ok(game)
}

/// Supprime un jeu de la base de données (ne supprime PAS les fichiers du disque)
#[tauri::command]
pub fn delete_game(game_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_game(&game_id).map_err(|e| e.to_string())
}

/// Supprime de la base de données tous les jeux dont le fichier ROM n'existe plus sur le disque.
/// Retourne le nombre d'entrées supprimées.
#[tauri::command]
pub fn purge_missing_games(state: State<'_, AppState>) -> Result<usize, String> {
    let games = state.db.get_all_games().map_err(|e| e.to_string())?;
    let mut removed = 0usize;

    for game in games {
        if !std::path::Path::new(&game.file_path).exists() {
            if let Ok(()) = state.db.delete_game(&game.id) {
                removed += 1;
            }
        }
    }

    Ok(removed)
}

fn resolve_themes_dir() -> std::path::PathBuf {
    kairo_core::AppPaths::get_themes_dir()
}

/// Liste tous les thèmes installés dans le dossier `themes/`
#[tauri::command]
pub fn get_themes(state: State<'_, AppState>) -> Result<Vec<kairo_core::Theme>, String> {
    let search_dirs = kairo_core::AppPaths::get_theme_search_dirs();
    let mut themes = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();
    let active_theme_id = state.db.get_app_settings()
        .map(|s| s.theme)
        .unwrap_or_else(|_| "kairo-default".into());

    for dir in search_dirs {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    let theme_json_path = entry.path().join("theme.json");
                    if theme_json_path.exists() {
                        if let Ok(content) = std::fs::read_to_string(&theme_json_path) {
                            if let Ok(mut theme) = serde_json::from_str::<kairo_core::Theme>(&content) {
                                if seen_ids.contains(&theme.id) {
                                    continue;
                                }
                                seen_ids.insert(theme.id.clone());

                                let index_html = entry.path().join("index.html");
                                if index_html.exists() {
                                    theme.entry_path = Some(index_html.to_string_lossy().to_string());
                                    theme.theme_type = Some("custom-code".into());
                                } else if theme.theme_type.is_none() {
                                    theme.theme_type = Some("built-in".into());
                                }

                                for ext in &["preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.svg"] {
                                    let preview_file = entry.path().join(ext);
                                    if preview_file.exists() {
                                        theme.preview_url = Some(preview_file.to_string_lossy().to_string());
                                        break;
                                    }
                                }

                                theme.is_active = theme.id == active_theme_id
                                    || (active_theme_id == "arcade-light" && theme.id == "kairo-default");
                                themes.push(theme);
                            }
                        }
                    }
                }
            }
        }
    }

    let has_active = themes.iter().any(|t| t.is_active);
    if !has_active && !themes.is_empty() {
        let idx = themes.iter().position(|t| t.id == "kairo-hub").unwrap_or(0);
        themes[idx].is_active = true;
    }

    if themes.is_empty() {
        let mut def = kairo_core::Theme::default();
        def.id = "kairo-default".into();
        def.name = "Kaïro OS".into();
        def.theme_type = Some("built-in".into());
        def.is_active = true;
        themes.push(def);
    }

    Ok(themes)
}

/// Récupère les métadonnées et le style d'un thème par son ID
#[tauri::command]
pub fn get_theme(id: String) -> Result<kairo_core::Theme, String> {
    let themes_dir = resolve_themes_dir();
    let mut theme_dir = themes_dir.join(&id);
    let mut theme_json = theme_dir.join("theme.json");
    if !theme_json.exists() {
        let fallback_dir = themes_dir.join("kairo-default");
        if fallback_dir.join("theme.json").exists() {
            theme_dir = fallback_dir;
            theme_json = theme_dir.join("theme.json");
        } else {
            return Err(format!("Thème '{}' introuvable", id));
        }
    }
    let content = std::fs::read_to_string(&theme_json).map_err(|e| e.to_string())?;
    let mut theme: kairo_core::Theme = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    
    let index_html = theme_dir.join("index.html");
    if index_html.exists() {
        theme.entry_path = Some(index_html.to_string_lossy().to_string());
        theme.theme_type = Some("custom-code".into());
    } else if theme.theme_type.is_none() {
        theme.theme_type = Some("built-in".into());
    }

    for ext in &["preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.svg"] {
        let preview_file = theme_dir.join(ext);
        if preview_file.exists() {
            theme.preview_url = Some(preview_file.to_string_lossy().to_string());
            break;
        }
    }
    Ok(theme)
}

/// Définit le thème actif et met à jour settings.json
#[tauri::command]
pub fn set_theme(id: String, state: State<'_, AppState>) -> Result<kairo_core::Theme, String> {
    let theme = get_theme(id.clone())?;
    let mut settings = state.db.get_app_settings().map_err(|e| e.to_string())?;
    settings.theme = id;
    state.db.save_app_settings(&settings).map_err(|e| e.to_string())?;
    Ok(theme)
}

/// Sauvegarde les modifications complètes d'un thème (couleurs, disposition, polices)
#[tauri::command]
pub fn save_theme(mut theme: kairo_core::Theme, state: State<'_, AppState>) -> Result<kairo_core::Theme, String> {
    let themes_dir = resolve_themes_dir();
    let theme_dir = themes_dir.join(&theme.id);
    let _ = std::fs::create_dir_all(&theme_dir);
    let theme_json = theme_dir.join("theme.json");

    theme.is_active = true;
    let json_content = serde_json::to_string_pretty(&theme).map_err(|e| e.to_string())?;
    std::fs::write(&theme_json, json_content).map_err(|e| e.to_string())?;

    for ext in &["preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.svg"] {
        let preview_file = theme_dir.join(ext);
        if preview_file.exists() {
            theme.preview_url = Some(preview_file.to_string_lossy().to_string());
            break;
        }
    }

    let mut settings = state.db.get_app_settings().map_err(|e| e.to_string())?;
    settings.theme = theme.id.clone();
    let _ = state.db.save_app_settings(&settings);

    Ok(theme)
}

/// Crée un nouveau thème personnalisé dans le dossier themes/ (avec code complet ou stylistique)
#[tauri::command]
pub fn create_theme(id: String, name: String, with_code: Option<bool>, _state: State<'_, AppState>) -> Result<kairo_core::Theme, String> {
    let clean_id = id.trim().to_lowercase().replace(' ', "-");
    if clean_id.is_empty() {
        return Err("Identifiant de thème invalide".into());
    }
    let themes_dir = resolve_themes_dir();
    let theme_dir = themes_dir.join(&clean_id);
    if theme_dir.exists() {
        return Err(format!("Le thème '{}' existe déjà", clean_id));
    }
    let _ = std::fs::create_dir_all(&theme_dir);

    let is_code_theme = with_code.unwrap_or(false);

    let mut theme = kairo_core::Theme::default();
    theme.id = clean_id.clone();
    theme.name = if name.trim().is_empty() { "Nouveau Thème".into() } else { name };
    theme.author = "Utilisateur".into();
    theme.version = "1.0.0".into();
    theme.description = if is_code_theme {
        "Thème avec code complet (HTML, CSS, JavaScript / Vite / React)".into()
    } else {
        "Thème personnalisé créé dans KaïroOS".into()
    };
    if is_code_theme {
        theme.theme_type = Some("custom-code".into());
    }

    let theme_json = theme_dir.join("theme.json");
    let json_content = serde_json::to_string_pretty(&theme).map_err(|e| e.to_string())?;
    std::fs::write(&theme_json, json_content).map_err(|e| e.to_string())?;

    if is_code_theme {
        let index_html_content = r#"<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kaïro Custom Theme</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="app">
    <header class="theme-header">
      <div class="logo">🎮 <span>KAÏRO</span> THEME</div>
      <div class="stats" id="stats">Chargement des jeux...</div>
      <button class="settings-btn" id="open-settings-btn">⚙️ Paramètres</button>
    </header>

    <nav class="systems-bar" id="systems-bar">
      <!-- Les consoles seront injectées ici par app.js -->
    </nav>

    <main class="games-grid" id="games-grid">
      <!-- Les cartes de jeux seront injectées ici par app.js -->
    </main>
  </div>

  <script src="app.js"></script>
</body>
</html>
"#;
        let _ = std::fs::write(theme_dir.join("index.html"), index_html_content);

        let style_css_content = r#"/* Styles du thème personnalisé Kaïro */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
}

body {
  background: #0f172a;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-x: hidden;
  min-height: 100vh;
}

.theme-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  background: #1e293b;
  border-bottom: 2px solid #334155;
}

.logo {
  font-weight: 900;
  font-size: 1.25rem;
  letter-spacing: 1px;
}

.logo span {
  color: #8b5cf6;
}

.stats {
  font-size: 0.85rem;
  color: #94a3b8;
  font-weight: 600;
}

.settings-btn {
  background: #334155;
  border: 1px solid #475569;
  color: #f8fafc;
  padding: 8px 16px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
}

.settings-btn:hover {
  background: #8b5cf6;
  border-color: #a78bfa;
}

.systems-bar {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  overflow-x: auto;
}

.system-chip {
  padding: 8px 16px;
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 14px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.system-chip.active, .system-chip:hover {
  border-color: #8b5cf6;
  background: #2e1065;
  color: #c4b5fd;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
  padding: 24px;
}

.game-card {
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  display: flex;
  flex-direction: column;
}

.game-card:hover, .game-card.focused {
  transform: translateY(-4px) scale(1.02);
  border-color: #8b5cf6;
  box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.4);
}

.cover-wrapper {
  aspect-ratio: 3/4;
  background: #090d16;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-cover {
  font-size: 2.5rem;
}

.game-info {
  padding: 12px;
}

.game-title {
  font-size: 0.85rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-system {
  font-size: 0.7rem;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 700;
  margin-top: 4px;
}
"#;
        let _ = std::fs::write(theme_dir.join("style.css"), style_css_content);

        let app_js_content = r#"// Script du Thème Personnalisé Kaïro
(function () {
  let allGames = [];
  let allSystems = [];
  let selectedSystem = null;

  const statsEl = document.getElementById('stats');
  const systemsBarEl = document.getElementById('systems-bar');
  const gamesGridEl = document.getElementById('games-grid');
  const settingsBtn = document.getElementById('open-settings-btn');

  // Connexion à l'API Kaïro
  function getKairo() {
    return window.kairo || (window.parent && window.parent.kairo) || null;
  }

  function init() {
    const kairo = getKairo();
    if (!kairo) {
      statsEl.innerText = 'En attente de connexion à Kaïro...';
      setTimeout(init, 300);
      return;
    }

    allGames = kairo.games || [];
    allSystems = kairo.systems || [];

    statsEl.innerText = `${allGames.length} jeux installés`;

    renderSystems();
    renderGames();

    if (settingsBtn) {
      settingsBtn.onclick = () => kairo.openSettings();
    }

    // Écoute des mises à jour de la bibliothèque
    if (kairo.onLibraryUpdate) {
      kairo.onLibraryUpdate((games) => {
        allGames = games;
        statsEl.innerText = `${allGames.length} jeux installés`;
        renderGames();
      });
    }

    // Écoute des manettes
    if (kairo.onGamepad) {
      kairo.onGamepad((event) => {
        console.log('Manette reçue dans le thème :', event);
      });
    }
  }

  function renderSystems() {
    if (!systemsBarEl) return;
    systemsBarEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `system-chip ${selectedSystem === null ? 'active' : ''}`;
    allBtn.innerText = 'Tous les Jeux';
    allBtn.onclick = () => {
      selectedSystem = null;
      renderSystems();
      renderGames();
    };
    systemsBarEl.appendChild(allBtn);

    allSystems.forEach((sys) => {
      const btn = document.createElement('button');
      btn.className = `system-chip ${selectedSystem === sys.id ? 'active' : ''}`;
      btn.innerText = sys.name || sys.id;
      btn.onclick = () => {
        selectedSystem = sys.id;
        renderSystems();
        renderGames();
      };
      systemsBarEl.appendChild(btn);
    });
  }

  function renderGames() {
    if (!gamesGridEl) return;
    gamesGridEl.innerHTML = '';

    const filtered = selectedSystem
      ? allGames.filter((g) => g.system_id === selectedSystem)
      : allGames;

    if (filtered.length === 0) {
      gamesGridEl.innerHTML = '<div style="color: #64748b; grid-column: 1/-1; text-align: center; padding: 40px; font-weight: bold;">Aucun jeu trouvé</div>';
      return;
    }

    const kairo = getKairo();

    filtered.forEach((game) => {
      const card = document.createElement('div');
      card.className = 'game-card';

      const coverWrapper = document.createElement('div');
      coverWrapper.className = 'cover-wrapper';

      if (game.cover_url) {
        const img = document.createElement('img');
        img.className = 'cover-img';
        img.src = game.cover_url;
        img.alt = game.title;
        coverWrapper.appendChild(img);
      } else {
        const noCover = document.createElement('div');
        noCover.className = 'no-cover';
        noCover.innerText = '🎮';
        coverWrapper.appendChild(noCover);
      }

      const info = document.createElement('div');
      info.className = 'game-info';

      const title = document.createElement('div');
      title.className = 'game-title';
      title.innerText = game.title;

      const system = document.createElement('div');
      system.className = 'game-system';
      system.innerText = game.system_id || '';

      info.appendChild(title);
      info.appendChild(system);

      card.appendChild(coverWrapper);
      card.appendChild(info);

      // Clic pour lancer le jeu
      card.onclick = () => {
        if (kairo && kairo.launchGame) {
          kairo.launchGame(game.id);
        }
      };

      // Clic droit ou double clic pour les détails
      card.oncontextmenu = (e) => {
        e.preventDefault();
        if (kairo && kairo.selectGame) {
          kairo.selectGame(game.id);
        }
      };

      gamesGridEl.appendChild(card);
    });
  }

  window.addEventListener('DOMContentLoaded', init);
  init();
})();
"#;
        let _ = std::fs::write(theme_dir.join("app.js"), app_js_content);

        let readme_content = r#"# 🎮 Kaïro Custom Theme

Bienvenue dans votre nouveau thème pour KaïroOS !

Ce thème est une page web complète que vous pouvez modifier comme vous le souhaitez :
- En éditant directement `index.html`, `style.css` et `app.js`.
- Ou en utilisant un projet **Vite + React / Vue / Svelte** dont vous compilez le build dans ce dossier !

## API Kaïro disponible (`window.kairo`) :
- `kairo.games` : Liste de tous les jeux.
- `kairo.systems` : Liste de toutes les consoles.
- `kairo.launchGame(gameId)` : Lance un jeu dans son émulateur.
- `kairo.selectGame(gameId)` : Ouvre la fiche de détails du jeu.
- `kairo.toggleFavorite(gameId)` : Ajoute ou retire des favoris.
- `kairo.openSettings()` : Ouvre le menu des paramètres.
- `kairo.openGamepadSettings()` : Ouvre la configuration des manettes.
- `kairo.onGamepad(callback)` : Reçoit les événements manette en direct.
- `kairo.onLibraryUpdate(callback)` : Déclenché quand la bibliothèque de jeux est modifiée.
"#;
        let _ = std::fs::write(theme_dir.join("README.md"), readme_content);

        let index_path = theme_dir.join("index.html");
        theme.entry_path = Some(index_path.to_string_lossy().to_string());
    }

    Ok(theme)
}

/// Supprime un thème personnalisé du disque
#[tauri::command]
pub fn delete_theme(id: String, _state: State<'_, AppState>) -> Result<(), String> {
    if id == "kairo-default" {
        return Err("Le thème officiel par défaut ne peut pas être supprimé".into());
    }
    let themes_dir = resolve_themes_dir();
    let theme_dir = themes_dir.join(&id);
    if theme_dir.exists() {
        std::fs::remove_dir_all(&theme_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Ouvre le dossier `themes/` dans l'explorateur Windows
#[tauri::command]
pub fn open_themes_folder() -> Result<(), String> {
    let dir = resolve_themes_dir();
    let _ = std::fs::create_dir_all(&dir);
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer").arg(&dir).spawn();
    }
    Ok(())
}

/// Ouvre le dossier des journaux d'erreurs (logs) dans l'explorateur Windows
#[tauri::command]
pub fn open_logs_folder() -> Result<(), String> {
    let logs_dir = kairo_core::AppPaths::get_logs_dir();
    let _ = std::fs::create_dir_all(&logs_dir);
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer").arg(&logs_dir).spawn();
    }
    Ok(())
}

/// Teste si un binaire / exécutable d'émulateur existe
#[tauri::command]
pub fn test_emulator_exe(path: String) -> Result<bool, String> {
    if path.trim().is_empty() {
        return Ok(false);
    }
    let p = std::path::Path::new(&path);
    if p.exists() {
        return Ok(true);
    }
    if let Ok(cur) = std::env::current_dir() {
        if cur.join(p).exists() {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Exporte les fichiers de configuration vers un fichier zip
#[tauri::command]
pub fn export_config(dest_zip_path: String) -> Result<(), String> {
    let config_dir = kairo_core::paths::AppPaths::get_config_dir();
    if !config_dir.exists() {
        return Err("Le dossier config n'existe pas".into());
    }
    #[cfg(windows)]
    {
        let cmd = format!("Compress-Archive -Path '{}' -DestinationPath '{}' -Force", config_dir.join("*").display(), dest_zip_path);
        let status = std::process::Command::new("powershell")
            .args(["-Command", &cmd])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Échec de la compression de la configuration".into());
        }
    }
    Ok(())
}

/// Restaure les fichiers de configuration depuis un fichier zip
#[tauri::command]
pub fn import_config(src_zip_path: String) -> Result<(), String> {
    if !std::path::Path::new(&src_zip_path).exists() {
        return Err("Fichier zip introuvable".into());
    }
    let config_dir = kairo_core::paths::AppPaths::get_config_dir();
    let _ = std::fs::create_dir_all(&config_dir);
    #[cfg(windows)]
    {
        let cmd = format!("Expand-Archive -Path '{}' -DestinationPath '{}' -Force", src_zip_path, config_dir.display());
        let status = std::process::Command::new("powershell")
            .args(["-Command", &cmd])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Échec de l'extraction de la configuration".into());
        }
    }
    Ok(())
}

/// Réinitialise tous les paramètres de KaïroOS à leurs valeurs par défaut
#[tauri::command]
pub fn reset_settings(state: State<'_, AppState>) -> Result<kairo_core::AppSettings, String> {
    let defaults = kairo_core::AppSettings::default();
    state.db.save_app_settings(&defaults).map_err(|e| e.to_string())?;
    let config_path = kairo_core::paths::AppPaths::get_config_dir().join("settings.json");
    if let Ok(json_str) = serde_json::to_string_pretty(&defaults) {
        let _ = std::fs::write(config_path, json_str);
    }
    Ok(defaults)
}

/// Télécharge un thème depuis le store GitHub et l'installe dans `themes/{theme_id}`
#[tauri::command]
pub fn download_community_theme(theme_id: String, zip_url: String) -> Result<kairo_core::Theme, String> {
    let themes_dir = resolve_themes_dir();
    let target_dir = themes_dir.join(&theme_id);
    let _ = std::fs::create_dir_all(&target_dir);

    #[cfg(windows)]
    {
        let temp_zip = themes_dir.join(format!("{}.zip", theme_id));
        let temp_extract = themes_dir.join(format!("_temp_extract_{}", theme_id));
        let _ = std::fs::create_dir_all(&temp_extract);

        let cmd = format!(
            "$zip = '{}'; $extract = '{}'; $target = '{}'; $tId = '{}'; \
            Invoke-WebRequest -Uri '{}' -OutFile $zip; \
            Expand-Archive -Path $zip -DestinationPath $extract -Force; \
            $match = Get-ChildItem -Path $extract -Recurse -Filter 'theme.json' | Where-Object {{ $_.Directory.Name -eq $tId }} | Select-Object -First 1; \
            if ($match) {{ \
                Copy-Item -Path (Join-Path $match.DirectoryName '*') -Destination $target -Recurse -Force; \
            }} else {{ \
                Copy-Item -Path (Join-Path $extract '*') -Destination $target -Recurse -Force; \
            }} \
            Remove-Item -Path $zip -Force -ErrorAction SilentlyContinue; \
            Remove-Item -Path $extract -Recurse -Force -ErrorAction SilentlyContinue;",
            temp_zip.display(), temp_extract.display(), target_dir.display(), theme_id, zip_url
        );
        let status = std::process::Command::new("powershell")
            .args(["-Command", &cmd])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Échec du téléchargement ou de l'extraction du thème".into());
        }
    }

    get_theme(theme_id)
}

#[tauri::command]
pub fn get_plugins(state: State<'_, AppState>) -> Result<Vec<kairo_core::PluginInfo>, String> {
    Ok(state.plugin_manager.list_plugins())
}

#[tauri::command]
pub fn get_plugin(id: String, state: State<'_, AppState>) -> Result<kairo_core::PluginDetail, String> {
    state.plugin_manager.get_plugin(&id).ok_or_else(|| format!("Plugin '{}' introuvable", id))
}

#[tauri::command]
pub fn enable_plugin(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.plugin_manager.enable_plugin(&id)
}

#[tauri::command]
pub fn disable_plugin(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.plugin_manager.disable_plugin(&id)
}

#[tauri::command]
pub fn install_plugin(zip_path: String) -> Result<kairo_core::PluginManifest, String> {
    kairo_core::PluginManager::stage_plugin_zip(&zip_path)
}

#[tauri::command]
pub fn confirm_install_plugin(plugin_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.plugin_manager.confirm_install(&plugin_id)
}

#[tauri::command]
pub fn uninstall_plugin(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.plugin_manager.uninstall_plugin(&id)
}

#[tauri::command]
pub fn update_plugin_settings(
    id: String,
    settings: std::collections::HashMap<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.plugin_manager.update_plugin_settings(&id, settings)
}

#[tauri::command]
pub fn get_plugin_commands(id: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let detail = state.plugin_manager.get_plugin(&id).ok_or_else(|| format!("Plugin '{}' introuvable", id))?;
    Ok(detail.manifest.commands)
}

#[tauri::command]
pub fn run_plugin_command(id: String, command: String, state: State<'_, AppState>) -> Result<String, String> {
    state.plugin_manager.run_plugin_command(&id, &command)
}

#[tauri::command]
pub fn open_plugins_folder() -> Result<(), String> {
    let dir = kairo_core::AppPaths::get_plugins_dir();
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_plugin_contributions(
    host_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<kairo_core::PluginContributionPayload>, String> {
    Ok(state.plugin_manager.get_contributions_for_host(&host_id))
}

