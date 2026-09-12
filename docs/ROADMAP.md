# 🗺️ Feuille de Route & Roadmap — KaïroOS

Bienvenue sur la feuille de route officielle de **KaïroOS**, le frontend d'arcade et de salon open source sous Windows.

---

## 📍 État Actuel : Version 0.1.0 (Alpha — Fondations & Architecture)

Cette phase initiale a posé l'ensemble des fondations techniques, la séparation hermétique des environnements et l'architecture modulaire.

### ✅ Fonctionnalités Réalisées & Validées

- [x] **Core Rust Autonome (`kairo-core`)** :
  - Moteur de base de données SQLite optimisé (`kairo.db`) avec migrations automatiques et indexation.
  - Scanner de ROMs récursif avec détection multi-consoles (SNES, N64, GameCube, Wii, Switch, PS1, PS2, PS3, Arcade, Windows).
  - Organisation automatique des jeux en sous-dossiers dédiés : `<system>/<Game Title>/<rom_file>`, `metadata.json`, et sous-dossier `media/` (jaquette, fond, captures, vidéos).
  - Constructeur de commandes CLI pour chaque émulateur et lanceur natif avec supervision du processus (PID tracking, détection de fermeture, reprise automatique du frontend).
  - Module centralisé `AppPaths` garantissant la stricte séparation entre le mode Portable (`builds/portable/`) et le mode Dev/Installé (`%APPDATA%\kairo-os\`).

- [x] **Frontend Arcade Réactif (`kairo-ui` — React 19 + Tauri 2)** :
  - Navigation 100% au Gamepad / Joystick sans souris ni clavier (`useGamepad` avec accélération et répétition).
  - Interface plein écran sans bordure, masquage complet de la barre des tâches et du curseur.
  - Système de sons d'interface arcade interactifs (bips de navigation, validation, lancement).
  - Menu latéral avec filtrage par console, par franchise, par favoris et recherche plein texte.
  - Fiche détaillée du jeu avec jaquette géante, métadonnées, configuration de lancement personnalisée par jeu (arguments CLI, émulateur custom, core LibRetro).

- [x] **Système de Thèmes Structurels & Moteur CSS** :
  - Zéro couleur en dur dans les composants React : injection dynamique des variables CSS depuis le fichier `theme.json` actif.
  - **3 Layouts officiels distincts** fournis nativement :
    - `kairo-default` : Layout Arcade Classique avec barre latérale gauche et grille de cartes dynamique.
    - `kairo-hub` : Layout Plein Écran Catégories (sans barre latérale, rayonnages horizontaux par Consoles, Sagas, Modes, Favoris).
    - `kairo-console` : Layout Console TV / Steam Big Picture (Hero showcase avec fanart en fondu, carrousel horizontal centré et barre de raccourcis manette).
  - Raccourci d'urgence : Touche <kbd>Suppr</kbd> / <kbd>Del</kbd> sur clavier réinitialisant instantanément le thème officiel en cas d'incompatibilité.
  - Sélecteur de thèmes dans les paramètres avec aperçu immédiat et Community Store relié à l'API GitHub (`KairoOS-Official/kairos-themes`).

- [x] **Paramètres Système Avancés (`SettingsModal`)** :
  - Sauvegarde en temps réel (chaque modification est écrite à la volée dans `settings.json`, sans bouton de sauvegarde global risquant d'être oublié).
  - Sections complètes : Affichage, Émulateurs, Image & Son, Manettes, Bibliothèque, Scraping, Réseau & Remote, Avancé.
  - Outils de maintenance : Export / Import de configuration en archive ZIP, réinitialisation complète d'usine, ouverture directe des dossiers de configuration et de logs.

- [x] **Application Web & Télécommande Mobile (`kairo-remote` — PWA)** :
  - Interface soignée et sobre (palette claire, lisible, adaptée mobile et desktop).
  - Formulaires d'administration directe des 4 fichiers de configuration (`settings.json`, `emulators.json`, `gamepads.json`, `remote.json`).
  - Navigation manette intégrée sur la télécommande avec détection physique et contournement automatique du PIN de sécurité en local.

- [x] **Packaging & Distribution Propre** :
  - Builds unifiés sous `builds/` (ignoré par Git) : `builds/portable/` et `builds/installer/`.
  - Dépôt Git 100% propre contenant exclusivement le code source.

---

## 🚀 Prochaines Étapes : Version 0.2.0 (Enrichissement Multimédia & Expérience Utilisateur)

L'objectif de la version 0.2.0 est d'automatiser l'embellissement visuel de la bibliothèque et la gestion avancée des jeux.

### 🎯 En Cours / Priorités Immédiates

- [ ] **Scraping Automatique Haute Définition** :
  - Intégration complète de l'API ScreenScraper (authentification compte utilisateur, gestion des quotas journaliers, gestion du rate-limiting).
  - Téléchargement et découpage automatique des jaquettes (boîte 2D, boîte 3D, logos Wheel transparents).
  - Téléchargement des vidéos de présentation (gameplay trailers 30s) avec lecture automatique lors du survol d'un jeu.
- [ ] **Gestion Multi-Disques Simplifiée** :
  - Détection automatique des jeux multi-CD (PS1, Dreamcast, Saturn, GameCube) et génération de fichiers `.m3u` transparents.
  - Menu en jeu permettant d'éjecter et d'insérer le disque suivant directement depuis la manette.
- [ ] **Overlay In-Game KaïroOS** :
  - Menu contextuel accessible en cours de jeu via le combo <kbd>Home</kbd> ou <kbd>Select</kbd> + <kbd>Start</kbd>.
  - Sauvegarde / Chargement rapide d'état (Save States), remap rapide des contrôles, et retour immédiat au frontend.

---

## 🔮 Roadmap Moyen Terme : Version 0.3.0 (Communauté, Succès & Cloud)

- [ ] **Intégration RetroAchievements** :
  - Connexion de votre compte RetroAchievements dans les paramètres KaïroOS.
  - Affichage de vos badges de succès débloqués, progression en pourcentage et classements sur la fiche de chaque jeu.
- [ ] **Synchronisation Cloud des Sauvegardes (Save Sync)** :
  - Sauvegarde et synchronisation automatique des fichiers `.srm` et save states vers Google Drive, OneDrive ou serveur Nextcloud / WebDAV.
  - Reprenez votre partie indifféremment sur votre borne d'arcade salon, votre PC portable ou votre console portable (Steam Deck / ROG Ally).
- [ ] **Gestion des Temps de Jeu & Statistiques** :
  - Historique complet des sessions, temps de jeu par console et par jeu.
  - Badges de complétion et statistiques graphiques dans l'application compagnon `kairo-remote`.

---

## 🏆 Vision Long Terme : Version 1.0.0 (Écosystème & Extensibilité)

- [ ] **Boutique de Plugins & Extensions WebAssembly** :
  - Système d'extensions tierces (lecteur de musique chiptune de fond, widgets météo, scraping de sources alternatives).
- [ ] **Mode Kiosk Ultra-Sécurisé pour Événements Publics** :
  - Verrouillage total de l'accès au système d'exploitation Windows (désactivation des combinaisons <kbd>Alt</kbd>+<kbd>Tab</kbd>, <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Suppr</kbd>, <kbd>Touche Windows</kbd>).
  - Minuteur de session par jeton ou par partie (mode monnayeur d'arcade virtuel).
- [ ] **Support Multilingue Intégral** :
  - Traduction de l'interface en Anglais, Espagnol, Japonais, Allemand et Portugais.

---

## 🌍 Vision Cross-Platform : Portabilité Multi-Systèmes

KaïroOS est structurellement prêt pour la portabilité grâce à l'architecture Tauri 2 et la séparation complète backend/frontend. Voici les étapes pour étendre le support aux autres systèmes d'exploitation.

### 📊 Faisabilité par Plateforme

| Plateforme | Faisabilité | Effort Estimé | Priorité |
|------------|-------------|---------------|----------|
| **Windows** | 10/10 | Référence | ✅ Actuel |
| **Linux** | 7.5/10 | ~2-3 semaines | Haute |
| **macOS** | 7/10 | ~3-4 semaines | Haute |
| **Android** | 4/10 | Projet séparé | Moyenne |

### 🔧 Adaptations Requises pour Linux/macOS

#### P0 — Critique (bloquant)

- [ ] **Système de chemins (`kairo-core/src/paths.rs`)** :
  - Mapper `%APPDATA%` vers `$XDG_CONFIG_HOME/kairo-os` (Linux) ou `~/Library/Application Support/kairo-os` (macOS).
  - Déjà partiellement géré avec fallback `USERPROFILE`, à étendre.

- [ ] **Remplacement de `windows-sys` (GetAsyncKeyState / SendInput)** :
  - Utiliser le crate `rdev` (cross-platform) pour le polling clavier global et l'injection de touches.
  - Alternative : `evdev` + `libxdo` sur Linux, IOKit sur macOS.

- [ ] **Noms d'exécutables émulateurs (`config/emulators.json`)** :
  - Créer un mapping par OS : `retroarch.exe` → `retroarch` (Linux/macOS).
  - ~53 occurrences de `.exe` dans le code Rust à conditionner.

#### P1 — Important

- [ ] **Ouverture de dossiers (`src-tauri/src/commands.rs`)** :
  - Remplacer `explorer` par `xdg-open` (Linux) / `open` (macOS).
  - 3 commandes `explorer` identifiées.

- [ ] **Gestion ZIP sans PowerShell** :
  - Remplacer les appels `powershell Compress-Archive` / `Expand-Archive` par les crates Rust `zip` + `reqwest`.
  - 4 fonctions Tauri command concernées.

- [ ] **Détection Node.js universelle** :
  - Remplacer `C:\Program Files\nodejs\node.exe` par `std::process::Command::new("node")` ou `which node`.

#### P2 — Secondaire

- [ ] **Scripts de build (`scripts/build-portable.mjs`)** :
  - Adapter le script pour Linux/macOS (remplacer PowerShell par Bash).
  - Générer des packages `.deb` / AppImage (Linux) et `.dmg` (macOS).

- [ ] **Configuration émulateurs multi-OS** :
  - Structurer `emulators.json` avec des profils par plateforme.

### 📱 Stratégie Android

Deux approches possibles :

#### Option A : Tauri Android (expérimental)
- Tauri 2 supporte Android via WebView natif.
- Nécessite un adapter JNI pour les plugins natifs.
- Effort : élevé, mitigé par la maturité du framework.

#### Option B : PWA via kairo-remote (recommandé à court terme)
- Le plugin `kairo-remote` sert déjà une PWA complète.
- Suffisant pour le contrôle à distance (lancement, settings, navigation).
- Pas de support natif pour le lancement de jeux ou le scraping.
- Effort : faible, déjà fonctionnel.

### 🏗️ Structure du Projet Multi-Cibles

```
Kairo/
├── crates/
│   ├── kairo-core/          # Cœur métier (déjà là, inchangé)
│   ├── kairo-cli/           # ← NOUVEAU : binaire CLI en ligne de commande
│   └── kairo-android/       # ← NOUVEAU : JNI bridge (si Option A)
├── src-tauri/               # Desktop Tauri (déjà là)
├── src/                     # Frontend React desktop (déjà là)
├── android/                 # ← NOUVEAU : projet Tauri Android
├── plugins/                 # Plugins (déjà là)
├── themes/                  # Thèmes (déjà là)
├── config/                  # Configuration (déjà là)
└── Cargo.toml               # Workspace élargi
```

#### Workspace Cargo.toml cible

```toml
[workspace]
members = [
    "crates/kairo-core",
    "crates/kairo-cli",
    "src-tauri",
]
```

### 💻 CLI : Binaire Ligne de Commande

Un binaire Rust minimal important `kairo-core` directement, sans aucune dépendance UI.

**Fonctionnalités prévues :**

| Commande | Description |
|----------|-------------|
| `kairo-cli list` | Lister tous les jeux de la bibliothèque |
| `kairo-cli launch <game_id>` | Lancer un jeu via l'émulateur configuré |
| `kairo-cli scan` | Scanner les dossiers ROMs |
| `kairo-cli settings` | Afficher/modifier les paramètres |
| `kairo-cli plugins` | Lister/activer/désactiver les plugins |
| `kairo-cli themes` | Lister/appliquer les thèmes |

**Avantages :**
- Intégration dans des scripts et automatisations.
- Usage sur des serveurs sans interface graphique.
- Test rapide sans lancer l'interface desktop.

### 📋 Ordre de Mise en Œuvre Recommandé

1. **Phase 0** — Mode Portable par Défaut (préalable à tout)
2. **Phase 1** — Linux Desktop (effort ciblé, retour rapide)
3. **Phase 2** — CLI (outil de développement et d'automatisation)
4. **Phase 3** — macOS Desktop (similarité avec Linux)
5. **Phase 4** — Android PWA (via kairo-remote existant)
6. **Phase 5** — Android natif (si demandé, projet séparé)
