use std::sync::{Arc, RwLock};
use tauri::Manager;

pub mod commands;
use commands::AppState;
use kairo_core::{Database, Launcher};

fn init_logging_and_panic_hook() {
    let logs_dir = kairo_core::AppPaths::get_logs_dir();
    let _ = std::fs::create_dir_all(&logs_dir);
    let crash_file = logs_dir.join("crash.log");

    kairo_core::AppPaths::log("INFO", "=== Démarrage de KaïroOS ===");

    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Panique inconnue".to_string()
        };
        let location = if let Some(loc) = panic_info.location() {
            format!("{}:{}:{}", loc.file(), loc.line(), loc.column())
        } else {
            "localisation inconnue".to_string()
        };

        let msg = format!("[{}] [PANIC] {} à {}", now, payload, location);
        eprintln!("{}", msg);
        kairo_core::AppPaths::log("PANIC", &format!("{} à {}", payload, location));

        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&crash_file) {
            let _ = writeln!(f, "{}", msg);
        }

        default_hook(panic_info);
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging_and_panic_hook();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Détection du mode CLI (--mode kiosk / --mode admin / --kiosk)
            let args: Vec<String> = std::env::args().collect();
            let mut cli_mode: Option<String> = None;

            for i in 0..args.len() {
                if args[i] == "--mode" && i + 1 < args.len() {
                    cli_mode = Some(args[i + 1].to_lowercase());
                } else if args[i] == "--kiosk" {
                    cli_mode = Some("kiosk".to_string());
                } else if args[i] == "--admin" {
                    cli_mode = Some("admin".to_string());
                }
            }

            // Initialisation des données et de la base SQLite via AppPaths (Mode Portable vs %APPDATA%)
            let db_path = kairo_core::AppPaths::get_database_path();
            let db = Database::open(&db_path).expect("Impossible d'initialiser la base SQLite KaïroOS");
            let launcher = Launcher::new(db.clone());

            let settings = db.get_app_settings().unwrap_or_default();
            let initial_mode = match cli_mode {
                Some(m) => m,
                None => {
                    if settings.kiosk_mode {
                        "kiosk".to_string()
                    } else {
                        "admin".to_string()
                    }
                }
            };

            let app_mode = Arc::new(RwLock::new(initial_mode));

            let plugin_manager = kairo_core::PluginManager::new(Some(db.clone()), Some(launcher.clone()));
            plugin_manager.auto_start_enabled_plugins();

            // Appliquer le mode plein écran et always on top au démarrage selon les paramètres sauvegardés
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.set_fullscreen(settings.fullscreen);
                let _ = main_window.set_always_on_top(settings.always_on_top);
            }

            app.manage(AppState {
                db,
                launcher,
                app_mode,
                plugin_manager,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_settings,
            commands::save_app_settings,
            commands::set_fullscreen,
            commands::set_always_on_top,
            commands::toggle_fullscreen,
            commands::get_systems,
            commands::get_system_by_id,
            commands::get_emulators,
            commands::update_emulator_path,
            commands::get_games_by_system,
            commands::get_all_games,
            commands::get_favorite_games,
            commands::get_recent_games,
            commands::get_game_details,
            commands::toggle_favorite,
            commands::update_game_config,
            commands::scan_roms_directory,
            commands::organize_game_into_franchise,
            commands::save_local_game_metadata,
            commands::launch_game,
            commands::get_launcher_status,
            commands::kill_running_game,
            commands::get_gamepad_mappings,
            commands::save_gamepad_mappings,
            commands::get_app_mode,
            commands::set_app_mode,
            commands::get_remote_config,
            commands::save_remote_config,
            commands::add_manual_game,
            commands::delete_game,
            commands::purge_missing_games,
            commands::get_themes,
            commands::get_theme,
            commands::set_theme,
            commands::save_theme,
            commands::create_theme,
            commands::delete_theme,
            commands::open_themes_folder,
            commands::open_logs_folder,
            commands::test_emulator_exe,
            commands::export_config,
            commands::import_config,
            commands::reset_settings,
            commands::download_community_theme,
            commands::get_plugins,
            commands::get_plugin,
            commands::enable_plugin,
            commands::disable_plugin,
            commands::install_plugin,
            commands::confirm_install_plugin,
            commands::uninstall_plugin,
            commands::update_plugin_settings,
            commands::get_plugin_commands,
            commands::run_plugin_command,
            commands::open_plugins_folder,
            commands::get_plugin_contributions,
        ])
        .run(tauri::generate_context!())

        .expect("Erreur lors de l'exécution de KaïroOS");
}
