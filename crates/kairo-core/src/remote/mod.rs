use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::sync::oneshot;
use axum::{
    extract::{Path as AxumPath, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use std::sync::Arc;

use crate::db::Database;
use crate::launcher::Launcher;
use crate::models::{AppSettings, Emulator, Game};

/// Événements émis par le serveur distant en temps réel
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum RemoteEvent {
    #[serde(rename = "settings_updated")]
    SettingsUpdated(Box<AppSettings>),
    #[serde(rename = "theme_changed")]
    ThemeChanged(String),
    #[serde(rename = "theme_updated")]
    ThemeUpdated(String),
    #[serde(rename = "kiosk_changed")]
    KioskChanged(bool),
    #[serde(rename = "emulators_updated")]
    EmulatorsUpdated(Vec<Emulator>),
    #[serde(rename = "plugins_updated")]
    PluginsUpdated,
}

pub type RemoteEventCallback = Arc<dyn Fn(RemoteEvent) + Send + Sync>;

/// Configuration du serveur distant (config/remote.json)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteConfig {
    pub enabled: bool,
    pub port: u16,
    pub pin: String,
    pub allowed_origins: Vec<String>,
}

impl Default for RemoteConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            port: 8080,
            pin: "1234".into(),
            allowed_origins: vec!["*".into()],
        }
    }
}

impl RemoteConfig {
    pub fn load() -> Self {
        let path = crate::paths::AppPaths::get_config_dir().join("remote.json");
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str::<RemoteConfig>(&content) {
                return cfg;
            }
        }
        let default_cfg = Self::default();
        let _ = Self::save(&default_cfg);
        default_cfg
    }

    pub fn save(cfg: &RemoteConfig) -> std::io::Result<()> {
        let dir = crate::paths::AppPaths::get_config_dir();
        let json = serde_json::to_string_pretty(cfg)?;
        std::fs::write(dir.join("remote.json"), &json)?;
        Ok(())
    }
}

/// État partagé du serveur Axum
#[derive(Clone)]
pub struct RemoteServerState {
    pub db: Database,
    pub launcher: Launcher,
    pub config_dir: PathBuf,
    pub event_callback: Option<RemoteEventCallback>,
}

impl RemoteServerState {
    pub fn notify(&self, event: RemoteEvent) {
        if let Some(cb) = &self.event_callback {
            cb(event);
        }
    }
}

#[derive(Serialize)]
pub struct StatusResponse {
    pub is_running: bool,
    pub current_game_id: Option<String>,
    pub current_game_title: Option<String>,
    pub current_system_id: Option<String>,
    pub current_game_cover: Option<String>,
    pub elapsed_seconds: Option<u64>,
    pub kiosk_mode: bool,
    pub port: u16,
    pub local_ip: String,
    pub version: &'static str,
}

#[derive(Serialize)]
pub struct SystemInfoResponse {
    pub local_ip: String,
    pub port: u16,
    pub version: &'static str,
    pub install_dir: String,
    pub kiosk_mode: bool,
    pub total_games: usize,
}

#[derive(Deserialize)]
pub struct LaunchRequest {
    pub game_id: String,
}

#[derive(Deserialize)]
pub struct AddGameRequest {
    pub path: String,
    pub system_id: String,
    pub title: Option<String>,
}

#[derive(Deserialize)]
pub struct UnlockRequest {
    pub pin: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub pin: String,
}

#[derive(Deserialize)]
pub struct GamepadInputRequest {
    pub player_index: u8,
    pub button: String,
    pub is_down: bool,
}

#[derive(Deserialize)]
pub struct CoverQuery {
    pub path: String,
}

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[cfg(windows)]
pub fn simulate_key_event(vk_code: u16, is_down: bool) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    };
    use std::mem::size_of;

    let flags = if is_down { 0 } else { KEYEVENTF_KEYUP };
    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk_code,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    unsafe {
        SendInput(1, &input, size_of::<INPUT>() as i32);
    }
}

#[cfg(not(windows))]
pub fn simulate_key_event(_vk_code: u16, _is_down: bool) {}

fn map_player_button_to_vk(player: u8, button: &str) -> Option<u16> {
    let btn = button.to_lowercase();
    match player {
        0 => match btn.as_str() {
            "up" => Some(0x26),       // VK_UP
            "down" => Some(0x28),     // VK_DOWN
            "left" => Some(0x25),     // VK_LEFT
            "right" => Some(0x27),    // VK_RIGHT
            "a" => Some(0x58),        // 'X'
            "b" => Some(0x5A),        // 'Z'
            "x" => Some(0x53),        // 'S'
            "y" => Some(0x41),        // 'A'
            "l1" => Some(0x51),       // 'Q'
            "r1" => Some(0x57),       // 'W'
            "l2" => Some(0x45),       // 'E'
            "r2" => Some(0x52),       // 'R'
            "start" => Some(0x0D),    // VK_RETURN
            "select" | "coin" => Some(0x20), // VK_SPACE
            _ => None,
        },
        1 => match btn.as_str() {
            "up" => Some(0x68),       // VK_NUMPAD8
            "down" => Some(0x62),     // VK_NUMPAD2
            "left" => Some(0x64),     // VK_NUMPAD4
            "right" => Some(0x66),    // VK_NUMPAD6
            "a" => Some(0x61),        // VK_NUMPAD1
            "b" => Some(0x63),        // VK_NUMPAD3
            "x" => Some(0x65),        // VK_NUMPAD5
            "y" => Some(0x67),        // VK_NUMPAD7
            "l1" => Some(0x69),       // VK_NUMPAD9
            "r1" => Some(0x60),       // VK_NUMPAD0
            "l2" => Some(0x6A),       // VK_MULTIPLY
            "r2" => Some(0x6B),       // VK_ADD
            "start" => Some(0x6D),    // VK_SUBTRACT
            "select" | "coin" => Some(0x6E), // VK_DECIMAL
            _ => None,
        },
        2 => match btn.as_str() {
            "up" => Some(0x49),       // 'I'
            "down" => Some(0x4B),     // 'K'
            "left" => Some(0x4A),     // 'J'
            "right" => Some(0x4C),    // 'L'
            "a" => Some(0x55),        // 'U'
            "b" => Some(0x4F),        // 'O'
            "x" => Some(0x50),        // 'P'
            "y" => Some(0x59),        // 'Y'
            "l1" => Some(0x54),       // 'T'
            "r1" => Some(0x47),       // 'G'
            "start" => Some(0x48),    // 'H'
            "select" | "coin" => Some(0x42), // 'B'
            _ => None,
        },
        _ => match btn.as_str() {
            "up" => Some(0x26),
            "down" => Some(0x28),
            "left" => Some(0x25),
            "right" => Some(0x27),
            "a" => Some(0x58),
            "b" => Some(0x5A),
            "x" => Some(0x53),
            "y" => Some(0x41),
            "start" => Some(0x0D),
            "select" | "coin" => Some(0x20),
            _ => None,
        },
    }
}

/// Détecte l'adresse IP locale principale (ex: 192.168.1.30)
fn get_local_ip() -> String {
    use std::net::UdpSocket;
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(local_addr) = socket.local_addr() {
                return local_addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

/// Vérifie le code PIN via le header X-Kairo-Pin ou le cookie kairo_pin
fn verify_pin(headers: &HeaderMap, required_pin: &str) -> bool {
    if let Some(val) = headers.get("X-Kairo-Pin") {
        if let Ok(pin_str) = val.to_str() {
            if pin_str.trim() == required_pin.trim() {
                return true;
            }
        }
    }
    if let Some(cookie_header) = headers.get(header::COOKIE) {
        if let Ok(cookies) = cookie_header.to_str() {
            for cookie in cookies.split(';') {
                let parts: Vec<&str> = cookie.trim().splitn(2, '=').collect();
                if parts.len() == 2 && parts[0] == "kairo_pin" {
                    if parts[1].trim() == required_pin.trim() {
                        return true;
                    }
                }
            }
        }
    }
    false
}

/// Démarre le serveur Axum en tâche de fond dans son propre runtime Tokio
pub fn start_remote_server(db: Database, launcher: Launcher) -> std::thread::JoinHandle<()> {
    let (handle, _tx) = start_remote_server_with_shutdown(db, launcher, None);
    handle
}

/// Retourne un oneshot::Sender qui, lorsqu'il est consommé, arrête le serveur distant proprement
pub fn start_remote_server_with_shutdown(
    db: Database,
    launcher: Launcher,
    event_callback: Option<RemoteEventCallback>,
) -> (std::thread::JoinHandle<()>, oneshot::Sender<()>) {
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let handle = std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
        {
            Ok(rt) => rt,
            Err(e) => {
                eprintln!("❌ Impossible d'initialiser le runtime Tokio pour le serveur distant: {}", e);
                return;
            }
        };

        rt.block_on(async move {
            let config = RemoteConfig::load();
            if !config.enabled {
                println!("ℹ️ Serveur distant KaïroOS désactivé dans config/remote.json");
                return;
            }

            let port = config.port;
            let addr = SocketAddr::from(([0, 0, 0, 0], port));

            let state = RemoteServerState {
                db,
                launcher,
                config_dir: PathBuf::from("config"),
                event_callback,
            };

            // Recherche dynamique du dossier PWA servi par le service builtin "remote_server"
            let mut pwa_dir = PathBuf::new();
            let manifests = crate::plugins::PluginManager::discover_manifests();
            for (manifest, plugin_dir) in &manifests {
                if manifest.builtin_service.as_deref() == Some("remote_server") {
                    let candidate = plugin_dir.join(manifest.ui.as_deref().unwrap_or("dist"));
                    if candidate.is_file() {
                        if let Some(parent) = candidate.parent() {
                            pwa_dir = parent.to_path_buf();
                            break;
                        }
                    } else if candidate.is_dir() {
                        pwa_dir = candidate;
                        break;
                    }
                }
            }
            if !pwa_dir.exists() {
                for base in &[
                    crate::paths::AppPaths::get_plugins_dir(),
                    crate::paths::AppPaths::get_dev_project_dir().join("plugins"),
                ] {
                    if let Ok(entries) = std::fs::read_dir(base) {
                        for entry in entries.flatten() {
                            let dist = entry.path().join("dist");
                            if dist.join("index.html").exists() {
                                pwa_dir = dist;
                                break;
                            }
                        }
                    }
                    if pwa_dir.exists() {
                        break;
                    }
                }
            }

            let cors = CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any);

            let api_routes = Router::new()
                .route("/api/auth/login", post(login_auth))
                .route("/api/gamepad/input", post(gamepad_input))
                .route("/api/status", get(get_status))
                .route("/api/system/info", get(get_system_info))
                .route("/api/games", get(get_games))
                .route("/api/games/recent", get(get_recent_games))
                .route("/api/games/:id", get(get_game_by_id))
                .route("/api/games/:id/favorite", post(toggle_game_favorite))
                .route("/api/games/:id/edit", post(update_game_details))
                .route("/api/games/launch", post(launch_game))
                .route("/api/games/stop", post(stop_game))
                .route("/api/games/add", post(add_game))
                .route("/api/systems", get(get_systems))
                .route("/api/emulators", get(get_emulators).post(save_emulators))
                .route("/api/emulators/test-path", post(test_emulator_path))
                .route("/api/gamepads", get(get_gamepad_mappings))
                .route("/api/settings", get(get_settings).post(save_settings))
                .route("/api/remote/config", get(get_remote_cfg).post(save_remote_cfg))
                .route("/api/kiosk/lock", post(lock_kiosk))
                .route("/api/kiosk/unlock", post(unlock_kiosk))
                .route("/api/media/cover", get(get_cover_image))
                .route("/api/console", post(console_exec))
                // Endpoints thèmes — lecture et modification à distance depuis l'admin réseau
                .route("/api/themes", get(remote_get_themes))
                .route("/api/themes/active", get(remote_get_active_theme).post(remote_set_active_theme))
                .route("/api/themes/:id", get(remote_get_theme).post(remote_save_theme).delete(remote_delete_theme))
                .route("/api/integrations", get(get_integrations))
                .route("/api/plugins", get(remote_get_plugins))
                .route("/api/plugins/:id/toggle", post(remote_toggle_plugin))
                .route("/api/plugins/:id/settings", get(remote_get_plugin_settings).put(remote_update_plugin_settings))
                .with_state(state.clone());

            let plugins_dir = {
                let dev_plugins = crate::paths::AppPaths::get_dev_project_dir().join("plugins");
                if dev_plugins.exists() {
                    dev_plugins
                } else {
                    let p = crate::paths::AppPaths::get_plugins_dir();
                    let _ = std::fs::create_dir_all(&p);
                    p
                }
            };

            let app = if pwa_dir.exists() {
                let index_file = pwa_dir.join("index.html");
                Router::new()
                    .merge(api_routes)
                    .nest_service("/plugins", ServeDir::new(&plugins_dir))
                    .fallback_service(ServeDir::new(&pwa_dir).fallback(ServeFile::new(index_file)))
                    .layer(cors)
            } else {
                Router::new()
                    .merge(api_routes)
                    .nest_service("/plugins", ServeDir::new(&plugins_dir))
                    .layer(cors)
            };

            let local_ip = get_local_ip();
            println!("🌐 Serveur distant KaïroOS démarré sur http://{}:{} (Accès PWA Mobile)", local_ip, port);

            match tokio::net::TcpListener::bind(addr).await {
                Ok(listener) => {
                    let shutdown_signal = async move {
                        let _ = shutdown_rx.await;
                        println!("🛑 Serveur distant KaïroOS arrêt gracieux...");
                    };
                    if let Err(err) = axum::serve(listener, app)
                        .with_graceful_shutdown(shutdown_signal)
                        .await
                    {
                        eprintln!("❌ Erreur d'exécution du serveur distant: {}", err);
                    }
                    println!("🛑 Serveur distant KaïroOS arrêté.");
                }
                Err(err) => {
                    eprintln!("❌ Impossible de lier le port {} pour le serveur distant: {}", port, err);
                }
            }
        });
    });

    (handle, shutdown_tx)
}

// ==================== HANDLERS REST ====================

/// Handler POST /api/console — exécute une commande shell whitelistée depuis l'admin distant
async fn console_exec(
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Vérification PIN
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "success": false, "error": "PIN invalide" })),
        );
    }

    let command = match body.get("command").and_then(|c| c.as_str()) {
        Some(c) => c.to_string(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "success": false, "error": "Champ 'command' manquant" })),
            );
        }
    };

    // Whitelist de commandes autorisées (séparateur : premier mot)
    let first_word = command.split_whitespace().next().unwrap_or("");
    let allowed = [
        "echo", "ping", "ipconfig", "ifconfig", "systeminfo",
        "tasklist", "taskkill", "dir", "ls", "cat", "type",
        "netstat", "whoami", "hostname", "ver", "uname",
        "cargo", "npm", "git", "powershell",
    ];
    if !allowed.contains(&first_word) {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "success": false,
                "error": format!("Commande '{}' non autorisée", first_word)
            })),
        );
    }

    // Exécution
    let output = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/C", &command])
            .output()
    } else {
        std::process::Command::new("sh")
            .args(["-c", &command])
            .output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let exit_code = out.status.code().unwrap_or(-1);
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "success": true,
                    "data": {
                        "stdout": stdout,
                        "stderr": stderr,
                        "exit_code": exit_code,
                        "command": command
                    }
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "error": format!("Échec d'exécution: {}", e)
            })),
        ),
    }
}

async fn get_status(State(state): State<RemoteServerState>) -> impl IntoResponse {
    let launch_status = state.launcher.get_status();
    let settings = state.db.get_app_settings().unwrap_or_default();
    let config = RemoteConfig::load();
    let local_ip = get_local_ip();

    let mut current_game_cover: Option<String> = None;
    if let Some(ref gid) = launch_status.current_game_id {
        if let Ok(Some(g)) = state.db.get_game_by_id(gid) {
            current_game_cover = g.cover_url;
        }
    }

    Json(StatusResponse {
        is_running: launch_status.is_running,
        current_game_id: launch_status.current_game_id,
        current_game_title: launch_status.current_game_title,
        current_system_id: launch_status.current_system_id,
        current_game_cover,
        elapsed_seconds: launch_status.elapsed_seconds,
        kiosk_mode: settings.kiosk_mode,
        port: config.port,
        local_ip,
        version: "26.1.0",
    })
}

async fn get_system_info(State(state): State<RemoteServerState>) -> impl IntoResponse {
    let settings = state.db.get_app_settings().unwrap_or_default();
    let config = RemoteConfig::load();
    let local_ip = get_local_ip();
    let total_games = state.db.get_all_games().map(|g| g.len()).unwrap_or(0);
    let install_dir = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".into());

    Json(SystemInfoResponse {
        local_ip,
        port: config.port,
        version: "26.1.0",
        install_dir,
        kiosk_mode: settings.kiosk_mode,
        total_games,
    })
}

async fn get_games(State(state): State<RemoteServerState>) -> impl IntoResponse {
    match state.db.get_all_games() {
        Ok(games) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(games), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn get_recent_games(State(state): State<RemoteServerState>) -> impl IntoResponse {
    match state.db.get_recently_played_games(5) {
        Ok(games) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(games), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn get_game_by_id(
    AxumPath(id): AxumPath<String>,
    State(state): State<RemoteServerState>,
) -> impl IntoResponse {
    match state.db.get_game_by_id(&id) {
        Ok(Some(game)) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(game), error: None })),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse { success: false, data: None, error: Some("Jeu introuvable".into()) }),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn toggle_game_favorite(
    AxumPath(id): AxumPath<String>,
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    match state.db.toggle_favorite(&id) {
        Ok(fav) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(fav), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn update_game_details(
    AxumPath(id): AxumPath<String>,
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(game_updated): Json<Game>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    if game_updated.id != id {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse { success: false, data: None, error: Some("L'ID du jeu ne correspond pas".into()) }),
        );
    }

    match state.db.update_game(&game_updated) {
        Ok(_) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(game_updated), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn launch_game(
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(req): Json<LaunchRequest>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    match state.launcher.launch_game_by_id(&req.game_id) {
        Ok(status) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(status), error: None })),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn stop_game(
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    match state.launcher.kill_current_game() {
        Ok(()) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some("Jeu arrêté"), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn add_game(
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(req): Json<AddGameRequest>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    let p = PathBuf::from(&req.path);
    let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
    let title = req.title.unwrap_or_else(|| {
        crate::scanner::RomScanner::clean_game_title(&file_name)
    });

    let now = chrono::Utc::now();
    let new_game = Game {
        id: uuid::Uuid::new_v4().to_string(),
        system_id: req.system_id,
        title,
        original_title: Some(file_name.clone()),
        file_path: req.path,
        file_name,
        file_size: 0,
        file_hash: None,
        franchise: None,
        cover_url: None,
        backdrop_url: None,
        logo_url: None,
        release_date: None,
        publisher: None,
        developer: None,
        genre: None,
        players: Some(1),
        rating: None,
        synopsis: None,
        favorite: false,
        hidden: false,
        play_count: 0,
        play_time_seconds: 0,
        last_played: None,
        created_at: now,
        updated_at: now,
    };

    match state.db.insert_game(&new_game) {
        Ok(()) => (StatusCode::CREATED, Json(ApiResponse { success: true, data: Some(new_game), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn get_systems(State(state): State<RemoteServerState>) -> impl IntoResponse {
    match state.db.get_systems() {
        Ok(systems) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(systems), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn get_emulators(State(state): State<RemoteServerState>) -> impl IntoResponse {
    match state.db.get_emulators() {
        Ok(emus) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(emus), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn save_emulators(
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(emulators): Json<Vec<Emulator>>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    for emu in &emulators {
        if let Err(e) = state.db.upsert_emulator(emu) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) }),
            );
        }
    }

    // Ecrire la configuration dans le dossier actif de l'application.
    let config_dir = crate::paths::AppPaths::get_config_dir();
    if let Ok(pretty) = serde_json::to_string_pretty(&emulators) {
        let _ = std::fs::write(config_dir.join("emulators.json"), &pretty);
    }

    state.notify(RemoteEvent::EmulatorsUpdated(emulators.clone()));
    (StatusCode::OK, Json(ApiResponse { success: true, data: Some(emulators), error: None }))
}

async fn get_settings(State(state): State<RemoteServerState>) -> impl IntoResponse {
    match state.db.get_app_settings() {
        Ok(settings) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(settings), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn save_settings(
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(new_settings): Json<AppSettings>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    match state.db.save_app_settings(&new_settings) {
        Ok(()) => {
            state.notify(RemoteEvent::SettingsUpdated(Box::new(new_settings.clone())));
            (StatusCode::OK, Json(ApiResponse { success: true, data: Some(new_settings), error: None }))
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

#[derive(Deserialize)]
pub struct IntegrationsQuery {
    pub host: Option<String>,
}

async fn get_integrations(
    Query(query): Query<IntegrationsQuery>,
) -> impl IntoResponse {
    let host_id = if let Some(h) = query.host {
        h
    } else {
        crate::plugins::PluginManager::discover_manifests()
            .into_iter()
            .find(|(m, _)| m.builtin_service.as_deref() == Some("remote_server"))
            .map(|(m, _)| m.id)
            .unwrap_or_default()
    };
    let contributions = crate::plugins::PluginManager::discover_contributions_for_host(&host_id);
    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            data: Some(contributions),
            error: None,
        }),
    )
}

async fn get_remote_cfg() -> impl IntoResponse {
    let config = RemoteConfig::load();
    Json(ApiResponse { success: true, data: Some(config), error: None })
}

async fn save_remote_cfg(
    headers: HeaderMap,
    Json(cfg): Json<RemoteConfig>,
) -> impl IntoResponse {
    let current_cfg = RemoteConfig::load();
    if !verify_pin(&headers, &current_cfg.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    match RemoteConfig::save(&cfg) {
        Ok(()) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(cfg), error: None })),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse { success: false, data: None, error: Some(err.to_string()) }),
        ),
    }
}

async fn lock_kiosk(
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN non valide".into()) }),
        );
    }

    let mut settings = state.db.get_app_settings().unwrap_or_default();
    settings.kiosk_mode = true;
    let _ = state.db.save_app_settings(&settings);
    state.notify(RemoteEvent::KioskChanged(true));
    state.notify(RemoteEvent::SettingsUpdated(Box::new(settings)));

    (StatusCode::OK, Json(ApiResponse { success: true, data: Some("Mode Kiosk activé"), error: None }))
}

async fn unlock_kiosk(
    State(state): State<RemoteServerState>,
    Json(req): Json<UnlockRequest>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if req.pin.trim() != config.pin.trim() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse { success: false, data: None, error: Some("Code PIN incorrect".into()) }),
        );
    }

    let mut settings = state.db.get_app_settings().unwrap_or_default();
    settings.kiosk_mode = false;
    let _ = state.db.save_app_settings(&settings);
    state.notify(RemoteEvent::KioskChanged(false));
    state.notify(RemoteEvent::SettingsUpdated(Box::new(settings)));

    (StatusCode::OK, Json(ApiResponse { success: true, data: Some("Mode Admin déverrouillé"), error: None }))
}

async fn get_cover_image(Query(query): Query<CoverQuery>) -> impl IntoResponse {
    let path = PathBuf::from(&query.path);
    if !path.exists() {
        return (StatusCode::NOT_FOUND, "Image non trouvée").into_response();
    }

    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let content_type = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    };

    match std::fs::read(&path) {
        Ok(bytes) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, content_type)],
            bytes,
        ).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Erreur lecture image").into_response(),
    }
}

async fn login_auth(Json(req): Json<LoginRequest>) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if req.pin.trim() == config.pin.trim() {
        let cookie_val = format!("kairo_pin={}; Path=/; SameSite=Lax; Max-Age=86400", config.pin.trim());
        let mut response_headers = HeaderMap::new();
        if let Ok(hv) = HeaderValue::from_str(&cookie_val) {
            response_headers.insert(header::SET_COOKIE, hv);
        }
        (
            StatusCode::OK,
            response_headers,
            Json(ApiResponse {
                success: true,
                data: Some("Authentification réussie"),
                error: None,
            }),
        ).into_response()
    } else {
        (
            StatusCode::UNAUTHORIZED,
            HeaderMap::new(),
            Json(ApiResponse::<&'static str> {
                success: false,
                data: None,
                error: Some("Code PIN non valide".into()),
            }),
        ).into_response()
    }
}

async fn gamepad_input(
    headers: HeaderMap,
    Json(req): Json<GamepadInputRequest>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse {
                success: false,
                data: None,
                error: Some("Code PIN non valide".into()),
            }),
        );
    }

    if let Some(vk) = map_player_button_to_vk(req.player_index, &req.button) {
        simulate_key_event(vk, req.is_down);
        (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                data: Some(format!("Input {} player {} (down={})", req.button, req.player_index + 1, req.is_down)),
                error: None,
            }),
        )
    } else {
        (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse {
                success: false,
                data: None,
                error: Some(format!("Bouton inconnu: {}", req.button)),
            }),
        )
    }
}

#[derive(Deserialize)]
struct TestPathRequest {
    path: String,
}

#[derive(Serialize)]
struct TestPathResponse {
    exists: bool,
    path: String,
    is_absolute: bool,
}

async fn test_emulator_path(
    Json(req): Json<TestPathRequest>,
) -> impl IntoResponse {
    let p = std::path::Path::new(&req.path);
    let exists = p.exists();
    let is_absolute = p.is_absolute();
    Json(ApiResponse {
        success: true,
        data: Some(TestPathResponse {
            exists,
            path: req.path,
            is_absolute,
        }),
        error: None,
    })
}

async fn get_gamepad_mappings(
    State(state): State<RemoteServerState>,
) -> impl IntoResponse {
    match state.db.get_gamepad_mappings() {
        Ok(mappings) => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                data: Some(mappings),
                error: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }),
        ),
    }
}

// ==================== HANDLERS THÈMES ====================

/// Retourne le chemin du dossier themes/ (même logique que dans commands.rs)
fn resolve_themes_dir_remote() -> PathBuf {
    let cur = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    if cur.ends_with("src-tauri") {
        if let Some(parent) = cur.parent() {
            let p = parent.join("themes");
            if p.exists() { return p; }
        }
    }
    let p_parent = cur.join("..").join("themes");
    if p_parent.exists() { return p_parent; }
    let p1 = cur.join("themes");
    if p1.exists() { return p1; }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p2 = parent.join("themes");
            if p2.exists() { return p2; }
            if let Some(grand) = parent.parent() {
                let p3 = grand.join("themes");
                if p3.exists() { return p3; }
            }
        }
    }
    p1
}

fn load_all_themes_from_disk(db: &crate::db::Database) -> Vec<crate::models::Theme> {
    let themes_dir = resolve_themes_dir_remote();
    let active_id = db.get_app_settings()
        .map(|s| s.theme)
        .unwrap_or_else(|_| "kairo-default".into());
    let mut themes = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&themes_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let json_path = entry.path().join("theme.json");
                if json_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&json_path) {
                        if let Ok(mut theme) = serde_json::from_str::<crate::models::Theme>(&content) {
                            let preview = entry.path().join("preview.png");
                            if preview.exists() {
                                theme.preview_url = Some(preview.to_string_lossy().to_string());
                            }
                            theme.is_active = theme.id == active_id;
                            themes.push(theme);
                        }
                    }
                }
            }
        }
    }
    if themes.is_empty() {
        let mut def = crate::models::Theme::default();
        def.id = "kairo-default".into();
        def.name = "Kaïro OS".into();
        def.is_active = true;
        themes.push(def);
    }
    themes
}

/// GET /api/themes — liste tous les thèmes installés
async fn remote_get_themes(State(state): State<RemoteServerState>) -> impl IntoResponse {
    let themes = load_all_themes_from_disk(&state.db);
    Json(ApiResponse { success: true, data: Some(themes), error: None })
}

/// GET /api/themes/active — retourne le thème actuellement actif
async fn remote_get_active_theme(State(state): State<RemoteServerState>) -> impl IntoResponse {
    let themes = load_all_themes_from_disk(&state.db);
    let active = themes.into_iter().find(|t| t.is_active);
    match active {
        Some(t) => (StatusCode::OK, Json(ApiResponse { success: true, data: Some(t), error: None })),
        None => (StatusCode::NOT_FOUND, Json(ApiResponse { success: false, data: None, error: Some("Aucun thème actif".into()) })),
    }
}

#[derive(Deserialize)]
struct SetActiveThemeRequest {
    id: String,
}

/// POST /api/themes/active — change le thème actif
async fn remote_set_active_theme(
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(req): Json<SetActiveThemeRequest>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (StatusCode::UNAUTHORIZED, Json(ApiResponse { success: false, data: None, error: Some("Code PIN requis".into()) }));
    }
    let themes_dir = resolve_themes_dir_remote();
    let json_path = themes_dir.join(&req.id).join("theme.json");
    if !json_path.exists() {
        return (StatusCode::NOT_FOUND, Json(ApiResponse { success: false, data: None, error: Some(format!("Thème '{}' introuvable", req.id)) }));
    }
    match state.db.get_app_settings() {
        Ok(mut settings) => {
            settings.theme = req.id.clone();
            let _ = state.db.save_app_settings(&settings);
            let content = std::fs::read_to_string(&json_path).unwrap_or_default();
            let mut theme: crate::models::Theme = serde_json::from_str(&content).unwrap_or_default();
            theme.is_active = true;
            state.notify(RemoteEvent::ThemeChanged(req.id.clone()));
            state.notify(RemoteEvent::SettingsUpdated(Box::new(settings)));
            (StatusCode::OK, Json(ApiResponse { success: true, data: Some(theme), error: None }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) })),
    }
}

/// GET /api/themes/:id — retourne les données d'un thème spécifique
async fn remote_get_theme(
    AxumPath(id): AxumPath<String>,
    State(state): State<RemoteServerState>,
) -> impl IntoResponse {
    let themes_dir = resolve_themes_dir_remote();
    let json_path = themes_dir.join(&id).join("theme.json");
    if !json_path.exists() {
        return (StatusCode::NOT_FOUND, Json(ApiResponse { success: false, data: None, error: Some(format!("Thème '{}' introuvable", id)) }));
    }
    match std::fs::read_to_string(&json_path) {
        Ok(content) => match serde_json::from_str::<crate::models::Theme>(&content) {
            Ok(mut theme) => {
                let active_id = state.db.get_app_settings().map(|s| s.theme).unwrap_or_default();
                theme.is_active = theme.id == active_id;
                (StatusCode::OK, Json(ApiResponse { success: true, data: Some(theme), error: None }))
            },
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) })),
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) })),
    }
}

/// POST /api/themes/:id — sauvegarde les modifications d'un thème (couleurs, layout, css…)
async fn remote_save_theme(
    AxumPath(id): AxumPath<String>,
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(mut theme): Json<crate::models::Theme>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (StatusCode::UNAUTHORIZED, Json(ApiResponse { success: false, data: None, error: Some("Code PIN requis".into()) }));
    }
    // Forcer l'ID depuis l'URL pour éviter les incohérences
    theme.id = id.clone();
    let themes_dir = resolve_themes_dir_remote();
    let theme_dir = themes_dir.join(&id);
    let _ = std::fs::create_dir_all(&theme_dir);
    let json_path = theme_dir.join("theme.json");
    match serde_json::to_string_pretty(&theme) {
        Ok(json) => match std::fs::write(&json_path, &json) {
            Ok(_) => {
                // Si le thème sauvegardé devient actif
                if theme.is_active {
                    if let Ok(mut settings) = state.db.get_app_settings() {
                        settings.theme = id.clone();
                        let _ = state.db.save_app_settings(&settings);
                        state.notify(RemoteEvent::ThemeChanged(id.clone()));
                        state.notify(RemoteEvent::SettingsUpdated(Box::new(settings)));
                    }
                }
                state.notify(RemoteEvent::ThemeUpdated(id));
                (StatusCode::OK, Json(ApiResponse { success: true, data: Some(theme), error: None }))
            },
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) })),
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) })),
    }
}

/// DELETE /api/themes/:id — supprime un thème du dossier themes/
async fn remote_delete_theme(
    AxumPath(id): AxumPath<String>,
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (StatusCode::UNAUTHORIZED, Json(ApiResponse::<String> { success: false, data: None, error: Some("Code PIN requis".into()) }));
    }
    if id == "kairo-default" {
        return (StatusCode::FORBIDDEN, Json(ApiResponse::<String> { success: false, data: None, error: Some("Le thème par défaut ne peut pas être supprimé".into()) }));
    }
    let themes_dir = resolve_themes_dir_remote();
    let theme_dir = themes_dir.join(&id);
    if theme_dir.exists() {
        match std::fs::remove_dir_all(&theme_dir) {
            Ok(_) => {
                state.notify(RemoteEvent::ThemeUpdated(id.clone()));
                (StatusCode::OK, Json(ApiResponse::<String> { success: true, data: Some(format!("Thème '{}' supprimé", id)), error: None }))
            },
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse::<String> { success: false, data: None, error: Some(e.to_string()) })),
        }
    } else {
        (StatusCode::NOT_FOUND, Json(ApiResponse::<String> { success: false, data: None, error: Some(format!("Thème '{}' introuvable", id)) }))
    }
}

/// GET /api/plugins — liste tous les plugins installés et leur statut
async fn remote_get_plugins() -> impl IntoResponse {
    let manifests = crate::plugins::PluginManager::discover_manifests();
    let config = crate::plugins::PluginManager::load_plugins_config();
    let list: Vec<crate::plugins::PluginInfo> = manifests
        .into_iter()
        .map(|(manifest, path)| {
            let rec = config.get(&manifest.id);
            let enabled = rec.map(|r| r.enabled).unwrap_or(true);
            crate::plugins::PluginInfo {
                id: manifest.id.clone(),
                name: manifest.name,
                version: manifest.version,
                author: manifest.author,
                plugin_type: manifest.plugin_type,
                description: manifest.description,
                enabled,
                running: enabled,
                required: manifest.required,
                depends_on: manifest.depends_on.clone(),
                permissions: manifest.permissions,
                commands: manifest.commands,
                ui: manifest.ui,
                has_settings: !manifest.settings_schema.is_empty(),
                settings_section: manifest.settings_section.clone(),
                host: manifest.host.clone(),
                contributes: manifest.contributes.clone(),
                path: path.to_string_lossy().to_string(),
            }
        })
        .collect();
    (StatusCode::OK, Json(ApiResponse { success: true, data: Some(list), error: None }))
}

/// POST /api/plugins/:id/toggle — active ou désactive un plugin
async fn remote_toggle_plugin(
    AxumPath(id): AxumPath<String>,
    headers: HeaderMap,
    State(state): State<RemoteServerState>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let config = RemoteConfig::load();
    if !verify_pin(&headers, &config.pin) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse {
                success: false,
                data: None,
                error: Some("Code PIN non valide".into()),
            }),
        );
    }
    let enabled = req.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
    let mut plugins_cfg = crate::plugins::PluginManager::load_plugins_config();
    let entry = plugins_cfg.entry(id.clone()).or_insert_with(|| crate::plugins::PluginConfigRecord {
        enabled: true,
        settings: std::collections::HashMap::new(),
    });
    entry.enabled = enabled;
    let _ = crate::plugins::PluginManager::save_plugins_config(&plugins_cfg);
    state.notify(RemoteEvent::PluginsUpdated);
    (StatusCode::OK, Json(ApiResponse { success: true, data: Some(enabled), error: None }))
}

/// GET /api/plugins/:id/settings — retourne les réglages d'un plugin
async fn remote_get_plugin_settings(
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    let config = crate::plugins::PluginManager::load_plugins_config();
    if let Some(rec) = config.get(&id) {
        (StatusCode::OK, Json(ApiResponse { success: true, data: Some(rec.settings.clone()), error: None }))
    } else {
        (StatusCode::NOT_FOUND, Json(ApiResponse::<std::collections::HashMap<String, serde_json::Value>> { success: false, data: None, error: Some(format!("Plugin '{}' introuvable", id)) }))
    }
}

/// PUT /api/plugins/:id/settings — met à jour les réglages d'un plugin (merge)
async fn remote_update_plugin_settings(
    AxumPath(id): AxumPath<String>,
    State(state): State<RemoteServerState>,
    Json(new_settings): Json<std::collections::HashMap<String, serde_json::Value>>,
) -> impl IntoResponse {
    let mut config = crate::plugins::PluginManager::load_plugins_config();
    let entry = config.entry(id.clone()).or_insert_with(|| crate::plugins::PluginConfigRecord {
        enabled: true,
        settings: std::collections::HashMap::new(),
    });
    for (k, v) in new_settings {
        entry.settings.insert(k, v);
    }
    match crate::plugins::PluginManager::save_plugins_config(&config) {
        Ok(_) => {
            state.notify(RemoteEvent::PluginsUpdated);
            (StatusCode::OK, Json(ApiResponse { success: true, data: Some("OK"), error: None }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse::<&str> { success: false, data: None, error: Some(e) })),
    }
}
