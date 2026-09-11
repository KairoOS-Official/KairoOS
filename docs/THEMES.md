# 🎨 Guide & Architecture des Thèmes — KaïroOS

KaïroOS propose un moteur de personnalisation visuelle puissant, permettant d'adapter l'expérience aussi bien à une borne d'arcade rétro qu'à un salon moderne sur écran 4K.

---

## 💡 Philosophie : Layouts Structurels vs Palettes de Couleurs

Dans KaïroOS, une distinction fondamentale est faite entre :
1. **Un Layout Structurel (Thème)** : Définit l'architecture complète de l'écran, le placement des éléments (sidebar, hero vidéo, carrousels de rayonnage, grille de cartes, barre manette).
2. **Une Palette de Couleurs (Preset)** : Définit les teintes (sombre OLED, néon cyberpunk, ambre vintage, clair 80s).

> [!IMPORTANT]
> **Pourquoi ne créons-nous pas des clones de thèmes pour chaque couleur ?**  
> Pour éviter la prolifération de thèmes redondants. Chaque thème dans le sélecteur propose une ergonomie et un agencement d'écran uniques. Dans les paramètres du thème, l'utilisateur peut appliquer n'importe quelle palette de couleurs en un clic ou ajuster les codes hexadécimaux de son choix.

---

## 🏛️ Les 3 Layouts Officiels Fournis

| Thème ID | Nom & Rôle | Caractéristiques Visuelles |
| :--- | :--- | :--- |
| **`kairo-default`** | **Arcade Classique** | - Barre latérale gauche repliable avec sélecteur de consoles<br>- Grille de tuiles dynamique avec jaquettes et métadonnées<br>- Idéal pour navigation rapide au stick arcade ou sur écran d'ordinateur |
| **`kairo-hub`** | **Hub Catégories (Sans Sidebar)** | - Interface 100% plein écran sans barre latérale<br>- Rayons horizontaux thématiques : *Consoles*, *Modes de jeu*, *Sagas*, *Favoris*, *Bibliothèque complète*<br>- Navigation fluide et fluide d'un rayon à l'autre |
| **`kairo-console`** | **Console Launcher (Hero TV)** | - Conçu pour grands écrans TV (style Steam Big Picture ou consoles modernes)<br>- En-tête géant avec jaquette/fanart en fondu haute définition, badge d'étoiles et résumé<br>- Carrousel horizontal centré au bas de l'écran<br>- Barre d'actions manette en bas (<kbd>[A] Jouer</kbd>, <kbd>[Y] Détails</kbd>, <kbd>[X] Favori</kbd>) |

---

## 📁 Structure d'un Thème sur le Disque

Les thèmes vivent dans le dossier `themes/` de votre environnement :
- **En mode Portable** : `builds/portable/themes/<id>/`
- **En mode Dev / Installé** : `%APPDATA%\kairo-os\themes\<id>/`

Chaque thème est constitué au minimum des fichiers suivants :

```
themes/mon-nouveau-theme/
├── theme.json           # Métadonnées, variables CSS, agencement et options
└── preview.svg          # Miniature d'aperçu affichée dans le sélecteur (ou preview.png)
```

---

## ⚙️ Spécification du fichier `theme.json`

Voici un exemple annoté d'un fichier `theme.json` :

```json
{
  "id": "mon-nouveau-theme",
  "name": "Mon Nouveau Thème",
  "author": "Votre Nom",
  "version": "1.0.0",
  "description": "Description concise de l'ambiance et du layout",
  "layout_type": "console_launcher", // "classic" | "single_page_categories" | "console_launcher"
  "theme_type": "built-in",          // "built-in" ou "custom-code"
  "colors": {
    "bg_primary": "#080914",
    "bg_secondary": "#0f1026",
    "bg_card": "#151733",
    "sidebar_bg": "#0b0c1e",
    "accent_primary": "#ff007f",
    "accent_secondary": "#00f5ff",
    "text_primary": "#ffffff",
    "text_secondary": "#a5b4fc",
    "text_muted": "#6366f1",
    "border": "#22254d",
    "success": "#00ff88",
    "warning": "#ffd000",
    "danger": "#ff3366"
  },
  "fonts": {
    "primary": "Outfit, Inter, system-ui, sans-serif",
    "arcade": "Press Start 2P, monospace",
    "size_base": "14px"
  },
  "layout": {
    "card_radius": "16px",
    "sidebar_width": "280px",
    "card_gap": "16px",
    "card_glow": "neon",
    "scanlines": "none",
    "show_sidebar": true
  },
  "custom_css": ".kairo-custom-header { text-transform: uppercase; }"
}
```

---

## 🚨 Raccourci d'Urgence : Touche <kbd>Suppr</kbd> / <kbd>Del</kbd>

Si vous testez un thème expérimental ou personnalisez du code CSS qui provoque un écran noir ou une erreur d'affichage :
- Appuyez simplement sur la touche **<kbd>Suppr</kbd>** (ou **<kbd>Del</kbd>**) de votre clavier physique.
- KaïroOS réapplique instantanément le thème officiel de secours `kairo-default` et affiche une notification de confirmation.

---

## 🌐 Publier & Installer via le Community Store

KaïroOS intègre un magasin de thèmes communautaire connecté au dépôt GitHub [`KairoOS-Official/kairos-themes`](https://github.com/KairoOS-Official/kairos-themes).

### Pour télécharger un thème communautaire :
1. Rendez-vous dans **Paramètres** → **Thèmes & Style**.
2. Cliquez sur l'onglet **Store & En ligne**.
3. Parcourez les thèmes partagés par la communauté et cliquez sur **Télécharger**. L'installation et l'extraction sont instantanées.

### Pour soumettre votre propre thème :
1. Forkez le dépôt [kairos-themes](https://github.com/KairoOS-Official/kairos-themes).
2. Créez un nouveau dossier portant l'ID de votre thème (ex: `vaporwave-deluxe/`).
3. Placez votre `theme.json` et votre image `preview.svg` (ou `preview.png`).
4. Ouvrez une Pull Request : une fois fusionnée, votre création apparaîtra automatiquement pour tous les utilisateurs de KaïroOS !
