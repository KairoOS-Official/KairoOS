# 🎨 Guide Officiel de Création de Thèmes pour KaïroOS

Bienvenue dans le guide officiel de conception et personnalisation de thèmes pour **KaïroOS** !

KaïroOS intègre un moteur de styles entièrement dynamique basé sur les variables CSS natives injectées à chaud sur `:root`. Aucune recompilation n'est nécessaire pour changer l'apparence de l'interface.

---

## 📁 1. Structure d'un Thème

Chaque thème doit résider dans un sous-dossier unique à l'intérieur du répertoire `themes/` de KaïroOS (ou de l'arborescence portable) :

```text
themes/
  mon-super-theme/
    theme.json        <-- Spécification obligatoire (couleurs, polices, agencement)
    preview.png       <-- Capture d'écran représentative (format 16:9 recommandé, ~600x340px)
    assets/           <-- Médias optionnels
      background.jpg  <-- Image de fond personnalisée (optionnel)
      logo.png        <-- Logo de remplacement (optionnel)
      startup.mp3     <-- Son ou jingle de démarrage (optionnel)
```

---

## ⚙️ 2. Format du fichier `theme.json`

Le fichier `theme.json` est le cœur de votre thème. Voici un exemple complet avec toutes les clés supportées :

```json
{
  "id": "mon-super-theme",
  "name": "Mon Super Thème Rétro",
  "author": "VotrePseudo",
  "version": "1.0.0",
  "description": "Description claire et attrayante de votre thème pour le store.",
  "colors": {
    "bg_primary": "#f5f0e8",
    "bg_secondary": "#ede8dc",
    "bg_card": "#ffffff",
    "sidebar_bg": "#e8e0d0",
    "accent_primary": "#e63950",
    "accent_secondary": "#f5a623",
    "text_primary": "#1a1a2e",
    "text_secondary": "#666666",
    "text_muted": "#999999",
    "border": "#d0c8b8",
    "success": "#28a745",
    "warning": "#ffc107",
    "danger": "#dc3545"
  },
  "fonts": {
    "primary": "Inter",
    "arcade": "Press Start 2P",
    "size_base": "14px"
  },
  "layout": {
    "card_radius": "12px",
    "sidebar_width": "260px",
    "card_gap": "16px"
  },
  "assets": {
    "background_image": null,
    "logo_override": null,
    "startup_sound": null
  }
}
```

---

## 🎨 3. Dictionnaire des Variables & Rôles

| Clé JSON | Variable CSS générée | Description |
| :--- | :--- | :--- |
| `bg_primary` | `--bg-primary` | Fond général de l'application et de la scène principale. |
| `bg_secondary` | `--bg-secondary` | Fond alternatif pour les en-têtes, barres d'outils et blocs secondaires. |
| `bg_card` | `--bg-card` | Fond des cartes de jeux et des conteneurs modulaires. |
| `sidebar_bg` | `--sidebar-bg` | Fond de la barre latérale de navigation gauche. |
| `accent_primary` | `--accent-primary` | Couleur d'accentuation principale (boutons d'action, focus actif, badges vifs). |
| `accent_secondary` | `--accent-secondary` | Couleur d'accentuation secondaire (étoiles de notation, surbrillances). |
| `text_primary` | `--text-primary` | Texte principal à fort contraste (titres, noms des jeux). |
| `text_secondary` | `--text-secondary` | Texte secondaire (métadonnées, plateformes, descriptions). |
| `text_muted` | `--text-muted` | Textes discrets, compteurs et labels inactifs. |
| `border` | `--border-color` | Lignes de séparation et contours des cartes. |
| `success` | `--color-success` | Statut positif (sauvegarde réussie, borne connectée). |
| `warning` | `--color-warning` | Avertissements et notifications de sécurité. |
| `danger` | `--color-danger` | Boutons d'arrêt, actions destructives ou erreurs. |
| `fonts.primary` | `--font-primary` | Typographie principale pour l'UI. |
| `fonts.arcade` | `--font-arcade` | Typographie pixel-art/arcade pour les titres et bannières. |
| `layout.card_radius` | `--card-radius` | Arrondi des angles des jaquettes et conteneurs (ex: `12px` ou `0px` pour look sharp). |
| `layout.sidebar_width` | `--sidebar-width` | Largeur de la barre latérale desktop (ex: `260px`). |
| `layout.card_gap` | `--card-gap` | Espacement entre les éléments de la grille du catalogue. |

---

## 🚀 4. Comment Tester Votre Thème en Direct

1. Créez un dossier avec l'identifiant de votre thème dans le répertoire `themes/` de KaïroOS.
2. Déposez-y votre `theme.json` et votre capture `preview.png`.
3. Ouvrez les **Paramètres** de KaïroOS (`SettingsModal`) et rendez-vous dans l'onglet **Thèmes**.
4. Cliquez simplement sur votre thème : **l'aperçu visuel s'applique immédiatement en temps réel** !
5. Cliquez sur **Appliquer** pour sauvegarder votre sélection.

---

## 📺 5. Mode Console Launcher TV (`layout_type: "console_launcher"`)

KaïroOS supporte nativement une disposition de type **Console Launcher / Steam Big Picture / Batocera** sans avoir besoin d'écrire du code TypeScript ni de recompiler l'application.

Pour activer cette interface, ajoutez simplement `"layout_type": "console_launcher"` (ou `"hero_carousel"`) dans votre `theme.json` :

```json
{
  "id": "mon-theme-console",
  "name": "Mon Launcher Console",
  "author": "VotrePseudo",
  "version": "1.0.0",
  "description": "Thème console plein écran avec grand Hero et carrousel horizontal.",
  "layout_type": "console_launcher",
  "layout": {
    "hero_height": "56vh",
    "carousel_position": "bottom",
    "cards_visible": 5,
    "show_controller_guide": true,
    "hero_backdrop_blur": "0px",
    "hero_gradient_opacity": 0.75,
    "card_glow": "neon",
    "card_aspect": "poster"
  },
  "custom_css": "/* Personnalisation CSS du launcher */\n.kairo-carousel-card-focused {\n  border-color: #f43f5e !important;\n  box-shadow: 0 0 25px rgba(244, 63, 94, 0.5) !important;\n}"
}
```

### Classes CSS & Points d'ancrage disponibles dans `custom_css` :

| Sélecteur CSS | Rôle & Description |
| :--- | :--- |
| `.kairo-console-launcher` | Conteneur racine plein écran du launcher console. |
| `.kairo-launcher-topbar` | En-tête supérieur (marque Kaïro, horloge temps réel, statut manette). |
| `.kairo-hero` | Zone Hero supérieure affichant les détails du jeu focalisé. |
| `.kairo-hero-backdrop` | Image géante d'arrière-plan avec transitions en fondu. |
| `.kairo-hero-content` | Bloc textuel d'informations (titre, étoiles, badges, boutons). |
| `.kairo-hero-title` | Titre percutant du jeu focalisé. |
| `.kairo-hero-meta` | Métadonnées du jeu (note en étoiles, plateforme, genre, nb joueurs). |
| `.kairo-hero-actions` | Conteneur des boutons d'actions rapides. |
| `.kairo-hero-btn-play` | Bouton principal `[A JOUER]`. |
| `.kairo-hero-btn-action` | Boutons secondaires `[X Favori]` et `[Y Options]`. |
| `.kairo-carousel` | Rangée défilante horizontale de pochettes de jeux. |
| `.kairo-carousel-card` | Carte de jeu dans le carrousel. |
| `.kairo-carousel-card-focused` | Carte ayant le focus manette/clavier actif (`[data-active="true"]`). |
| `.kairo-controller-bar` | Barre d'aide manette en bas avec glyphes réels. |

---

## 🌐 6. Soumettre Votre Thème au Store Communautaire

Le store officiel est hébergé sur GitHub :
👉 **[https://github.com/KairoOS-Official/KairoOS-themes](https://github.com/KairoOS-Official/KairoOS-themes)**

Pour partager votre création avec l'ensemble des utilisateurs de KaïroOS :

1. **Forkez** le dépôt `KairoOS-Official/KairoOS-themes`.
2. Ajoutez votre dossier de thème à la racine du dépôt (ex: `mon-super-theme/`).
3. Vérifiez que votre `theme.json` est un JSON valide et que `preview.svg` (ou `preview.png`) est présent.
4. Créez une **Pull Request** avec une capture d'écran et une brève description.
5. Une fois validé et fusionné, votre thème sera instantanément téléchargeable directement depuis l'onglet **Store & En ligne** de l'interface KaïroOS !

> 💡 **Pas de compte GitHub ?** Vous pouvez aussi soumettre votre thème par email à themes@kairo-os.com ou sur Discord dans le canal #theme-submissions.