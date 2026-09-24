<p align="center">
   <img src="src/assets/logo.png?v=2" alt="KaïroOS Arcade Frontend Logo" width="180" />
</p>

# 🕹️ KaïroOS

**Frontend d'arcade custom complet sous Windows, gratuit pour usage personnel.**  
*Conçu pour bornes d'arcade physiques — Navigable à 100% au Joystick/Gamepad — Zéro souris, zéro clavier visible.*

[![Website](https://img.shields.io/badge/Website-kairo--arcade.onrender.com-6366F1?style=flat-square&logo=googlechrome&logoColor=white)](https://kairo-arcade.onrender.com/)
[![Démo Interactive](https://img.shields.io/badge/Démo_Interactive-Tester_en_Ligne-00DC82?style=flat-square&logo=render&logoColor=white)](https://kairo-arcade.onrender.com/)
[![Rust](https://img.shields.io/badge/Rust-1.96+-orange.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tauri 2](https://img.shields.io/badge/Tauri-v2-blue.svg?style=flat-square&logo=tauri)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![License: Noncommercial](https://img.shields.io/badge/License-Noncommercial-blue.svg?style=flat-square)](LICENSE)
[![Pro License](https://img.shields.io/badge/Commercial-KaïroOS_Pro-gold.svg?style=flat-square)](docs/COMMERCIAL_AND_LICENSING.md)

> ### 🕹️ [👉 Découvrir la Vitrine Officielle & Démo Interactive : kairo-arcade.onrender.com 👈](https://kairo-arcade.onrender.com/)
> Testez l'interface arcade sans installation, explorez les thèmes avec le simulateur CRT et votez sur la feuille de route communautaire !

---

## 📖 Le Concept

**KaïroOS** transforme n'importe quel PC Windows en une borne d'arcade physique haut de gamme. L'expérience est pensée pour être **100% autonome et navigable au stick/gamepad** :
- **Unification totale** : Lancez vos jeux rétro (NES, SNES, N64, GameCube, Wii, Switch, PS1, PS2, PS3, Arcade) et vos **jeux PC Windows natifs** au même endroit.
- **Zéro friction** : Aucun curseur de souris parasite ni boîte de dialogue Windows. Tout disparaît derrière l'interface arcade.
- **Supervision intelligente** : Chronométrage précis du temps joué, suivi du PID en arrière-plan et reprise instantanée du frontend lors de la fermeture d'un jeu.
- **Contrôle à distance** : Intégration naturelle avec Sunshine/Moonlight pour le streaming vidéo complet, complété par `kairo-remote` pour l'administration et l'installation de ROMs depuis un smartphone sur le réseau local.

---

## 🏛️ Architecture du Projet

```
Kaïro/
├── crates/
│   └── kairo-core/          # Crate Rust autonome (Scanner de ROMs, SQLite, Lanceur CLI)
│       ├── src/
│       │   ├── db/          # Couche SQLite, migrations, index et requêtes optimisées
│       │   ├── models/      # Modèles de données (Game, System, Emulator, GameConfig)
│       │   ├── scanner/     # Scanner récursif de ROMs avec détection de console & SHA1
│       │   └── launcher/    # Constructeur de commandes CLI & superviseur de process
│       └── Cargo.toml
├── src-tauri/               # Application hôte Tauri 2
│   ├── capabilities/        # Permissions fenêtrage et plugins
│   ├── src/                 # Commandes IPC Tauri exposant kairo-core au frontend
│   └── tauri.conf.json      # Configuration plein écran & fenêtrage
├── src/                     # Frontend React 19 (kairo-ui)
│   ├── components/          # Composants UI arcade (Header, SystemSelector, GameGrid, Modals)
│   ├── hooks/               # useGamepad (gamepad API avec repeat rate et debounce)
│   └── types/               # Typages TypeScript synchronisés avec Rust
├── package.json             # React 19, Vite, TailwindCSS, Lucide
└── Cargo.toml               # Workspace racine Rust
```

---

## 📚 Documentation Détaillée

Pour approfondir le fonctionnement, l'architecture et les guides pratiques, consultez les documents du dossier [`docs/`](docs/) :

- 🗺️ **[Feuille de Route & Roadmap](https://github.com/KairoOS-Official/.github/blob/main/ROADMAP.md)** : Feuille de route officielle centralisée de l'écosystème (v0.2.0, v0.3.0, v1.0.0).
- 🛠️ **[Guide de Compilation & Commandes Console](docs/BUILDING.md)** : Comment compiler le package portable (`npm run build:portable`), l'installateur Windows, les tests Rust (`cargo test`) et les commandes de développement.
- 🔌 **[Guide de Développement des Plugins](https://github.com/KairoOS-Official/kairos-plugins/blob/main/PLUGIN_GUIDE.md)** : Conception d'extensions multi-langages, protocole standardisé `stdin/stdout JSON` et sandbox.
- 🎨 **[Architecture & Guide des Thèmes](https://github.com/KairoOS-Official/kairos-themes/blob/main/THEME_GUIDE.md)** : Layouts structurels officiels (`kairo-default`, `kairo-hub`, `kairo-console`), variables CSS et simulateur CRT.
- 🐛 **[Guide de Débogage & Dépannage](docs/DEBUGGING.md)** : Emplacement des logs, diagnostic du lancement des émulateurs, inspection de la base SQLite et raccourcis clavier de secours.
- 🌍 **[Guide Cross-Platform](docs/CROSS_PLATFORM.md)** : Adaptations pour Linux, macOS, Android et le binaire CLI (dépendances, structure, checklist).

---

## 🎮 Matrice des Émulateurs CLI Intégrés

KaïroOS utilise l'exécution en ligne de commande pure pour piloter les meilleurs émulateurs sans interface intermédiaire :

| Console / Plateforme | Émulateur Cible | Commande CLI |
| :--- | :--- | :--- |
| **NES, SNES, GBA, N64, PS1, Arcade** | **RetroArch** | `retroarch.exe -L "cores\{core}.dll" "{rom_path}"` |
| **Nintendo Switch** | **Ryujinx / Ryubing** | `ryujinx.exe -f -g "{rom_path}"` |
| **PlayStation 2** | **PCSX2** | `pcsx2.exe --nogui -batch "{rom_path}"` |
| **GameCube / Wii** | **Dolphin** | `dolphin.exe -b -e "{rom_path}"` |
| **PlayStation 3** | **RPCS3** | `rpcs3.exe --no-gui "{rom_path}"` |
| **Jeux Windows Natifs** | **Exécution Directe** | `"{exe_path}" {custom_args}` |

---

## 🕹️ Contrôles Arcade & Navigation

| Bouton Arcade / Manette | Action KaïroOS | Équivalent Clavier |
| :--- | :--- | :--- |
| **Stick / D-Pad** | Navigation dans la grille de jeux | `Flèches` ou `Z/Q/S/D` |
| **Bouton A (Croix)** | Lancer le jeu sélectionné / Confirmer | `Entrée` |
| **Bouton B (Rond)** | Fermer le modal / Retour | `Échap` ou `Retour Arrière` |
| **Bouton X (Carré)** | Ajouter / Retirer des Favoris | `F` |
| **Bouton Y (Triangle)** | Ouvrir la fiche détails & config CLI | `Espace` ou `Y` |
| **LB / RB (L1 / R1)** | Changer de console (SNES, PS2, Switch...) | `A` / `E` ou `PageUp` / `PageDown` |
| **Bouton Start** | Ouvrir le Scanner de ROMs | `M` ou `F1` |

---

## 🚀 Démarrage Rapide (Développement)

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)
- [Rust & Cargo](https://rustup.rs/) (v1.80+)

### Installation & Lancement

1. **Installer les dépendances Frontend :**
   ```bash
   npm install
   ```

2. **Lancer les tests du Core Rust :**
   ```bash
   cargo test --package kairo-core
   ```

3. **Lancer KaïroOS en mode développement (Tauri 2 + Vite HMR) :**
   ```bash
   npm run tauri dev
   ```

---

## 🌍 Vision Cross-Platform & CLI

KaïroOS est structurellement prêt pour tourner sur d'autres systèmes d'exploitation grâce à l'architecture Tauri 2 et la séparation complète backend/frontend.

| Plateforme | Statut | Effort |
|------------|--------|--------|
| **Windows** | ✅ Actuel | Référence |
| **Linux** | 🔜 Prévu | ~2-3 semaines |
| **macOS** | 🔜 Prévu | ~3-4 semaines |
| **CLI** (toutes plateformes) | 🔜 Prévu | ~1 semaine |
| **Android** (PWA) | 📋 Envisagé | Via `kairo-remote` |

**Pour en savoir plus** : consultez la [Roadmap Cross-Platform](docs/ROADMAP.md#-vision-cross-platform--portabilité-multi-systèmes).

### Binaire CLI

Un binaire `kairo-cli` est prévu pour permettre l'utilisation de KaïroOS en ligne de commande, sans interface graphique :

```bash
kairo-cli list              # Lister les jeux
kairo-cli launch smw-snes   # Lancer un jeu
kairo-cli scan              # Scanner les ROMs
kairo-cli settings          # Gérer les paramètres
```

---

## 📄 Licence & Utilisation Commerciale

- **Usage Personnel & Domicile** : KaïroOS est **100% gratuit et ouvert** (Source-Available) pour les particuliers, amateurs et passionnés de rétrogaming.
- **Interdiction de Rebranding** : Le nom **KaïroOS**, les logos et les crédits originaux doivent obligatoirement être conservés. Tout white-labeling ou renommage sans accord est strictement interdit.
- **Usage Commercial & Professionnels** : Toute vente de machine/borne préinstallée, exploitation dans un lieu public payant (bar d'arcade, hôtel, salon) ou borne intégrant un **monnayeur à pièces/jetons** requiert obligatoirement une **Licence Commerciale Opérateur**.

Pour les détails complets, consultez :
- Le fichier [LICENSE](LICENSE) (KaïroOS Community & Noncommercial License 1.0).
- Le guide détaillé [Licence, Exploitation Commerciale & Modèle Opérateur](docs/COMMERCIAL_AND_LICENSING.md).
- Pour toute demande de licence pro / partenariat constructeur : Discord **nayrolf_rdgs** ou via GitHub [@NayrolfRdgs](https://github.com/NayrolfRdgs).

---

<div align="center">

**FlowCreativeStudio** · Florian ([@NayrolfRdgs](https://github.com/NayrolfRdgs)) · Discord: `nayrolf_rdgs`

</div>

