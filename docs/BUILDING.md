# 🛠️ Guide de Compilation & Commandes Console — KaïroOS

Ce guide détaille l'ensemble des commandes console disponibles pour développer, tester, compiler et packager **KaïroOS** sous Windows.

---

## 📋 Prérequis Système

Pour compiler l'intégralité du projet, vous devez disposer des outils suivants :

| Outil | Version Minimale | Rôle |
| :--- | :--- | :--- |
| **Node.js** | 18.0.0+ (LTS recommandé) | Environnement JavaScript / NPM pour Vite et React 19 |
| **Rust & Cargo** | 1.80.0+ (`stable-x86_64-pc-windows-msvc`) | Compilateur Rust pour `kairo-core` et l'hôte Tauri 2 |
| **Visual Studio Build Tools** | VS 2022 C++ x64/x86 build tools | Nécessaire pour l'édition de liens sous Windows |
| **PowerShell** | 5.1+ | Utilisé par les scripts d'automatisation de packaging |

---

## 💻 1. Mode Développement (Dev Mode)

En mode développement, l'application bénéficie du rechargement à chaud (Vite HMR) et de logs détaillés dans la console.

### Lancer l'application complète en Dev :
```powershell
npm run tauri dev
```
> **Note sur les données en mode Dev :**  
> L'application s'exécute avec les données hermétiquement isolées dans `%APPDATA%\kairo-os\`. Vos configurations de test, ROMs et bases de données n'apparaissent jamais dans le dossier Git.

### Lancer uniquement le serveur Web Vite (sans fenêtre native Tauri) :
```powershell
npm run dev
```

### Lancer la télécommande `kairo-remote` en mode Dev :
```powershell
npm run dev:remote
```
*(Disponible par défaut sur `http://localhost:5174`)*

---

## 📦 2. Production & Packaging des Builds

Toutes les productions finales sont centralisées dans le dossier racine **`builds/`** (qui est ignoré par Git pour préserver la légèreté du dépôt).

### Option A : Générer le Package Portable Autonome (Recommandé)
Le mode portable regroupe l'exécutable, les émulateurs, les configurations, les thèmes et les ROMs dans un dossier unique prêt à être copié sur une clé USB ou un disque externe :

```powershell
npm run build:portable
# ou directement :
node scripts/build-portable.mjs
```

**Résultat produit dans `.live/builds/portable/v<version>/` :**
```
builds/portable/
├── KaïroOS.exe               # Binaire autonome complet
├── portable.txt              # Marqueur d'autonomie (active le mode portable hermétique)
├── config/                   # settings.json, emulators.json, gamepads.json, remote.json
├── emulators/                # RetroArch, cores libretro et émulateurs autonomes
├── roms/                     # Vos jeux rétro et métadonnées
├── themes/                   # Thèmes locaux (dont floo-console, kairo-default, etc.)
├── kairo_data/               # Base de données SQLite kairo.db
└── logs/                     # Journaux d'erreurs en cas de problème
```

---

### Option B : Générer l'Installateur Windows Standard (Setup NSIS / MSI)
Pour créer un installeur Windows classique qui installera KaïroOS dans `Program Files` et stockera les profils joueurs dans `%APPDATA%` :

```powershell
npm run build:installer
```
Les fichiers d'installation générés se trouveront dans :
`.live/builds/installer/v<version>/bundle/nsis/` ou `.live/builds/installer/v<version>/bundle/msi/`.

---

### Option C : Compiler la PWA Mobile `kairo-remote`
Pour recompiler les fichiers statiques de l'application compagnon mobile hébergée par le serveur HTTP local de KaïroOS :

```powershell
npm run build:remote
```
Les fichiers compilés sont déposés dans `kairo-remote/dist/`.

---

## 🧪 3. Tests & Vérification de Qualité de Code

Avant de commiter ou de publier une version, vous pouvez vérifier l'absence d'erreurs avec cette suite de commandes :

### 1. Tests unitaires du Core Rust (`kairo-core`) :
```powershell
cargo test --package kairo-core
```
*Valide le tokeniseur CLI, le nettoyage de titres, les migrations SQLite, le scanner récursif et le lanceur de processus.*

### 2. Vérification statique de compilation Tauri :
```powershell
cargo check --manifest-path src-tauri/Cargo.toml
```

### 3. Contrôle des types TypeScript (sans émettre de fichiers) :
```powershell
npx tsc --noEmit
```

### 4. Build de test du frontend React :
```powershell
npm run build
```

---

## 🗃️ 4. Récapitulatif des Scripts `package.json`

| Commande NPM | Action |
| :--- | :--- |
| `npm run dev` | Démarre Vite en local (`http://localhost:5173`) |
| `npm run build` | Compile le frontend React avec TypeScript et Vite |
| `npm run tauri dev` | Lance l'application de bureau complète en direct avec HMR |
| `npm run tauri build` | Compile l'exécutable de production et crée l'installateur Windows |
| `npm run build:portable` | Génère l'archive portable autonome dans `builds/portable/` |
| `npm run dev:remote` | Démarre le frontend de la télécommande mobile `kairo-remote` |
| `npm run build:remote` | Compile la PWA `kairo-remote` pour production |
