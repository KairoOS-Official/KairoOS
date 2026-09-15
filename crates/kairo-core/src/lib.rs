// ─────────────────────────────────────────────────────────────
// FlowCreativeStudio · Flow (Florian)
// discord: nayrolf_rdgs · github.com/NayrolfRdgs
// sig: FCS-SIG-2026:e2848c38514d22829359a8cedb77c1df2960c7ae3e946d90803516a68b87bd67
// ─────────────────────────────────────────────────────────────

pub mod db;
pub mod launcher;
pub mod models;
pub mod paths;
pub mod plugins;
pub mod remote;
pub mod scanner;

pub use db::{Database, DbError};
pub use launcher::{Launcher, LauncherError};
pub use models::*;
pub use paths::AppPaths;
pub use plugins::{
    PluginConfigRecord, PluginContributesConfig, PluginContributionPayload, PluginDetail,
    PluginHostConfig, PluginInfo, PluginManager, PluginManifest, PluginType,
};
pub use remote::{
    start_remote_server, start_remote_server_with_shutdown, RemoteConfig, RemoteEvent,
    RemoteEventCallback,
};
pub use scanner::RomScanner;

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use std::path::PathBuf;
    use chrono::Utc;
    use tempfile::tempdir;


    #[test]
    fn test_db_init_and_seed() {
        let db = Database::open_in_memory().expect("Échec ouverture DB en mémoire");
        let systems = db.get_systems().expect("Échec récupération systèmes");
        assert!(!systems.is_empty(), "Les systèmes par défaut doivent être injectés");

        let snes = db.get_system_by_id("snes").expect("Erreur query").expect("SNES non trouvée");
        assert_eq!(snes.name, "Super Nintendo Entertainment System");
        assert!(snes.extensions.contains(&"sfc".to_string()));

        let emulators = db.get_emulators().expect("Échec récupération émulateurs");
        assert!(!emulators.is_empty(), "Les émulateurs par défaut doivent être injectés");

        let retroarch = db.get_emulator_by_id("retroarch").expect("Erreur").expect("RetroArch non trouvé");
        assert_eq!(retroarch.name, "RetroArch");
    }

    #[test]
    fn test_app_settings_persistence() {
        let db = Database::open_in_memory().expect("Échec DB");
        let initial_settings = db.get_app_settings().expect("Erreur get settings");

        let mut custom = initial_settings;
        custom.fullscreen = true;
        custom.always_on_top = true;
        custom.kiosk_mode = true;
        custom.theme = "retro-80s-light".into();

        db.save_app_settings(&custom).expect("Erreur save settings");
        let loaded = db.get_app_settings().expect("Erreur reload settings");
        assert_eq!(loaded.fullscreen, true);
        assert_eq!(loaded.always_on_top, true);
        assert_eq!(loaded.kiosk_mode, true);
    }

    #[test]
    fn test_gamepad_mappings_persistence_and_sync() {
        let db = Database::open_in_memory().expect("Échec DB");
        let p1 = GamepadMapping {
            player_index: 0,
            physical_joypad_index: Some(0),
            device_name: "DragonRise Generic USB Joystick P1".into(),
            device_id: "pad_0".into(),
            controller_type: "arcade_stick".into(),
            btn_a: Some("0".into()),
            btn_b: Some("1".into()),
            btn_x: Some("2".into()),
            btn_y: Some("3".into()),
            btn_l1: Some("4".into()),
            btn_r1: Some("5".into()),
            btn_l2: None,
            btn_r2: None,
            btn_select: Some("8".into()),
            btn_start: Some("9".into()),
            btn_hotkey: Some("8".into()),
            btn_up: Some("h0up".into()),
            btn_down: Some("h0down".into()),
            btn_left: Some("h0left".into()),
            btn_right: Some("h0right".into()),
            deadzone: 0.15,
        };
        let p2 = GamepadMapping {
            player_index: 1,
            physical_joypad_index: Some(1),
            device_name: "DragonRise Generic USB Joystick P2".into(),
            device_id: "pad_1".into(),
            controller_type: "arcade_stick".into(),
            btn_a: Some("0".into()),
            btn_b: Some("1".into()),
            btn_x: Some("2".into()),
            btn_y: Some("3".into()),
            btn_l1: Some("4".into()),
            btn_r1: Some("5".into()),
            btn_l2: None,
            btn_r2: None,
            btn_select: Some("8".into()),
            btn_start: Some("9".into()),
            btn_hotkey: Some("8".into()),
            btn_up: Some("h0up".into()),
            btn_down: Some("h0down".into()),
            btn_left: Some("h0left".into()),
            btn_right: Some("h0right".into()),
            deadzone: 0.15,
        };

        db.save_gamepad_mappings(&[p1.clone(), p2.clone()]).expect("Sauvegarde gamepad");
        let loaded = db.get_gamepad_mappings().expect("Chargement gamepad");
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].player_index, 0);
        assert_eq!(loaded[1].player_index, 1);
    }

    #[test]
    fn test_game_crud_and_sessions() {
        let db = Database::open_in_memory().expect("Échec DB");
        let now = chrono::Utc::now();
        let game = Game {
            id: "game-1".into(),
            system_id: "snes".into(),
            title: "Super Mario World".into(),
            original_title: Some("Super Mario World (USA)".into()),
            file_path: "C:\\Roms\\snes\\Super Mario World.sfc".into(),
            file_name: "Super Mario World.sfc".into(),
            file_size: 1048576,
            file_hash: Some("abcdef123456".into()),
            franchise: Some("Super Mario".into()),
            cover_url: None,
            backdrop_url: None,
            logo_url: None,
            release_date: Some("1990-11-21".into()),
            publisher: Some("Nintendo".into()),
            developer: Some("Nintendo EAD".into()),
            genre: Some("Platformer".into()),
            players: Some(2),
            rating: Some(4.9),
            synopsis: Some("Mario et Yoshi sauvent Dinosaur Land.".into()),
            favorite: false,
            hidden: false,
            play_count: 0,
            play_time_seconds: 0,
            last_played: None,
            created_at: now,
            updated_at: now,
        };

        db.insert_game(&game).expect("Échec insertion jeu");

        let fetched = db.get_game_by_id("game-1").expect("Erreur").expect("Jeu non trouvé");
        assert_eq!(fetched.title, "Super Mario World");
        assert_eq!(fetched.franchise, Some("Super Mario".into()));
        assert_eq!(fetched.favorite, false);

        let is_fav = db.toggle_favorite("game-1").expect("Échec toggle");
        assert_eq!(is_fav, true);

        let favs = db.get_favorite_games().expect("Échec get favs");
        assert_eq!(favs.len(), 1);
        assert_eq!(favs[0].id, "game-1");

        let start = now;
        let end = now + chrono::Duration::seconds(120);
        db.record_play_session("game-1", 120, start, end).expect("Échec record session");

        let updated_game = db.get_game_by_id("game-1").expect("Erreur").unwrap();
        assert_eq!(updated_game.play_count, 1);
        assert_eq!(updated_game.play_time_seconds, 120);
        assert!(updated_game.last_played.is_some());
    }

    #[test]
    fn test_title_cleaning() {
        assert_eq!(
            RomScanner::clean_game_title("Super Mario World (USA) [!].sfc"),
            "Super Mario World"
        );
        assert_eq!(
            RomScanner::clean_game_title("Legend of Zelda, The - A Link to the Past (Europe) (En,Fr,De) (Rev 1).zip"),
            "Legend of Zelda, The - A Link to the Past"
        );
        assert_eq!(
            RomScanner::clean_game_title("Pokemon - Emerald Version (USA, Europe).gba"),
            "Pokemon - Emerald Version"
        );
        assert_eq!(
            RomScanner::clean_game_title("Tekken 3 [Track 1] (USA).bin"),
            "Tekken 3"
        );
    }

    #[test]
    fn test_scanner_with_local_json_metadata_and_covers() {
        let db = Database::open_in_memory().expect("Échec DB");
        let scanner = RomScanner::new(db.clone());

        let temp = tempdir().expect("Échec création temp dir");
        let mario_franchise_dir = temp.path().join("Super Mario");
        
        let smw_dir = mario_franchise_dir.join("Super Mario World");
        fs::create_dir_all(&smw_dir).expect("Échec mkdir");

        // 1. Jeu SNES
        let rom_snes = smw_dir.join("Super Mario World.sfc");
        let mut f = File::create(&rom_snes).expect("Échec create file");
        f.write_all(b"ROM SNES DUMMY DATA").expect("Échec write");

        // 2. Fichier JSON adjacent
        let meta_snes = smw_dir.join("metadata.json");
        let json_content = r#"{
            "title": "Super Mario World (Édition Finale)",
            "franchise": "Super Mario",
            "release_date": "1990-11-21",
            "developer": "Nintendo EAD",
            "genre": "Plateforme 2D",
            "rating": 5.0,
            "synopsis": "Aventure mythique de Mario et Yoshi."
        }"#;
        fs::write(&meta_snes, json_content).expect("Échec write JSON");

        // 3. Jaquette adjacente PNG
        let media_dir = smw_dir.join("media");
        fs::create_dir_all(&media_dir).unwrap();
        let cover_png = media_dir.join("cover.png");
        fs::write(&cover_png, b"FAKE PNG DATA").expect("Échec write PNG");

        // 4. Jeu N64 dans le MÊME dossier de franchise (Multi-Consoles)
        let sm64_dir = mario_franchise_dir.join("Super Mario 64");
        fs::create_dir_all(&sm64_dir).expect("Échec mkdir");
        let rom_n64 = sm64_dir.join("Super Mario 64.z64");
        let mut f2 = File::create(&rom_n64).expect("Échec create file");
        f2.write_all(b"ROM N64 DUMMY DATA").expect("Échec write");

        let stats = scanner.scan_directory(temp.path()).expect("Échec scan");
        assert_eq!(stats.games_added, 2);
        assert!(stats.systems_detected.contains(&"snes".to_string()));
        assert!(stats.systems_detected.contains(&"n64".to_string()));
        assert!(stats.franchises_detected.contains(&"Super Mario".to_string()));

        let snes_game = db.get_game_by_path(&rom_snes.to_string_lossy()).expect("Query").unwrap();
        assert_eq!(snes_game.title, "Super Mario World (Édition Finale)");
        assert_eq!(snes_game.franchise, Some("Super Mario".into()));
        assert_eq!(snes_game.developer, Some("Nintendo EAD".into()));
        assert_eq!(snes_game.genre, Some("Plateforme 2D".into()));
        assert!(snes_game.cover_url.is_some());

        let n64_game = db.get_game_by_path(&rom_n64.to_string_lossy()).expect("Query").unwrap();
        assert_eq!(n64_game.system_id, "n64");
        assert_eq!(n64_game.franchise, Some("Super Mario".into()));
    }

    #[test]
    fn test_cli_tokenization_and_formatting() {
        let template = "-L \"{core_path}\" -f \"{rom_path}\" --title \"{title}\"";
        let formatted = Launcher::format_cli_arguments(
            template,
            "C:\\Roms\\snes\\Super Mario World.sfc",
            "Super Mario World",
            "C:\\RetroArch\\cores\\snes9x_libretro.dll",
        );

        let tokens = Launcher::tokenize_arguments(&formatted);
        assert_eq!(tokens[0], "-L");
        assert_eq!(tokens[1], "C:\\RetroArch\\cores\\snes9x_libretro.dll");
        assert_eq!(tokens[2], "-f");
        assert_eq!(tokens[3], "C:\\Roms\\snes\\Super Mario World.sfc");
        assert_eq!(tokens[4], "--title");
        assert_eq!(tokens[5], "Super Mario World");
    }

    #[test]
    fn test_launcher_resolve_and_command_build() {
        let temp = tempfile::tempdir().expect("Échec tempdir");
        let db_path = temp.path().join("test_launcher.db");
        let db = Database::open(&db_path).expect("DB init");
        let launcher = Launcher::new(db.clone());

        // Test with real SNES game file
        let rom_path = PathBuf::from("roms/snes/Super Mario World.sfc");
        if rom_path.exists() {
            let snes_system = db.get_system_by_id("snes").expect("query").unwrap();
            let retroarch_emu = db.get_emulator_by_id("retroarch").expect("query").unwrap();
            
            let game = Game {
                id: "snes-test".into(),
                system_id: "snes".into(),
                title: "Super Mario World".into(),
                original_title: None,
                file_path: rom_path.to_string_lossy().to_string(),
                file_name: "Super Mario World.sfc".into(),
                file_size: 262144,
                file_hash: None,
                franchise: Some("Super Mario".into()),
                cover_url: None,
                backdrop_url: None,
                logo_url: None,
                release_date: Some("1990-11-21".into()),
                publisher: None,
                developer: Some("Nintendo EAD".into()),
                genre: Some("Plateforme".into()),
                players: Some(2),
                rating: Some(5.0),
                synopsis: None,
                favorite: false,
                hidden: false,
                play_count: 0,
                play_time_seconds: 0,
                last_played: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            let cmd_res = launcher.build_command(&game, &snes_system, &retroarch_emu, None);
            assert!(cmd_res.is_ok(), "build_command failed: {:?}", cmd_res.err());
        }
    }

    #[test]
    fn test_dev_paths_do_not_use_appdata() {
        assert!(!AppPaths::is_portable());
        let data_dir = AppPaths::get_data_dir();
        let config_dir = AppPaths::get_config_dir();
        let logs_dir = AppPaths::get_logs_dir();
        let roms_dir = AppPaths::get_default_roms_dir();

        let dev_dir = AppPaths::get_dev_data_dir();
        assert_eq!(data_dir, dev_dir);
        assert!(config_dir.starts_with(&dev_dir));
        assert!(logs_dir.starts_with(&dev_dir));
        assert!(roms_dir.starts_with(&dev_dir));

        if let Ok(appdata) = std::env::var("APPDATA") {
            let appdata_kairo = PathBuf::from(appdata).join("kairo-os");
            assert_ne!(data_dir, appdata_kairo);
            assert!(!data_dir.starts_with(&appdata_kairo));
        }
    }
}

