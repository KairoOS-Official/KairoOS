# Architecture de KairoOS

## Vue d'ensemble

KairoOS est une application desktop Tauri :

```text
React/Vite (src/) -> API Tauri -> Rust/Tauri (src-tauri/) -> kairo-core (crates/kairo-core/)
```

## Frontend

`src/` contient l'interface React et tout ce qui s'execute dans la WebView :

- `components/` : ecrans, panneaux et modales UI ;
- `hooks/` : logique React reutilisable ;
- `api/` : appels vers Tauri et services applicatifs ;
- `types/` : contrats TypeScript ;
- `themes/` : integration des themes ;
- `plugins/` : hote et ponts d'affichage des plugins ;
- `scanner/`, `launcher/`, `remote/`, `db/` : acces frontend aux fonctionnalites du core ;
- `assets/` et `public/` : ressources statiques.

Vite compile le frontend dans `dist/`. Ce dossier est genere et ne doit pas
etre modifie a la main.

## Backend et application desktop

`src-tauri/` contient l'application Tauri :

- `src/commands.rs` : commandes exposees au frontend ;
- `src/main.rs` : demarrage de l'application ;
- `src/` : integration Tauri, permissions et services desktop ;
- `tauri.conf.json` : fenetre, bundle et configuration Tauri ;
- `capabilities/` : permissions Tauri ;
- `icons/` : icones de distribution.

`crates/kairo-core/` contient le domaine metier Rust partage :

- resolution des chemins et donnees ;
- base SQLite et modeles ;
- scan des jeux ;
- lancement des emulateurs ;
- themes, plugins et telecommande.

Le core ne doit pas dependre des composants React.

## Configuration et ressources locales

- `config/` : fichiers de configuration modeles du projet ;
- `.live/` : donnees dev, emulateurs, plugins, themes et sorties de build ;
- `scripts/` : commandes de developpement et packaging ;
- `.cargo/` : emplacement central des artefacts Cargo ;
- `docs/` : documentation maintenue du projet.

Les emulateurs, plugins et themes de developpement sont lus depuis
`.live/`, jamais depuis une copie dans `Kairo/`.

## Regles de modification

1. Une modification UI commence dans `src/`.
2. Une commande desktop ou un acces fichier passe par `src-tauri/`.
3. Une regle metier partagee va dans `crates/kairo-core/`.
4. Les fichiers generes restent dans `dist/` ou `.live/builds/`.
5. Les donnees locales et secrets ne vont jamais dans Git.
