use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::paths::AppPaths;
use crate::db::Database;
use crate::launcher::Launcher;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PluginType {
    Builtin,
    Official,
    Community,
    Unverified,
}

impl Default for PluginType {
    fn default() -> Self {
        PluginType::Community
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSettingField {
    #[serde(rename = "type")]
    pub field_type: String, // "string" | "number" | "boolean"
    pub label: String,
    pub default: Value,
    #[serde(default)]
    pub secret: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct PluginHostConfig {
    pub protocol: String,
    #[serde(default)]
    pub discovers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct PluginContributesConfig {
    #[serde(default)]
    pub to: Vec<String>,
    #[serde(flatten)]
    pub points: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginContributionPayload {
    pub from: String,
    pub to: String,
    pub integration_point: String,
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSettingsSection {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    #[serde(default, rename = "type")]
    pub plugin_type: PluginType,
    pub description: String,
    #[serde(default)]
    pub min_kairo_version: Option<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub entry: Option<String>,
    #[serde(default)]
    pub ui: Option<String>,
    #[serde(default)]
    pub commands: Vec<String>,
    #[serde(default)]
    pub settings_section: Option<PluginSettingsSection>,
    #[serde(default)]
    pub settings_schema: HashMap<String, PluginSettingField>,
    #[serde(default)]
    pub sandbox: bool,
    #[serde(default)]
    pub host: Option<PluginHostConfig>,
    #[serde(default)]
    pub contributes: Option<PluginContributesConfig>,
    #[serde(default)]
    pub builtin_service: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfigRecord {
    pub enabled: bool,
    #[serde(default)]
    pub settings: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub plugin_type: PluginType,
    pub description: String,
    pub enabled: bool,
    pub running: bool,
    pub permissions: Vec<String>,
    pub commands: Vec<String>,
    pub ui: Option<String>,
    pub has_settings: bool,
    pub settings_section: Option<PluginSettingsSection>,
    pub host: Option<PluginHostConfig>,
    pub contributes: Option<PluginContributesConfig>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDetail {
    pub manifest: PluginManifest,
    pub enabled: bool,
    pub running: bool,
    pub settings: HashMap<String, Value>,
    pub path: String,
}

struct RunningProcess {
    child: Child,
    stdin: std::process::ChildStdin,
}

/// Gestionnaire centralisé des plugins KaïroOS
#[derive(Clone)]
pub struct PluginManager {
    db: Option<Database>,
    launcher: Option<Launcher>,
    processes: Arc<Mutex<HashMap<String, RunningProcess>>>,
    builtin_running: Arc<Mutex<HashMap<String, bool>>>,
    /// Canaux de shutdown pour services builtin (clé = id du plugin)
    builtin_shutdown_txs: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>>,
    remote_event_callback: Arc<Mutex<Option<crate::remote::RemoteEventCallback>>>,
}

impl PluginManager {
    pub fn new(db: Option<Database>, launcher: Option<Launcher>) -> Self {
        Self {
            db,
            launcher,
            processes: Arc::new(Mutex::new(HashMap::new())),
            builtin_running: Arc::new(Mutex::new(HashMap::new())),
            builtin_shutdown_txs: Arc::new(Mutex::new(HashMap::new())),
            remote_event_callback: Arc::new(Mutex::new(None)),
        }
    }

    /// Enregistre un callback global recevant les événements du serveur distant (pour Tauri IPC)
    pub fn set_remote_event_callback(&self, cb: crate::remote::RemoteEventCallback) {
        *self.remote_event_callback.lock().unwrap() = Some(cb);
    }

    /// Chemin vers le fichier `config/plugins.json`
    pub fn get_config_file_path() -> PathBuf {
        AppPaths::get_config_dir().join("plugins.json")
    }

    /// Charge la configuration de persistance des plugins
    pub fn load_plugins_config() -> HashMap<String, PluginConfigRecord> {
        let path = Self::get_config_file_path();
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(records) = serde_json::from_str::<HashMap<String, PluginConfigRecord>>(&content) {
                    return records;
                }
            }
        }

        // Configuration initiale par défaut générée dynamiquement selon les manifests découverts
        let mut defaults = HashMap::new();
        for (manifest, _) in Self::discover_manifests() {
            let mut s = HashMap::new();
            for (k, field) in &manifest.settings_schema {
                s.insert(k.clone(), field.default.clone());
            }
            defaults.insert(
                manifest.id,
                PluginConfigRecord {
                    enabled: true,
                    settings: s,
                },
            );
        }
        let _ = Self::save_plugins_config(&defaults);
        defaults
    }

    /// Sauvegarde la configuration de persistance
    pub fn save_plugins_config(config: &HashMap<String, PluginConfigRecord>) -> Result<(), String> {
        let path = Self::get_config_file_path();
        let json_str = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        std::fs::write(&path, json_str).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Trouve tous les manifests de plugins installés
    pub fn discover_manifests() -> Vec<(PluginManifest, PathBuf)> {
        let mut results = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        for search_dir in AppPaths::get_plugins_search_dirs() {
            if let Ok(entries) = std::fs::read_dir(&search_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let manifest_path = path.join("plugin.json");
                        if manifest_path.exists() {
                            if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                                match serde_json::from_str::<PluginManifest>(&content) {
                                    Ok(manifest) => {
                                        if !seen_ids.contains(&manifest.id) {
                                            seen_ids.insert(manifest.id.clone());
                                            results.push((manifest, path));
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("⚠️ [PluginManager] Erreur parsing manifest {:?}: {}", manifest_path, e);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        results
    }

    /// Liste tous les plugins avec leur statut
    pub fn list_plugins(&self) -> Vec<PluginInfo> {
        let manifests = Self::discover_manifests();
        let config = Self::load_plugins_config();
        let mut processes = self.processes.lock().unwrap();
        // Nettoyer les processus terminés
        processes.retain(|_id, proc| {
            match proc.child.try_wait() {
                Ok(Some(_)) => false,
                Ok(None) => true,
                Err(_) => false,
            }
        });
        let builtin = self.builtin_running.lock().unwrap();

        manifests
            .into_iter()
            .map(|(manifest, path)| {
                let rec = config.get(&manifest.id);
                let enabled = rec.map(|r| r.enabled).unwrap_or(true);
                let is_running = if manifest.plugin_type == PluginType::Builtin {
                    *builtin.get(&manifest.id).unwrap_or(&enabled)
                } else {
                    processes.contains_key(&manifest.id)
                };

                PluginInfo {
                    id: manifest.id.clone(),
                    name: manifest.name,
                    version: manifest.version,
                    author: manifest.author,
                    plugin_type: manifest.plugin_type,
                    description: manifest.description,
                    enabled,
                    running: is_running,
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
            .collect()
    }

    /// Récupère les détails d'un plugin
    pub fn get_plugin(&self, id: &str) -> Option<PluginDetail> {
        let manifests = Self::discover_manifests();
        let (manifest, path) = manifests.into_iter().find(|(m, _)| m.id == id)?;
        let config = Self::load_plugins_config();
        let rec = config.get(id);

        let enabled = rec.map(|r| r.enabled).unwrap_or(true);
        let settings = rec.map(|r| r.settings.clone()).unwrap_or_else(|| {
            manifest
                .settings_schema
                .iter()
                .map(|(k, v)| (k.clone(), v.default.clone()))
                .collect()
        });

        let is_running = if manifest.plugin_type == PluginType::Builtin {
            *self.builtin_running.lock().unwrap().get(id).unwrap_or(&enabled)
        } else {
            self.processes.lock().unwrap().contains_key(id)
        };

        Some(PluginDetail {
            manifest,
            enabled,
            running: is_running,
            settings,
            path: path.to_string_lossy().to_string(),
        })
    }

    /// Démarre un plugin
    pub fn start_plugin(&self, id: &str) -> Result<(), String> {
        let manifests = Self::discover_manifests();
        let (manifest, path) = manifests
            .into_iter()
            .find(|(m, _)| m.id == id)
            .ok_or_else(|| format!("Plugin '{}' introuvable", id))?;

        // 1. Cas d'un service builtin interne (ex: remote_server)
        if let Some(service_type) = &manifest.builtin_service {
            match service_type.as_str() {
                "remote_server" => {
                    if let (Some(db), Some(launcher)) = (&self.db, &self.launcher) {
                        let cb = self.remote_event_callback.lock().unwrap().clone();
                        let (_handle, shutdown_tx) = crate::remote::start_remote_server_with_shutdown(
                            db.clone(),
                            launcher.clone(),
                            cb,
                        );
                        self.builtin_shutdown_txs.lock().unwrap().insert(id.to_string(), shutdown_tx);
                    }
                }
                _ => {
                    eprintln!("⚠️ [PluginManager] Type de service builtin inconnu: {}", service_type);
                }
            }
            self.builtin_running.lock().unwrap().insert(id.to_string(), true);
            println!("✅ [PluginManager] Service builtin '{}' ({}) démarré.", id, service_type);

            // Découverte universelle : notifier l'hôte de ses contributeurs
            self.notify_host_of_contributions(id);
            return Ok(());
        }

        // 2. Cas d'un processus externe supervisé
        let entry_rel = match &manifest.entry {
            Some(e) if !e.trim().is_empty() => e.trim(),
            _ => return Ok(()), // Plugin purement déclaratif ou UI
        };

        let entry_path = path.join(entry_rel);
        if !entry_path.exists() {
            return Err(format!("Point d'entrée introuvable: {}", entry_path.display()));
        }

        let mut cmd = if entry_rel.ends_with(".js") {
            let node_bin = if std::path::Path::new(r"C:\Program Files\nodejs\node.exe").exists() {
                r"C:\Program Files\nodejs\node.exe"
            } else {
                "node"
            };
            let mut c = Command::new(node_bin);
            c.arg(&entry_path);
            c
        } else if entry_rel.ends_with(".py") {
            let mut c = Command::new("python");
            c.arg(&entry_path);
            c
        } else {
            Command::new(&entry_path)
        };

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        cmd.current_dir(&path);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            let err_msg = format!("Échec du lancement du plugin {}: {}", id, e);
            AppPaths::log("ERROR", &err_msg);
            err_msg
        })?;
        let stdin = child.stdin.take().ok_or("Impossible d'attacher stdin au plugin")?;
        let stdout = child.stdout.take().ok_or("Impossible d'attacher stdout au plugin")?;
        let stderr = child.stderr.take();

        if let Some(err_stream) = stderr {
            let plugin_err_id = id.to_string();
            std::thread::spawn(move || {
                let reader = BufReader::new(err_stream);
                for line in reader.lines().flatten() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        AppPaths::log("PLUGIN_STDERR", &format!("[{}] {}", plugin_err_id, trimmed));
                    }
                }
            });
        }

        // Enregistre le processus supervisé
        self.processes.lock().unwrap().insert(
            id.to_string(),
            RunningProcess { child, stdin },
        );
        AppPaths::log("INFO", &format!("Plugin '{}' lancé avec succès.", id));

        // Notifier si cet hôte a des contributions en attente
        self.notify_host_of_contributions(id);

        // Notifier les autres hôtes si ce nouveau plugin contribue à eux
        self.notify_hosts_when_contributor_starts(&manifest);

        // Thread de lecture des messages JSON stdout émis par le plugin (IPC)
        let plugin_id = id.to_string();
        let permissions = manifest.permissions.clone();
        let launcher_opt = self.launcher.clone();

        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
                    if let Some(action) = val.get("action").and_then(|a| a.as_str()) {
                        match action {
                            "launch_game" => {
                                if !permissions.contains(&"launch_games".to_string()) {
                                    eprintln!(
                                        "⚠️ [PluginManager] Refus: le plugin '{}' a tenté 'launch_game' sans permission 'launch_games'",
                                        plugin_id
                                    );
                                    continue;
                                }
                                if let Some(game_id) = val.get("game_id").and_then(|g| g.as_str()) {
                                    if let Some(launcher) = &launcher_opt {
                                        let _ = launcher.launch_game_by_id(game_id);
                                    }
                                }
                            }
                            "notify" => {
                                if !permissions.contains(&"notifications".to_string()) {
                                    eprintln!(
                                        "⚠️ [PluginManager] Refus: le plugin '{}' a tenté 'notify' sans permission 'notifications'",
                                        plugin_id
                                    );
                                    continue;
                                }
                                println!("📢 [Plugin Notification - {}] {:?}", plugin_id, val.get("message"));
                            }
                            _ => {}
                        }
                    }
                }
            }
        });

        println!("✅ [PluginManager] Plugin '{}' lancé avec succès (processus enfant).", id);
        Ok(())
    }

    pub fn stop_plugin(&self, id: &str) -> Result<(), String> {
        {
            let mut processes = self.processes.lock().unwrap();
            if let Some(mut proc) = processes.remove(id) {
                let _ = proc.child.kill();
                println!("🛑 [PluginManager] Processus enfant du plugin '{}' terminé.", id);
            }
        }

        // Si c'est un service builtin : envoyer le signal d'arrêt
        if let Some(tx) = self.builtin_shutdown_txs.lock().unwrap().remove(id) {
            let _ = tx.send(());
            println!("🛑 [PluginManager] Signal d'arrêt envoyé au service builtin '{}'.", id);
        }

        {
            let mut builtin = self.builtin_running.lock().unwrap();
            builtin.insert(id.to_string(), false);
        }
        println!("🛑 [PluginManager] Plugin '{}' arrêté.", id);

        // Notifier les hôtes concernés du retrait de ce contributeur
        self.notify_hosts_when_contributor_stops(id);

        Ok(())
    }

    /// Redémarre un plugin
    pub fn restart_plugin(&self, id: &str) -> Result<(), String> {
        self.stop_plugin(id)?;
        // Attendre que le port TCP soit libéré avant de rebinder
        std::thread::sleep(std::time::Duration::from_millis(500));
        self.start_plugin(id)?;
        Ok(())
    }

    /// Redémarre tous les plugins fournissant un service builtin donné (ex: "remote_server")
    pub fn restart_by_builtin_service(&self, service_type: &str) {
        let manifests = Self::discover_manifests();
        for (m, _) in manifests {
            if m.builtin_service.as_deref() == Some(service_type) {
                let _ = self.restart_plugin(&m.id);
            }
        }
    }

    /// Active un plugin et enregistre son activation
    pub fn enable_plugin(&self, id: &str) -> Result<(), String> {
        let mut config = Self::load_plugins_config();
        let entry = config.entry(id.to_string()).or_insert_with(|| PluginConfigRecord {
            enabled: true,
            settings: HashMap::new(),
        });
        entry.enabled = true;
        Self::save_plugins_config(&config)?;
        self.start_plugin(id)?;
        Ok(())
    }

    /// Désactive un plugin et enregistre son état inactif
    pub fn disable_plugin(&self, id: &str) -> Result<(), String> {
        let mut config = Self::load_plugins_config();
        if let Some(entry) = config.get_mut(id) {
            entry.enabled = false;
        } else {
            config.insert(
                id.to_string(),
                PluginConfigRecord {
                    enabled: false,
                    settings: HashMap::new(),
                },
            );
        }
        Self::save_plugins_config(&config)?;
        self.stop_plugin(id)?;
        Ok(())
    }

    /// Met à jour les paramètres de configuration d'un plugin
    pub fn update_plugin_settings(&self, id: &str, new_settings: HashMap<String, Value>) -> Result<(), String> {
        let mut config = Self::load_plugins_config();
        {
            let entry = config.entry(id.to_string()).or_insert_with(|| PluginConfigRecord {
                enabled: true,
                settings: HashMap::new(),
            });
            for (k, v) in new_settings {
                entry.settings.insert(k, v);
            }
        }
        Self::save_plugins_config(&config)?;

        // Redémarre si actuellement en cours
        let _ = self.restart_plugin(id);
        Ok(())
    }

    /// Envoie un événement JSON sur le stdin d'un processus plugin hôte
    pub fn send_event_to_plugin(&self, plugin_id: &str, event_json: &Value) -> bool {
        let mut processes = self.processes.lock().unwrap();
        if let Some(proc) = processes.get_mut(plugin_id) {
            use std::io::Write;
            if let Ok(json_line) = serde_json::to_string(event_json) {
                if writeln!(proc.stdin, "{}", json_line).is_ok() {
                    let _ = proc.stdin.flush();
                    return true;
                }
            }
        }
        false
    }

    /// Découvre toutes les contributions destinées à un plugin hôte donné
    pub fn discover_contributions_for_host(host_id: &str) -> Vec<PluginContributionPayload> {
        let manifests = Self::discover_manifests();
        let config = Self::load_plugins_config();

        let host_manifest = match manifests.iter().find(|(m, _)| m.id == host_id) {
            Some((m, _)) => m,
            None => return Vec::new(),
        };

        let host_cfg = match &host_manifest.host {
            Some(h) => h,
            None => return Vec::new(),
        };

        let mut results = Vec::new();

        for (contrib_manifest, _) in &manifests {
            if contrib_manifest.id == host_id {
                continue;
            }

            let is_enabled = config
                .get(&contrib_manifest.id)
                .map(|c| c.enabled)
                .unwrap_or(true);

            if !is_enabled {
                continue;
            }

            if let Some(contributes) = &contrib_manifest.contributes {
                if contributes.to.iter().any(|t| t == host_id) {
                    for point in &host_cfg.discovers {
                        let point_data = contributes.points.get(point).or_else(|| {
                            contributes.points.get("points").and_then(|nested| nested.get(point))
                        });
                        if let Some(data) = point_data {
                            results.push(PluginContributionPayload {
                                from: contrib_manifest.id.clone(),
                                to: host_id.to_string(),
                                integration_point: point.clone(),
                                data: data.clone(),
                            });
                        }
                    }
                }
            }
        }

        results
    }

    /// Découvre toutes les contributions destinées à un plugin hôte donné (sur l'instance)
    pub fn get_contributions_for_host(&self, host_id: &str) -> Vec<PluginContributionPayload> {
        Self::discover_contributions_for_host(host_id)
    }

    /// Notifie un plugin hôte de toutes les contributions existantes à son démarrage
    fn notify_host_of_contributions(&self, host_id: &str) {
        let contributions = self.get_contributions_for_host(host_id);
        for item in contributions {
            let event = serde_json::json!({
                "event": "plugin_contributes",
                "from": item.from,
                "integration_point": item.integration_point,
                "data": item.data
            });
            self.send_event_to_plugin(host_id, &event);
        }
    }

    /// Notifie tous les hôtes concernés lorsqu'un plugin contributeur démarre
    fn notify_hosts_when_contributor_starts(&self, contrib_manifest: &PluginManifest) {
        if let Some(contributes) = &contrib_manifest.contributes {
            let manifests = Self::discover_manifests();
            for target_host_id in &contributes.to {
                if let Some((host_manifest, _)) = manifests.iter().find(|(m, _)| &m.id == target_host_id) {
                    if let Some(host_cfg) = &host_manifest.host {
                        for point in &host_cfg.discovers {
                            let point_data = contributes.points.get(point).or_else(|| {
                                contributes.points.get("points").and_then(|nested| nested.get(point))
                            });
                            if let Some(data) = point_data {
                                let event = serde_json::json!({
                                    "event": "plugin_contributes",
                                    "from": contrib_manifest.id,
                                    "integration_point": point,
                                    "data": data
                                });
                                self.send_event_to_plugin(target_host_id, &event);
                            }
                        }
                    }
                }
            }
        }
    }

    /// Notifie tous les hôtes concernés lorsqu'un plugin contributeur s'arrête
    fn notify_hosts_when_contributor_stops(&self, contributor_id: &str) {
        let manifests = Self::discover_manifests();
        let contrib_manifest = match manifests.iter().find(|(m, _)| m.id == contributor_id) {
            Some((m, _)) => m,
            None => return,
        };

        if let Some(contributes) = &contrib_manifest.contributes {
            for target_host_id in &contributes.to {
                let event = serde_json::json!({
                    "event": "plugin_removed",
                    "from": contributor_id
                });
                self.send_event_to_plugin(target_host_id, &event);
            }
        }
    }

    /// Désinstalle un plugin (supprime son dossier et ses données)
    pub fn uninstall_plugin(&self, id: &str) -> Result<(), String> {
        let manifests = Self::discover_manifests();
        let (manifest, path) = manifests
            .into_iter()
            .find(|(m, _)| m.id == id)
            .ok_or_else(|| format!("Plugin '{}' introuvable", id))?;

        if manifest.plugin_type == PluginType::Builtin {
            return Err("Impossible de désinstaller un plugin système builtin.".into());
        }

        // 1. Arrêter le plugin
        let _ = self.stop_plugin(id);

        // 2. Supprimer de la config
        let mut config = Self::load_plugins_config();
        config.remove(id);
        let _ = Self::save_plugins_config(&config);

        // 3. Supprimer le dossier sur le disque
        std::fs::remove_dir_all(&path).map_err(|e| format!("Échec de suppression du dossier: {}", e))?;
        println!("🗑️ [PluginManager] Plugin '{}' désinstallé avec succès.", id);
        Ok(())
    }

    /// Exécute une commande exposée par un plugin
    pub fn run_plugin_command(&self, id: &str, command: &str) -> Result<String, String> {
        match command {
            "start" => {
                self.start_plugin(id)?;
                Ok("Plugin démarré avec succès".into())
            }
            "stop" => {
                self.stop_plugin(id)?;
                Ok("Plugin arrêté avec succès".into())
            }
            "restart" => {
                self.restart_plugin(id)?;
                Ok("Plugin redémarré avec succès".into())
            }
            "status" => {
                let detail = self.get_plugin(id).ok_or_else(|| format!("Plugin '{}' introuvable", id))?;
                let status_str = if detail.running { "Actif (running)" } else { "Arrêté (stopped)" };
                Ok(status_str.into())
            }
            custom => {
                // Envoie la commande au processus supervisé via stdin JSON
                let mut processes = self.processes.lock().unwrap();
                if let Some(proc) = processes.get_mut(id) {
                    let msg = serde_json::json!({ "command": custom });
                    let msg_str = format!("{}\n", msg);
                    proc.stdin.write_all(msg_str.as_bytes()).map_err(|e| e.to_string())?;
                    proc.stdin.flush().map_err(|e| e.to_string())?;
                    Ok(format!("Commande '{}' transmise au plugin", custom))
                } else {
                    Err(format!("Le plugin '{}' n'est pas en cours d'exécution", id))
                }
            }
        }
    }

    /// Extrait un ZIP de plugin dans un dossier temporaire et lit son manifest
    pub fn stage_plugin_zip(zip_path: &str) -> Result<PluginManifest, String> {
        let zip = std::path::Path::new(zip_path);
        if !zip.exists() {
            return Err(format!("Fichier ZIP introuvable: {}", zip_path));
        }
        let plugins_dir = AppPaths::get_plugins_dir();
        let staging_dir = plugins_dir.join("_temp_staging");
        let _ = std::fs::remove_dir_all(&staging_dir);
        let _ = std::fs::create_dir_all(&staging_dir);

        #[cfg(windows)]
        {
            let cmd = format!("Expand-Archive -Path '{}' -DestinationPath '{}' -Force", zip_path, staging_dir.display());
            let status = std::process::Command::new("powershell")
                .args(["-Command", &cmd])
                .status()
                .map_err(|e| e.to_string())?;
            if !status.success() {
                return Err("Échec de l'extraction de l'archive du plugin".into());
            }
        }

        for entry in walkdir::WalkDir::new(&staging_dir).into_iter().flatten() {
            if entry.file_name() == "plugin.json" {
                let content = std::fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
                let manifest: PluginManifest = serde_json::from_str(&content).map_err(|e| e.to_string())?;
                return Ok(manifest);
            }
        }

        Err("Aucun fichier plugin.json trouvé dans l'archive".into())
    }

    /// Clone un dépôt Git de plugin dans un dossier temporaire et lit son manifest
    pub fn stage_plugin_git(url: &str) -> Result<PluginManifest, String> {
        let plugins_dir = AppPaths::get_plugins_dir();
        let staging_dir = plugins_dir.join("_temp_staging");
        let _ = std::fs::remove_dir_all(&staging_dir);
        let _ = std::fs::create_dir_all(&staging_dir);

        // 1. Tenter un clone avec git s'il est disponible
        let git_status = std::process::Command::new("git")
            .args(["clone", "--depth", "1", url, staging_dir.to_str().unwrap()])
            .status();

        let cloned = match git_status {
            Ok(s) if s.success() => true,
            _ => false,
        };

        // 2. Si git n'est pas disponible ou échoue, télécharger l'archive zip GitHub via PowerShell
        if !cloned {
            #[cfg(windows)]
            {
                let clean_url = url.trim().trim_end_matches(".git").trim_end_matches('/');
                let zip_url_main = format!("{}/archive/refs/heads/main.zip", clean_url);
                let zip_file = plugins_dir.join("_temp_download.zip");
                let ps_cmd = format!(
                    "try {{ Invoke-WebRequest -Uri '{}' -OutFile '{}' -ErrorAction Stop }} catch {{ Invoke-WebRequest -Uri '{}/archive/refs/heads/master.zip' -OutFile '{}' -ErrorAction Stop }}; Expand-Archive -Path '{}' -DestinationPath '{}' -Force; Remove-Item '{}' -Force -ErrorAction SilentlyContinue",
                    zip_url_main, zip_file.display(), clean_url, zip_file.display(), zip_file.display(), staging_dir.display(), zip_file.display()
                );
                let status = std::process::Command::new("powershell")
                    .args(["-Command", &ps_cmd])
                    .status()
                    .map_err(|e| format!("Échec du téléchargement du dépôt: {}", e))?;
                if !status.success() {
                    return Err("Échec du clonage Git et du téléchargement de l'archive GitHub".into());
                }
            }
        }

        for entry in walkdir::WalkDir::new(&staging_dir).into_iter().flatten() {
            if entry.file_name() == "plugin.json" {
                let content = std::fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
                let mut manifest: PluginManifest = serde_json::from_str(&content).map_err(|e| e.to_string())?;
                if manifest.plugin_type != PluginType::Builtin && manifest.plugin_type != PluginType::Official {
                    manifest.plugin_type = PluginType::Unverified;
                }
                return Ok(manifest);
            }
        }

        Err("Aucun fichier plugin.json trouvé dans le dépôt cloné".into())
    }

    /// Confirme l'installation du plugin depuis le dossier temporaire
    pub fn confirm_install(&self, plugin_id: &str) -> Result<(), String> {
        let plugins_dir = AppPaths::get_plugins_dir();
        let staging_dir = plugins_dir.join("_temp_staging");
        let target_dir = plugins_dir.join(plugin_id);

        let mut found_dir = None;
        for entry in walkdir::WalkDir::new(&staging_dir).into_iter().flatten() {
            if entry.file_name() == "plugin.json" {
                found_dir = entry.path().parent().map(|p| p.to_path_buf());
                break;
            }
        }

        let src = found_dir.ok_or_else(|| "Fichiers de plugin non trouvés en staging".to_string())?;
        let _ = std::fs::remove_dir_all(&target_dir);
        AppPaths::copy_dir_recursive(&src, &target_dir).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_dir_all(&staging_dir);

        self.enable_plugin(plugin_id)?;
        Ok(())
    }

    /// Initialise et démarre automatiquement tous les plugins configurés comme actifs
    pub fn auto_start_enabled_plugins(&self) {
        let config = Self::load_plugins_config();
        let manifests = Self::discover_manifests();

        for (manifest, _) in manifests {
            let is_enabled = config.get(&manifest.id).map(|r| r.enabled).unwrap_or(true);
            if is_enabled {
                if let Err(e) = self.start_plugin(&manifest.id) {
                    let err_msg = format!("Erreur au démarrage du plugin '{}': {}", manifest.id, e);
                    eprintln!("⚠️ [PluginManager] {}", err_msg);
                    AppPaths::log("ERROR", &format!("[PluginManager] {}", err_msg));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_parsing() {
        let raw = r#"{
            "id": "test-plugin",
            "name": "Test Plugin",
            "version": "1.0.0",
            "author": "Tester",
            "type": "community",
            "description": "Un plugin de test",
            "permissions": ["read_games", "network"],
            "entry": "index.js",
            "commands": ["start", "stop", "ping"],
            "settings_schema": {
                "port": {
                    "type": "number",
                    "label": "Port réseau",
                    "default": 9000
                }
            },
            "sandbox": true
        }"#;

        let manifest: PluginManifest = serde_json::from_str(raw).expect("Parsing valid plugin.json");
        assert_eq!(manifest.id, "test-plugin");
        assert_eq!(manifest.plugin_type, PluginType::Community);
        assert_eq!(manifest.permissions.len(), 2);
        assert!(manifest.permissions.contains(&"read_games".to_string()));
        assert_eq!(manifest.settings_schema.len(), 1);
        assert_eq!(manifest.commands, vec!["start", "stop", "ping"]);
    }

    #[test]
    fn test_builtin_config_records() {
        let mut map = HashMap::new();
        map.insert(
            "sample-plugin".to_string(),
            PluginConfigRecord {
                enabled: true,
                settings: HashMap::new(),
            },
        );

        let json = serde_json::to_string(&map).unwrap();
        let parsed: HashMap<String, PluginConfigRecord> = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("sample-plugin").unwrap().enabled);
    }

    #[test]
    fn test_host_and_contributor_protocol_parsing() {
        let host_json = r#"{
            "id": "my-host",
            "name": "Host Plugin",
            "version": "1.0.0",
            "author": "Tester",
            "description": "Host test",
            "host": {
                "protocol": "kairo-plugin-host-v1",
                "discovers": ["remote_settings_page", "remote_api_routes"]
            }
        }"#;

        let host_manifest: PluginManifest = serde_json::from_str(host_json).unwrap();
        let host_cfg = host_manifest.host.unwrap();
        assert_eq!(host_cfg.protocol, "kairo-plugin-host-v1");
        assert_eq!(host_cfg.discovers, vec!["remote_settings_page", "remote_api_routes"]);

        let contrib_json = r#"{
            "id": "my-achievements",
            "name": "Achievements",
            "version": "1.0.0",
            "author": "Tester",
            "description": "Contributor test",
            "contributes": {
                "to": ["my-host"],
                "remote_settings_page": {
                    "label": "Succès & Trophées",
                    "ui": "achievements.html"
                },
                "remote_api_routes": {
                    "routes": [
                        { "path": "/achievements", "handler": "get_achievements" }
                    ]
                }
            }
        }"#;

        let contrib_manifest: PluginManifest = serde_json::from_str(contrib_json).unwrap();
        let contrib_cfg = contrib_manifest.contributes.unwrap();
        assert_eq!(contrib_cfg.to, vec!["my-host"]);
        assert!(contrib_cfg.points.contains_key("remote_settings_page"));
        assert!(contrib_cfg.points.contains_key("remote_api_routes"));
    }

    #[test]
    fn test_plugin_discovery_and_detail() {
        let pm = PluginManager::new(None, None);
        let list = pm.list_plugins();
        assert!(!list.is_empty());
        let remote = pm.get_plugin("kairo-remote");
        assert!(remote.is_some());
        let scraper = pm.get_plugin("kairo-scraper");
        assert!(scraper.is_some());
    }
}
