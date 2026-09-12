# Guide de Développement des Plugins KaïroOS

Bienvenue dans le guide officiel de création d'extensions et plugins pour l'écosystème **KaïroOS**.

---

## 1. Philosophie Fondamentale — Les Deux Règles Absolues

Le système de plugins de KaïroOS repose sur une séparation hermétique et modulaire garantie par deux règles absolues :

### Règle 1 — Zéro Trace Croisée (Core Découplé)
> **Le code source du cœur de KaïroOS ne contient aucune référence hardcodée à aucun plugin particulier.**

- Aucun `import` vers un fichier de plugin spécifique.
- Aucun `if (plugin.id === "kairo-remote")` ou `if (id === "kairo-scraper")`.
- Aucun couplage de schéma de base de données ou de logique métier.
- **Test d'étanchéité** : si l'on supprime n'importe quel plugin (même officiel), KaïroOS continue de compiler, de démarrer et de fonctionner sans aucune régression.

### Règle 2 — Protocole Universel Hôte / Contributeur (`kairo-plugin-host-v1`)
> **Les plugins communiquent et s'étendent mutuellement de manière dynamique, sans passer par le code de KaïroOS.**

- Un plugin peut être **Hôte** (`host`) : il déclare les points d'intégration qu'il expose aux autres plugins.
- Un plugin peut être **Contributeur** (`contributes`) : il déclare à quels hôtes il s'adresse et fournit les métadonnées de son intégration.
- Le moteur de plugins en Rust (`kairo-core`) assure la découverte automatique, le routage des messages et la notification temps réel.

```
┌────────────────────────────────────────────────────────┐
│                   KaïroOS Core (Rust)                  │
│       PluginManager & Event Bus (stdin/stdout)         │
└───────────▲────────────────────────────────▲───────────┘
            │                                │
            │ (Événements JSON stdin)        │ (Découverte)
            ▼                                ▼
┌────────────────────────┐      ┌────────────────────────┐
│     Plugin Hôte        │◄─────┤   Plugin Contributeur   │
│   (ex: kairo-remote)   │      │ (ex: my-achievements)  │
└────────────────────────┘      └────────────────────────┘
```

---

## 2. Structure d'un Plugin

Chaque plugin réside dans son propre répertoire sous `plugins/<nom_plugin>/` :

```
plugins/
  my-achievements/
    plugin.json              # Manifeste de configuration obligatoire
    index.js                 # Point d'entrée (Node.js/Bun) ou binaire exécutable
    remote-ui/               # Interface web contribuée
      index.html
      app.js
      style.css
```

---

## 3. Le Manifeste `plugin.json`

Le fichier `plugin.json` définit l'identité, les permissions, les paramètres et les capacités Hôte/Contributeur du plugin.

### Exemple de Manifeste Hôte (`kairo-remote`)

```json
{
  "id": "kairo-remote",
  "name": "KaïroOS Remote",
  "version": "1.0.0",
  "author": "KaïroOS Team",
  "type": "builtin",
  "description": "Contrôle à distance et serveur d'administration",
  "builtin_service": "remote_server",
  "host": {
    "protocol": "kairo-plugin-host-v1",
    "discovers": [
      "remote_settings_page",
      "remote_api_routes",
      "remote_nav_item",
      "remote_quick_action"
    ]
  },
  "ui": "dist/index.html",
  "commands": ["start", "stop", "restart", "status"],
  "settings_section": {
    "label": "Réseau & Remote",
    "icon": "wifi"
  },
  "settings_schema": {
    "port": {
      "type": "number",
      "default": 8080,
      "label": "Port d'écoute HTTP"
    },
    "pin": {
      "type": "string",
      "secret": true,
      "default": "1234",
      "label": "Code PIN d'accès"
    }
  }
}
```

### Exemple de Manifeste Contributeur (`my-achievements`)

```json
{
  "id": "my-achievements",
  "name": "Retro Achievements Tracker",
  "version": "1.0.0",
  "author": "Community Dev",
  "type": "community",
  "description": "Système de trophées et succès pour les jeux rétro",
  "entry": "index.js",
  "permissions": ["network", "read_games"],
  "contributes": {
    "to": ["kairo-remote"],
    "points": {
      "remote_nav_item": {
        "id": "achievements",
        "label": "Succès & Trophées",
        "icon": "trophy",
        "url": "/plugins/my-achievements/remote-ui/index.html"
      },
      "remote_settings_page": {
        "title": "Configuration des Succès",
        "entry": "remote-ui/index.html"
      },
      "remote_api_routes": [
        {
          "path": "/api/achievements/list",
          "handler": "get_achievements"
        }
      ]
    }
  },
  "settings_section": {
    "label": "Succès",
    "icon": "trophy"
  },
  "settings_schema": {
    "api_key": {
      "type": "string",
      "secret": true,
      "default": "",
      "label": "Clé d'API RetroAchievements"
    }
  }
}
```

---

## 4. Points d'Intégration Standards

Le protocole `kairo-plugin-host-v1` propose des points d'intégration conventionnels :

| Point d'Intégration | Usage | Données Attendues |
|---|---|---|
| `remote_nav_item` | Ajoute un onglet/bouton dans la barre de navigation du serveur distant. | `{ id, label, icon, url, badge }` |
| `remote_settings_page` | Fournit une page de configuration hébergée dans l'administration distante. | `{ title, entry, url }` |
| `remote_api_routes` | Déclare des routes HTTP gérées par le processus du contributeur. | `[{ path, method, handler }]` |
| `remote_quick_action` | Ajoute une action rapide (bouton) sur le tableau de bord distant. | `{ id, label, action, icon }` |
| `overlay_widget` | Injecte un widget flottant sur le HUD de jeu. | `{ id, component, position }` |
| `game_action` | Ajoute une action personnalisée dans le menu contextuel d'un jeu. | `{ id, label, command }` |

---

## 5. Mécanismes de Communication

### A. Communication Temps Réel (Processus Hôte en arrière-plan)
Lorsqu'un plugin contributeur est activé ou démarre, le gestionnaire Rust envoie une notification sur le flux `stdin` du plugin hôte :

```json
{
  "event": "plugin_contributes",
  "from": "my-achievements",
  "integration_point": "remote_nav_item",
  "data": {
    "id": "achievements",
    "label": "Succès & Trophées",
    "url": "/plugins/my-achievements/remote-ui/index.html"
  }
}
```

Lorsqu'un plugin contributeur est arrêté ou désactivé :

```json
{
  "event": "plugin_removed",
  "from": "my-achievements"
}
```

### B. Endpoint REST HTTP Universel
Tout client web ou hôte distant peut interroger l'endpoint universel pour lister les intégrations actives :

```http
GET /api/integrations?host=kairo-remote
```

**Réponse (`200 OK`) :**
```json
{
  "success": true,
  "data": [
    {
      "from": "my-achievements",
      "to": "kairo-remote",
      "integration_point": "remote_nav_item",
      "data": {
        "id": "achievements",
        "label": "Succès & Trophées",
        "url": "/plugins/my-achievements/remote-ui/index.html"
      }
    }
  ]
}
```

### C. Fichiers Statiques Servis Automatiquement
Tous les fichiers situés dans le dossier d'un plugin sont automatiquement servis par le serveur distant sous l'URL :
```
http://<ip_borne>:<port>/plugins/<plugin_id>/<chemin_relatif>
```
*Exemple :* `http://192.168.1.50:8080/plugins/my-achievements/remote-ui/index.html`

---

## 6. Permissions Disponibles

Pour préserver la sécurité de la borne, chaque plugin doit spécifier les permissions requises dans `plugin.json` :

- `network` : Accès aux requêtes HTTP sortantes et sockets.
- `read_games` : Lecture de la liste des jeux et des systèmes.
- `write_games` : Ajout, modification ou suppression de métadonnées de jeux.
- `launch_games` : Capacité de lancer ou stopper un jeu sur la borne.
- `read_settings` : Lecture des préférences de KaïroOS.
- `write_settings` : Modification des préférences de KaïroOS.
- `notifications` : Envoi de toasts et bannières visuelles sur l'écran d'arcade.

---

## 7. Exemple de Code d'un Plugin Contributeur (Node.js)

```javascript
// plugins/my-achievements/index.js
import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.log(JSON.stringify({
  action: 'notify',
  message: 'Plugin Trophées initialisé avec succès !'
}));

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.command === 'status') {
      console.log(JSON.stringify({ status: 'active', trophies_unlocked: 42 }));
    }
  } catch (err) {
    // Ignorer les lignes non-JSON
  }
});
```

---

## 8. Résumé des Bonnes Pratiques

1. **Ne modifiez jamais le code du noyau KaïroOS** pour ajouter une fonctionnalité spécifique à un plugin.
2. Déclarez vos points d'extension dans `plugin.json` avec la section `contributes`.
3. Fournissez des interfaces légères compatibles mobiles (HTML responsive ou React/Vite précompilé).
4. Utilisez les styles CSS natifs ou Tailwind CSS pour vous intégrer visuellement à l'ambiance KaïroOS.
