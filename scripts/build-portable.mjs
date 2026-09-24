import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('====================================================');
console.log('🚀 CRÉATION DU PACKAGE PORTABLE AUTONOME — KAÏROOS');
console.log('====================================================\n');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studioRoot = path.resolve(projectRoot, '..');
const packageVersion = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version;
const versionLabel = `v${packageVersion}`;
const portableDir = process.env.KAIROS_PORTABLE_DIR || path.join(studioRoot, '.live', 'builds', 'portable', versionLabel);
const targetDir = path.join(studioRoot, '.live', 'builds', 'target', versionLabel);
const buildEnv = { ...process.env, CARGO_TARGET_DIR: targetDir };

// 1. Création de l'arborescence complète des dossiers
const dirsToCreate = [
  portableDir,
  path.join(portableDir, 'config'),
  path.join(portableDir, 'roms'),
  path.join(portableDir, 'roms', 'snes'),
  path.join(portableDir, 'roms', 'ps1'),
  path.join(portableDir, 'roms', 'ps2'),
  path.join(portableDir, 'roms', 'n64'),
  path.join(portableDir, 'roms', 'switch'),
  path.join(portableDir, 'roms', 'gba'),
  path.join(portableDir, 'roms', 'gamecube'),
  path.join(portableDir, 'roms', 'megadrive'),
  path.join(portableDir, 'roms', 'arcade'),
  path.join(portableDir, 'roms', 'windows'),
  path.join(portableDir, 'roms', 'Super Mario'),
  path.join(portableDir, 'roms', 'The Legend of Zelda'),
  path.join(portableDir, 'roms', 'Pokemon'),
  path.join(portableDir, 'roms', 'Sonic'),
  path.join(portableDir, 'emulators'),
  path.join(portableDir, 'media'),
  path.join(portableDir, 'kairo_data'),
];

for (const dir of dirsToCreate) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// 2. Build & Packaging Tauri Standalone (Frontend React intégré dans le binaire)
console.log('🦀 Build du binaire autonome complet avec assets intégrés (Tauri)...');
execSync('npx tauri build --no-bundle', { stdio: 'inherit', cwd: projectRoot, env: buildEnv });

// 3. Fermeture des processus résiduels et copie de l'exécutable autonome
try {
  execSync('powershell -Command "Stop-Process -Name kairo-app, KaïroOS, Ka*roOS -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
} catch (_) {}

const candidateExePaths = [
  path.join(targetDir, 'release', 'kairo-app.exe'),
];
const releaseExe = candidateExePaths.find((p) => existsSync(p)) || candidateExePaths[0];

const targetExe = path.join(portableDir, 'KaïroOS.exe');
if (existsSync(releaseExe)) {
  copyFileSync(releaseExe, targetExe);
  console.log(`\n✅ Exécutable généré avec succès : ${targetExe}`);
} else {
  console.error(`❌ Erreur : Impossible de trouver ${releaseExe}`);
  process.exit(1);
}

// 4. Synchronisation automatique de tous les émulateurs pré-installés
const emulatorsSource = path.join(projectRoot, 'emulators');
if (existsSync(emulatorsSource)) {
  console.log('🎮 Synchronisation des émulateurs dans builds/portable/emulators/ ...');
  try {
    execSync(`powershell -Command "Copy-Item -Path '${emulatorsSource}/*' -Destination '${path.join(portableDir, 'emulators')}' -Recurse -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' });
  } catch (_) {}
}

// 5. Synchronisation automatique de tous les thèmes
const themesSource = existsSync(path.join(studioRoot, 'kairos-themes', 'official'))
  ? path.join(studioRoot, 'kairos-themes', 'official')
  : path.join(projectRoot, 'themes');
if (existsSync(themesSource)) {
  console.log(`🎨 Synchronisation des thèmes (${themesSource}) dans builds/portable/themes/ ...`);
  try {
    execSync(`powershell -Command "Copy-Item -Path '${themesSource}/*' -Destination '${path.join(portableDir, 'themes')}' -Recurse -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' });
    // Supprimer les fichiers résiduels à la racine de themes/ si présents
    const looseThemeJson = path.join(portableDir, 'themes', 'theme.json');
    if (existsSync(looseThemeJson)) unlinkSync(looseThemeJson);
    const loosePreviewSvg = path.join(portableDir, 'themes', 'preview.svg');
    if (existsSync(loosePreviewSvg)) unlinkSync(loosePreviewSvg);
  } catch (_) {}
}

// 5bis. Synchronisation automatique des plugins
const pluginsSource = existsSync(path.join(studioRoot, 'kairos-plugins', 'official'))
  ? path.join(studioRoot, 'kairos-plugins', 'official')
  : path.join(projectRoot, 'plugins');
if (existsSync(pluginsSource)) {
  console.log(`🔌 Synchronisation des plugins (${pluginsSource}) dans builds/portable/plugins/ ...`);
  try {
    const pluginsTarget = path.join(portableDir, 'plugins');
    if (!existsSync(pluginsTarget)) mkdirSync(pluginsTarget, { recursive: true });
    execSync(`powershell -Command "Copy-Item -Path '${pluginsSource}/*' -Destination '${pluginsTarget}' -Recurse -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' });
  } catch (_) {}
}

// Marqueur explicite de mode portable
writeFileSync(path.join(portableDir, 'portable.txt'), 'KAÏROOS_PORTABLE_MODE=1\n', 'utf-8');

// 6. Génération des fichiers de configuration JSON ouverts et modifiables

// A. config/settings.json
const defaultSettings = {
  fullscreen: false,
  always_on_top: false,
  kiosk_mode: false,
  roms_path: "./roms",
  theme: "kairo-default",
  enabled_franchises: [
    "mario",
    "zelda",
    "pokemon",
    "sonic",
    "versus",
    "rpg"
  ],
  enabled_modes: [
    "2-players",
    "genre:fight",
    "genre:platform"
  ],
  custom_franchises: []
};
writeFileSync(path.join(portableDir, 'config', 'settings.json'), JSON.stringify(defaultSettings, null, 2), 'utf-8');

// B. config/emulators.json
const defaultEmulators = [
  {
    id: "retroarch",
    name: "RetroArch",
    exe_path: "./emulators/RetroArch/retroarch.exe",
    default_args: "-L \"{core_path}\" \"{rom_path}\"",
    is_builtin: true,
    website_url: "https://www.retroarch.com/"
  },
  {
    id: "ryujinx",
    name: "Ryujinx (Nintendo Switch)",
    exe_path: "./emulators/Ryujinx/Ryujinx.exe",
    default_args: "-f -g \"{rom_path}\"",
    is_builtin: true,
    website_url: "https://ryujinx.org/"
  },
  {
    id: "pcsx2",
    name: "PCSX2 (PlayStation 2)",
    exe_path: "./emulators/PCSX2/pcsx2-qt.exe",
    default_args: "--nogui -batch \"{rom_path}\"",
    is_builtin: true,
    website_url: "https://pcsx2.net/"
  },
  {
    id: "dolphin",
    name: "Dolphin (GameCube / Wii)",
    exe_path: "./emulators/Dolphin/Dolphin.exe",
    default_args: "-b -e \"{rom_path}\"",
    is_builtin: true,
    website_url: "https://dolphin-emu.org/"
  },
  {
    id: "rpcs3",
    name: "RPCS3 (PlayStation 3)",
    exe_path: "./emulators/RPCS3/rpcs3.exe",
    default_args: "--no-gui \"{rom_path}\"",
    is_builtin: true,
    website_url: "https://rpcs3.net/"
  },
  {
    id: "native",
    name: "Windows Native Process",
    exe_path: null,
    default_args: "\"{rom_path}\"",
    is_builtin: true
  }
];
writeFileSync(path.join(portableDir, 'config', 'emulators.json'), JSON.stringify(defaultEmulators, null, 2), 'utf-8');

// C. config/remote.json (Accès Distant / Mobile PWA)
const defaultRemote = {
  enabled: false,
  port: 8080,
  bind_address: "0.0.0.0",
  require_pin: true,
  pin_code: "1980",
  allow_game_install: true,
  allow_remote_control: true,
  websocket_sync: true
};
writeFileSync(path.join(portableDir, 'config', 'remote.json'), JSON.stringify(defaultRemote, null, 2), 'utf-8');

// D. config/LISEZ-MOI - CONFIGURATION.txt
const configReadme = `================================================================================
                    GUIDE DES FICHIERS DE CONFIGURATION (CONFIG/)
================================================================================

Ce dossier contient tous les réglages de KaïroOS au format JSON standard.
Vous pouvez les modifier directement au bloc-notes ou via vos propres scripts !

--------------------------------------------------------------------------------
FICHIERS DISPONIBLES :
--------------------------------------------------------------------------------
1. settings.json :
   - "fullscreen" : true/false (démarrage en plein écran)
   - "always_on_top" : true/false (mode borne toujours au premier plan)
   - "kiosk_mode" : true/false (verrouillage interface)
   - "roms_path" : "./roms" (chemin relatif de vos jeux)
   - "enabled_franchises" : liste des sagas activées dans la barre latérale

2. emulators.json :
   - Liste de vos émulateurs, chemins des .exe et modèles de lignes de commande CLI.

3. remote.json :
   - Réglages du serveur d'accès distant (PWA mobile, port 8080, code PIN).

Toutes les modifications faites dans l'interface de KaïroOS sont automatiquement
synchronisées dans ces fichiers, et inversement !
`;
writeFileSync(path.join(portableDir, 'config', 'LISEZ-MOI - CONFIGURATION ET ACCES DISTANT.txt'), configReadme, 'utf-8');

// 5. Génération des fichiers explicatifs complets

// A. Guide Principal (Racine)
const rootReadme = `================================================================================
                    KAÏROOS — STATION D'ARCADE PORTABLE SOUS WINDOWS
================================================================================

Bienvenue dans votre version portable autonome de KaïroOS !
Cette version est 100% autonome et ne nécessite aucune installation.
Vous pouvez copier l'intégralité de ce dossier sur une CLÉ USB, un DISQUE DUR
EXTERNE ou n'importe quel dossier de votre PC et y jouer directement.

--------------------------------------------------------------------------------
1. COMMENT LANCER LE LOGICIEL ?
--------------------------------------------------------------------------------
Double-cliquez simplement sur :
👉  KaïroOS.exe

L'interface se lancera instantanément en mode plein écran ou fenêtré.

--------------------------------------------------------------------------------
2. CONTRÔLES & NAVIGATION (MANETTE / CLAVIER / SOURIS)
--------------------------------------------------------------------------------
KaïroOS est pensé pour être navigable aussi bien au Joystick / Manette qu'au
Clavier et à la Souris :

🎮 MANETTE (XBOX / PLAYSTATION / JOYSTICK ARCADE) :
  - Croix / Stick : Déplacer la sélection
  - Bouton A / Croix : Lancer le jeu sélectionné / Confirmer
  - Bouton B / Rond : Retour / Fermer la fenêtre
  - Bouton Y / Triangle : Ajouter ou retirer des Favoris (⭐)
  - Bouton X / Carré : Ouvrir la fiche détaillée du jeu
  - Bouton Menu (Start) : Ouvrir les Paramètres & Options de la borne

⌨️ CLAVIER :
  - Flèches ou Z / Q / S / D : Naviguer
  - Entrée : Lancer le jeu
  - Échap : Fermer les fenêtres / modales
  - F11 : Basculer entre Plein Écran et Mode Fenêtré
  - Ctrl+F : Rechercher un jeu par mot-clé

🖱️ SOURIS :
  - Clic simple : Sélectionner un jeu et voir sa fiche
  - Double-clic : Lancer le jeu immédiatement
  - Clic sur l'étoile : Basculer en Favori

--------------------------------------------------------------------------------
3. ORGANISATION DES DOSSIERS (CE QUE VOUS POUVEZ MODIFIER)
--------------------------------------------------------------------------------
📁 config/      -> Fichiers JSON de réglages (settings.json, emulators.json, remote.json).
📁 roms/        -> Déposez ici tous vos jeux (par console ou par franchise).
📁 emulators/   -> Déposez ici vos émulateurs (RetroArch, PCSX2, Ryujinx...).
📁 media/       -> Jaquettes, captures et logos personnalisés.
📁 kairo_data/  -> Base de données SQLite locale et sauvegardes de session.

Chaque sous-dossier contient un fichier "LISEZ-MOI.txt" avec des instructions
détaillées.

Bon jeu sur KaïroOS !
`;
writeFileSync(path.join(portableDir, 'LISEZ-MOI - DEMARRAGE RAPIDE.txt'), rootReadme, 'utf-8');

// B. Guide ROMs & Franchises
const romsReadme = `================================================================================
                    GUIDE DU DOSSIER ROMS & FRANCHISES
================================================================================

Ce dossier est l'endroit où vous devez déposer vos fichiers de jeux (ROMs).
Le chemin par défaut utilisé par KaïroOS est : ./roms

--------------------------------------------------------------------------------
1. ORGANISATION PAR CONSOLE (MÉTHODE CLASSIQUE)
--------------------------------------------------------------------------------
Vous pouvez classer vos jeux dans les sous-dossiers correspondant à chaque système :

  • roms/snes/        -> Super Nintendo (.sfc, .smc, .zip)
  • roms/ps1/         -> Sony PlayStation (.chd, .cue, .iso, .pbp)
  • roms/ps2/         -> Sony PlayStation 2 (.iso, .chd, .bin)
  • roms/n64/         -> Nintendo 64 (.z64, .n64, .v64)
  • roms/switch/      -> Nintendo Switch (.nsp, .xci)
  • roms/gba/         -> Game Boy Advance (.gba, .zip)
  • roms/gamecube/    -> Nintendo GameCube (.iso, .rvz, .gcz)
  • roms/megadrive/   -> Sega Mega Drive (.md, .gen, .bin)
  • roms/arcade/      -> Arcade FBNeo / MAME (.zip, .7z)
  • roms/windows/     -> Jeux PC natifs (.exe, .lnk, .url)

--------------------------------------------------------------------------------
2. ORGANISATION PAR SOUS-DOSSIER DÉDIÉ PAR JEU
--------------------------------------------------------------------------------
Pour une organisation professionnelle complète, vous pouvez créer un sous-dossier
dédié par jeu contenant tous ses éléments :

📁 roms/snes/Super Mario World/
   ├── Super Mario World.sfc    (Fichier ROM)
   ├── metadata.json            (Fiche détaillée : titre, date, note, synopsis)
   ├── config.json              (Réglages spécifiques d'émulation et shader)
   └── cover.png                (Jaquette frontale du jeu)

--------------------------------------------------------------------------------
3. ORGANISATION PAR DOSSIER DE FRANCHISE (MULTI-CONSOLES)
--------------------------------------------------------------------------------
KaïroOS vous permet de regrouper des jeux de consoles DIFFÉRENTES dans un même
dossier portant le nom d'une saga :

📁 roms/Super Mario/
   ├── Super Mario World.sfc          (Jeu Super Nintendo)
   ├── Super Mario 64.z64             (Jeu Nintendo 64)
   ├── Super Mario Sunshine.rvz       (Jeu GameCube)
   └── Super Mario Odyssey.nsp        (Jeu Nintendo Switch)

Le scanner de KaïroOS détecte automatiquement la console associée à chaque jeu
grâce à son extension.
`;
writeFileSync(path.join(portableDir, 'roms', 'LISEZ-MOI - ROMS ET FRANCHISES.txt'), romsReadme, 'utf-8');

// C. Exemple JSON Métadonnées
const exampleJson = {
  title: "Super Mario World (Édition Complète)",
  franchise: "Super Mario",
  system_id: "snes",
  release_date: "1990-11-21",
  developer: "Nintendo EAD",
  publisher: "Nintendo",
  genre: "Plateforme 2D",
  players: 2,
  rating: 4.9,
  synopsis: "Mario, Luigi et Yoshi explorent Dinosaur Land pour délivrer la princesse Peach des griffes de Bowser et de ses Koopalings.",
  cover_file: "cover.png"
};
writeFileSync(path.join(portableDir, 'roms', 'exemple_metadata_jeu.json'), JSON.stringify(exampleJson, null, 2), 'utf-8');

// D. Guide Émulateurs
const emuReadme = `================================================================================
                    GUIDE DU DOSSIER EMULATEURS
================================================================================

Ce dossier est prévu pour accueillir vos émulateurs en version portable.

--------------------------------------------------------------------------------
ÉMULATEURS RECOMMANDÉS & STRUCTURE PORTABLE :
--------------------------------------------------------------------------------
1. RetroArch (Multi-Systèmes : SNES, PS1, N64, GBA, Mega Drive, Arcade) :
   - Placez le dossier RetroArch dans : emulators/RetroArch/
   - Exécutable : emulators/RetroArch/retroarch.exe

2. PCSX2 (PlayStation 2) :
   - Placez l'émulateur dans : emulators/PCSX2/
   - Exécutable : emulators/PCSX2/pcsx2-qt.exe

3. Ryujinx / Ryubing (Nintendo Switch) :
   - Placez l'émulateur dans : emulators/Ryujinx/
   - Exécutable : emulators/Ryujinx/Ryujinx.exe

4. Dolphin (GameCube & Wii) :
   - Placez l'émulateur dans : emulators/Dolphin/
   - Exécutable : emulators/Dolphin/Dolphin.exe

5. RPCS3 (PlayStation 3) :
   - Placez l'émulateur dans : emulators/RPCS3/
   - Exécutable : emulators/RPCS3/rpcs3.exe

--------------------------------------------------------------------------------
CONFIGURATION PERSONNALISÉE :
--------------------------------------------------------------------------------
Tous les chemins et options de lignes de commande sont personnalisables dans le
fichier : config/emulators.json
`;
writeFileSync(path.join(portableDir, 'emulators', 'LISEZ-MOI - EMULATEURS.txt'), emuReadme, 'utf-8');

// E. Guide Médias & Jaquettes
const mediaReadme = `================================================================================
                    GUIDE DU DOSSIER MÉDIAS & JAQUETTES
================================================================================

Ce dossier vous permet de stocker des jaquettes, fonds d'écran et logos.

--------------------------------------------------------------------------------
RÈGLES DE NOMMAGE & FORMATS SUPPORTÉS :
--------------------------------------------------------------------------------
• Formats acceptés : .PNG, .JPG, .JPEG, .WEBP
• Ratio recommandé pour les jaquettes : 3:4 (ex: 600 x 800 px ou 900 x 1200 px)
• Nommage : Donnez exactement le même nom à l'image qu'à votre fichier de ROM
  (ou nommez-la "cover.png" dans le sous-dossier dédié du jeu).
`;
writeFileSync(path.join(portableDir, 'media', 'LISEZ-MOI - JAQUETTES ET MEDIAS.txt'), mediaReadme, 'utf-8');

// F. Guide Sauvegardes & Données
const dataReadme = `================================================================================
                    GUIDE DES DONNÉES & SAUVEGARDES (KAIRO_DATA)
================================================================================

Ce dossier contient les fichiers internes générés automatiquement par KaïroOS :
• kairo.db : Base de données SQLite locale contenant l'index des jeux,
  vos favoris (⭐), vos temps de jeu, le nombre de parties et les réglages de la borne.

--------------------------------------------------------------------------------
PORTABILITÉ TOTALE :
--------------------------------------------------------------------------------
Pour transférer votre collection et toutes vos statistiques sur un autre PC ou
une borne d'arcade physique, il vous suffit de copier l'intégralité du dossier
"builds/portable" (ou votre clé USB). Vous retrouverez immédiatement toute votre
configuration sans rien réinstaller !
`;
writeFileSync(path.join(portableDir, 'kairo_data', 'LISEZ-MOI - DONNEES ET SAUVEGARDES.txt'), dataReadme, 'utf-8');

console.log('\n====================================================');
console.log('🎉 PACKAGE KAÏROOS PORTABLE GÉNÉRÉ AVEC SUCCÈS !');
console.log(`📁 Emplacement : ${portableDir}`);
console.log(`🎮 Exécutable  : ${path.join(portableDir, 'KaïroOS.exe')}`);
console.log(`⚙️ Fichiers JSON configurables : ${path.join(portableDir, 'config')}`);
console.log('📝 Guides inclus dans chaque sous-dossier.');
console.log('====================================================\n');
