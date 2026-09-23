# 🔌 Guide de Développement des Plugins KaïroOS

> 📌 **La documentation officielle, le SDK et les guides de conception de plugins ont été centralisés dans le dépôt dédié `kairos-plugins` :**
>
> 👉 **[Consulter le Guide Officiel des Plugins (kairos-plugins)](https://github.com/KairoOS-Official/kairos-plugins/blob/main/PLUGIN_GUIDE.md)**

---

## ⚡ En Bref : L'Architecture des Plugins

- **Protocole Universel** : Les plugins tournent dans leur propre processus système OS et communiquent avec KaïroOS via **`stdin / stdout` en JSON standardisé (`kairo-plugin-host-v1`)**.
- **Polyglotte & Multi-Langages** : Développez vos extensions en Rust, Go, Python, Node.js, C++ ou scripts shell.
- **Isolation Totale** : Le crash d'un plugin n'interrompt jamais KaïroOS ni votre partie de jeu.

Pour explorer les plugins officiels (`kairo-remote`, `kairo-scraper`, `kairo-spotify-screensaver`) et soumettre vos extensions :
👉 **[`https://github.com/KairoOS-Official/kairos-plugins`](https://github.com/KairoOS-Official/kairos-plugins)**
