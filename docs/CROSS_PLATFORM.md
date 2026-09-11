# 🌍 Guide Cross-Platform — Portabilité de KaïroOS

Ce document détaille les adaptations nécessaires pour porter KaïroOS sur Linux, macOS et Android, ainsi que la création du binaire CLI.

---

## 📊 Vue d'Ensemble

KaïroOS est construit sur une architecture 3 couches qui facilite la portabilité :

| Couche | Technologie | Dépendances OS |
|--------|-------------|----------------|
| **Core métier** (`kairo-core`) | Rust pur | 1 dépendance Windows (`windows-sys`) |
| **Bridge IPC** (`src-tauri`) | Tauri 2 | Cross-platform nativement |
| **Frontend UI** (`src/`) | React 19 + TypeScript | 100% web, aucun code natif |

---

## 🔧 Adaptations Détailées

### 1. Système de Chemins (`kairo-core/src/paths.rs`)

**Problème** : Utilisation de `%APPDATA%` pour les chemins de configuration.

**Solution** : Abstraction multi-OS via le crate `dirs` ou `directories` :

```rust
// Avant (Windows-only)
let appdata = std::env::var("APPDATA")?;
let config_dir = PathBuf::from(appdata).join("kairo-os");

// Après (cross-platform)
use directories::ProjectDirs;
let proj_dirs = ProjectDirs::from("", "", "kairo-os").unwrap();
let config_dir = proj_dirs.config_dir().to_path_buf();
// Linux: ~/.config/kairo-os
// macOS: ~/Library/Application Support/kairo-os
// Windows: C:\Users\<user>\AppData\Roaming\kairo-os
```

**Fichiers concernés** :
- `crates/kairo-core/src/paths.rs` (principal)
- `crates/kairo-core/src/lib.rs` (import)

---

### 2. Input Global (`windows-sys` → `rdev`)

**Problème** : `GetAsyncKeyState` et `SendInput` sont Windows-only.

**Solution** : Utiliser le crate `rdev` (cross-platform) :

```rust
// Avant (Windows-only)
#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

// Après (cross-platform)
use rdev::{listen, simulate, Event, Key, EventType};
```

**Fichiers concernés** :
- `crates/kairo-core/src/launcher/mod.rs` (polling clavier combo arcade)
- `crates/kairo-core/src/remote/mod.rs` (simulation touches gamepad distant)

---

### 3. Noms d'Exécutables Émulateurs

**Problème** : 53 occurrences de `.exe` dans le code.

**Solution** : Structurer `emulators.json` avec des profils par OS :

```json
{
  "retroarch": {
    "name": "RetroArch",
    "platforms": {
      "windows": "retroarch.exe",
      "linux": "retroarch",
      "macos": "/Applications/RetroArch.app/Contents/MacOS/RetroArch"
    }
  }
}
```

**Fichiers concernés** :
- `config/emulators.json`
- `crates/kairo-core/src/launcher/mod.rs`

---

### 4. Ouverture de Dossiers

**Problème** : Utilisation de `explorer` (Windows-only).

**Solution** : Branchement par OS :

```rust
#[cfg(windows)]
fn open_folder(path: &Path) {
    std::process::Command::new("explorer").arg(path).spawn().ok();
}

#[cfg(target_os = "linux")]
fn open_folder(path: &Path) {
    std::process::Command::new("xdg-open").arg(path).spawn().ok();
}

#[cfg(target_os = "macos")]
fn open_folder(path: &Path) {
    std::process::Command::new("open").arg(path).spawn().ok();
}
```

**Fichiers concernés** :
- `src-tauri/src/commands.rs` (3 fonctions `open_*_folder`)

---

### 5. Gestion ZIP sans PowerShell

**Problème** : 4 fonctions utilisent `powershell Compress-Archive` / `Expand-Archive`.

**Solution** : Utiliser les crates Rust `zip` + `reqwest` :

```rust
use zip::ZipArchive;
use reqwest;

// Extraction ZIP
let client = reqwest::blocking::Client::new();
let bytes = client.get(url).send()?.bytes()?;
let cursor = std::io::Cursor::new(bytes);
let mut archive = ZipArchive::new(cursor)?;
archive.extract(target_dir)?;

// Création ZIP
use zip::ZipWriter;
let file = std::fs::File::create("archive.zip")?;
let mut zip = ZipWriter::new(file);
zip.start_file("file.txt", zip::write::SimpleFileOptions::default())?;
zip.write_all(b"contenu")?;
zip.finish()?;
```

**Fichiers concernés** :
- `src-tauri/src/commands.rs` (export_config, import_config, download_community_theme)

---

### 6. Détection Node.js

**Problème** : Chemin hardcoded `C:\Program Files\nodejs\node.exe`.

**Solution** : Détection universelle :

```rust
fn find_node() -> Option<PathBuf> {
    which::which("node").ok()
    // ou
    std::process::Command::new("node")
        .arg("--version")
        .output()
        .ok()
        .and_then(|_| which::which("node").ok())
}
```

**Fichiers concernés** :
- `crates/kairo-core/src/plugins/mod.rs`

---

### 7. Processus Enfants

**Problème** : `creation_flags(0x08000000)` (CREATE_NO_WINDOW) est Windows-only.

**Solution** : Déjà partiellement géré avec `#[cfg(windows)]`, à compléter :

```rust
#[cfg(windows)]
fn hide_console_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000);
}

#[cfg(not(windows))]
fn hide_console_window(_cmd: &mut Command) {
    // Rien à faire sur Linux/macOS
}
```

**Fichiers concernés** :
- `crates/kairo-core/src/launcher/mod.rs`
- `crates/kairo-core/src/plugins/mod.rs`

---

## 🏗️ Structure Cargo.toml Multi-Cibles

### Workspace Racine

```toml
[workspace]
resolver = "2"
members = [
    "crates/kairo-core",
    "crates/kairo-cli",
    "src-tauri",
]
```

### kairo-core/Cargo.toml (adaptations)

```toml
[dependencies]
# ... dépendances existantes ...

# Cross-platform
dirs = "5.0"
which = "6.0"
rdev = "0.5"
zip = "0.6"
reqwest = { version = "0.11", features = ["blocking"] }

# Windows-only
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.52", features = [
    "Win32_UI_Input_KeyboardAndMouse",
    "Win32_System_Threading"
] }
```

### crates/kairo-cli/Cargo.toml (nouveau)

```toml
[package]
name = "kairo-cli"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "kairo-cli"
path = "src/main.rs"

[dependencies]
kairo-core = { path = "../kairo-core" }
clap = { version = "4.0", features = ["derive"] }
```

---

## 💻 Binaire CLI : Specification

### Fonctionnalités

| Commande | Description | Dépendances |
|----------|-------------|-------------|
| `kairo-cli list [--system <id>]` | Lister les jeux | `kairo-core::Database` |
| `kairo-cli launch <game_id>` | Lancer un jeu | `kairo-core::Launcher` |
| `kairo-cli scan [--path <dir>]` | Scanner les ROMs | `kairo-core::RomScanner` |
| `kairo-cli settings get <key>` | Lire un paramètre | `kairo-core::Database` |
| `kairo-cli settings set <key> <value>` | Modifier un paramètre | `kairo-core::Database` |
| `kairo-cli plugins list` | Lister les plugins | `kairo-core::PluginManager` |
| `kairo-cli plugins enable <id>` | Activer un plugin | `kairo-core::PluginManager` |
| `kairo-cli themes list` | Lister les thèmes | `kairo-core::Database` |
| `kairo-cli themes apply <id>` | Appliquer un thème | `kairo-core::Database` |
| `kairo-cli serve` | Démarrer le serveur HTTP | `kairo-core::remote` |

### Exemple d'Implémentation

```rust
use clap::{Parser, Subcommand};
use kairo_core::{Database, Launcher, RomScanner, PluginManager};

#[derive(Parser)]
#[command(name = "kairo-cli", about = "KaïroOS CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    List { #[arg(short, long)] system: Option<String> },
    Launch { game_id: String },
    Scan { #[arg(short, long)] path: Option<String> },
    Settings { key: String, value: Option<String> },
    Plugins { #[command(subcommand)] action: PluginAction },
    Themes { #[command(subcommand)] action: ThemeAction },
    Serve { #[arg(short, long, default_value = "8080")] port: u16 },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let db = Database::open(&kairo_core::paths::db_path())?;

    match cli.command {
        Commands::List { system } => {
            let games = db.list_games()?;
            for game in &games {
                if system.as_deref() == Some(&game.system_id) || system.is_none() {
                    println!("[{}] {} ({})", game.system_id, game.title, game.id);
                }
            }
        }
        Commands::Launch { game_id } => {
            let launcher = Launcher::new(db.clone());
            launcher.launch_game(&game_id)?;
        }
        Commands::Scan { path } => {
            let scanner = RomScanner::new(&db);
            let count = scanner.scan_all()?;
            println!("{} jeux trouvés", count);
        }
        Commands::Serve { port } => {
            kairo_core::remote::start_server(db, port)?;
        }
        _ => {}
    }

    Ok(())
}
```

---

## 📱 Stratégie Android

### Option A : PWA via kairo-remote (recommandé)

Le plugin `kairo-remote` sert déjà une PWA complète. Pour Android :

1. **Ajouter une icône PWA** dans `plugins/kairo-remote/public/`
2. **Configurer le manifest** pour l'installation sur l'écran d'accueil
3. **Ajouter le support offline** via Service Worker

**Avantages** :
- Aucun développement natif requis
- Déjà fonctionnel sur le réseau local
- Installation en 1 clic depuis le navigateur

**Limitations** :
- Pas de lancement de jeux natifs
- Pas de scraping direct
- Limité au contrôle à distance

### Option B : Tauri Android (expérimental)

Tauri 2 supporte Android via WebView natif. Nécessite :

1. **Setup du projet Android** : `cargo tauri android init`
2. **Adaptation des plugins natifs** via JNI
3. **Compilation** : `cargo tauri android build`

**Avantages** :
- Application native complète
- Accès aux fonctionnalités Android (CAMERA, STORAGE, etc.)

**Risques** :
- Maturité de Tauri Android limitée
- Nécessite des connaissances en développement Android
- Plugins Rust natifs nécessitent un bridge JNI

---

## 🧪 Tests Cross-Platform

### CI/CD GitHub Actions

```yaml
name: Cross-Platform Build

on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest, macos-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: cargo test --workspace
      - name: Build
        run: npm run tauri build
```

---

## 📋 Checklist de Portage

### Linux
- [ ] Mapper les chemins via `dirs` ou `directories`
- [ ] Remplacer `windows-sys` par `rdev`
- [ ] Adapter les noms d'exécutables émulateurs
- [ ] Remplacer `explorer` par `xdg-open`
- [ ] Remplacer PowerShell par crates Rust
- [ ] Créer un package `.deb` ou AppImage
- [ ] Tester sur Ubuntu, Fedora, Arch

### macOS
- [ ] Mapper les chemins via `dirs` ou `directories`
- [ ] Remplacer `windows-sys` par `rdev` ou IOKit
- [ ] Adapter les noms d'exécutables émulateurs
- [ ] Remplacer `explorer` par `open`
- [ ] Remplacer PowerShell par crates Rust
- [ ] Créer un `.dmg` via `tauri bundler`
- [ ] Tester sur macOS Ventura, Sonoma, Sequoia

### CLI
- [ ] Créer `crates/kairo-cli`
- [ ] Implémenter les commandes de base
- [ ] Ajouter la documentation `--help`
- [ ] Tester sur toutes les plateformes

### Android (PWA)
- [ ] Configurer le manifest PWA
- [ ] Ajouter le Service Worker
- [ ] Tester sur Android Chrome
- [ ] Documenter l'installation

---

## 🔗 Ressources

- [Tauri 2 — Cross-Platform Guide](https://v2.tauri.app/start/cross-platform/)
- [Tauri Android](https://v2.tauri.app/start/android/)
- [Crate `dirs`](https://crates.io/crates/dirs)
- [Crate `rdev`](https://crates.io/crates/rdev)
- [Crate `which`](https://crates.io/crates/which)
