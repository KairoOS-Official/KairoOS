# Documentation des Commandes de la Console Admin KaïroOS

La console admin permet d'exécuter des commandes système et de diagnostic à distance sur la borne KaïroOS via l'interface PWA (`/api/console`).

## Authentification & Sécurité

- **Protection par PIN** : Chaque requête envoyée à la console doit inclure l'en-tête HTTP `X-Kairo-Pin` correspondant au code PIN configuré dans `config/remote.json`.
- **Whitelist de sécurité** : Seules les commandes dont le premier mot figure dans la liste blanche autorisée peuvent être exécutées sur le système hôte.

---

## Liste des Commandes Autorisées & Usage

### 1. Diagnostic Réseau & Connexions

| Commande | Description | Exemple / Variable |
| :--- | :--- | :--- |
| `ipconfig` | Affiche la configuration réseau (IPv4, IPv6, masques, passerelles) sous Windows. | `ipconfig /all` |
| `ifconfig` | Affiche les interfaces réseau sous systèmes Linux/macOS. | `ifconfig` |
| `ping` | Teste la connectivité réseau vers une IP ou un nom de domaine. | `ping 8.8.8.8` |
| `netstat` | Liste les ports réseau ouverts, écoutes actives et connexions établies. | `netstat -an` |

### 2. Informations système & Processus

| Commande | Description | Exemple / Variable |
| :--- | :--- | :--- |
| `systeminfo` | Donne le détail complet du système d'exploitation, RAM, processeur, uptime. | `systeminfo` |
| `tasklist` | Liste tous les processus en cours d'exécution sur la borne (ex: RetroArch, KaïroOS). | `tasklist` |
| `taskkill` | Termine un processus par son nom ou son PID. | `taskkill /IM retroarch.exe /F` |
| `hostname` | Affiche le nom réseau de la machine borne. | `hostname` |
| `whoami` | Identifie l'utilisateur Windows/Linux qui exécute KaïroOS. | `whoami` |
| `ver` | Affiche la version exacte de Windows. | `ver` |
| `uname` | Affiche les informations sur le noyau Linux/macOS. | `uname -a` |

### 3. Fichiers & Système de fichiers

| Commande | Description | Exemple / Variable |
| :--- | :--- | :--- |
| `dir` | Liste le contenu du répertoire courant ou spécifié sous Windows. | `dir roms` |
| `ls` | Liste les fichiers et dossiers (Linux/macOS/Git Bash). | `ls -la` |
| `cat` | Affiche le contenu d'un fichier texte. | `cat config/settings.json` |
| `type` | Affiche le contenu d'un fichier texte sous Windows CMD. | `type config\remote.json` |
| `echo` | Affiche un message ou teste l'interprète de commande. | `echo KaïroOS Test` |

### 4. Développement & Maintenance KaïroOS

| Commande | Description | Exemple / Variable |
| :--- | :--- | :--- |
| `git` | Commandes de versioning Git (statut, logs, branche). | `git status`, `git log -n 5` |
| `cargo` | Outils de compilation Rust (vérification du backend). | `cargo check` |
| `npm` | Gestionnaire de paquets & scripts Node.js pour le frontend. | `npm run build:remote` |
| `powershell` | Exécute des scripts PowerShell autorisés. | `powershell Get-Process` |

---

## Ajouter une nouvelle commande à la Whitelist

Pour ajouter une nouvelle commande à la whitelist autorisée :
1. Ouvre le fichier [`crates/kairo-core/src/remote/mod.rs`](file:///C:/Users/propo/Music/Kairo/crates/kairo-core/src/remote/mod.rs).
2. Dans le handler `console_exec`, ajoute le binaire dans le tableau `allowed` :
```rust
let allowed = [
    "echo", "ping", "ipconfig", "ifconfig", "systeminfo",
    "tasklist", "taskkill", "dir", "ls", "cat", "type",
    "netstat", "whoami", "hostname", "ver", "uname",
    "cargo", "npm", "git", "powershell", "votre_commande"
];
```
3. Met à jour ce document `docs/COMMANDS.md`.
