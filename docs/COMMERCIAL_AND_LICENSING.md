# ⚖️ Licence, Exploitation Commerciale & Modèle Opérateur — KaïroOS

> **Document de référence légale et stratégique pour KaïroOS.**  
> Dernière mise à jour : Septembre 2026.

---

## 🎯 1. Philosophie & Vision du Projet

**KaïroOS** est un frontend d'arcade moderne, unifié et navigable à 100% à la manette ou au joystick, conçu avec passion par **Flow (Florian) — FlowCreativeStudio** et la communauté.

Le projet repose sur deux piliers fondamentaux :
1. **Accès libre et gratuit pour la communauté** : Tout passionné de rétrogaming, bidouilleur ou joueur à domicile doit pouvoir installer, utiliser, explorer le code source et profiter de KaïroOS sur sa propre machine sans débourser un centime.
2. **Protection stricte contre l'appropriation commerciale sauvage** : KaïroOS ne peut pas être pillé, renommé (*white-labeling* / *rebranding* sans autorisation), revendu préinstallé sans accord, ou exploité dans un lieu public générant des revenus (bornes à pièces/jetons, bars d'arcade, salons professionnels) sans une juste contribution ou une licence commerciale officielle.

---

## 📜 2. Les Deux Modes d'Utilisation

\                                    ┌─────────────────────────────────────┐
                                    │               KaïroOS               │
                                    └──────────────────┬──────────────────┘
                                                       │
                     ┌─────────────────────────────────┴─────────────────────────────────┐
                     ▼                                                                   ▼
       ┌───────────────────────────┐                                       ┌───────────────────────────┐
       │     USAGE PERSONNEL       │                                       │     USAGE COMMERCIAL      │
       │    (Gratuit & Ouvert)     │                                       │   (Licence Pro Requise)   │
       ├───────────────────────────┤                                       ├───────────────────────────┤
       │ • Salon, PC de jeu, borne │                                       │ • Borne vendue ou louée   │
       │   privée à domicile       │                                       │ • Monnayeur à pièces /    │
       │ • 100% Gratuit            │                                       │   système de jetons payant│
       │ • Code source accessible  │                                       │ • Bar gaming, hôtel, salon│
       │ • Nom KaïroOS & crédits   │                                       │ • Licence Opérateur       │
       │   obligatoires            │                                       │   partenaire obligatoire  │
       └───────────────────────────┘                                       └───────────────────────────┘
\
### A. Usage Personnel & Non-Commercial (100% Gratuit)
Est considéré comme un usage personnel :
- L'installation sur un ordinateur personnel, un mini-PC de salon, un meuble de borne d'arcade privé situé au domicile privé de l'utilisateur.
- L'usage familial, amical ou associatif strictement bénévole (sans droit d'entrée payant ni monnayeur payant).
- L'inspection, la modification locale du code source pour son propre usage personnel et la contribution au projet officiel sur GitHub.

**Conditions requises** :
- Respect de la mention de copyright originale.
- Interdiction stricte de supprimer ou masquer le nom **KaïroOS**, le logo officiel ou les crédits dans l'interface.

---

### B. Usage Commercial & Professionnel (Licence Requise)
Est classé comme **Usage Commercial** toute situation où KaïroOS est utilisé directement ou indirectement pour générer des revenus, notamment :
1. **Constructeurs et revendeurs de bornes d'arcade / bartops / consoles portables** : Vente ou location de matériel physique intégrant KaïroOS préinstallé ou prêt à l'emploi.
2. **Bornes à monnayeur / jetons payants** : Exploitation d'une borne équipée d'un monnayeur (pièces de monnaie, jetons achetés au comptoir, terminal bancaire CB/NFC) exigeant un paiement pour créditer du temps ou des parties.
3. **Établissements commerciaux recevant du public** : Bars gaming, salles d'arcade, hôtels, campings, escape games, conventions ou salons événementiels où l'accès à la borne fait partie d'une offre commerciale directe ou indirecte (consommation obligatoire, billet d'entrée).
4. **Services payants d'installation ou d'intégration** : Vente de prestations commerciales personnalisées basées sur KaïroOS.

**Obligation** : Tout usage commercial nécessite **l'obtention préalable d'une Licence Commerciale Opérateur (*KaïroOS Pro*)** ou d'un contrat de partenariat officiel signé avec l'équipe KaïroOS.

---

## 🛡️ 3. Protection de la Marque & Anti-Rebranding

Pour préserver l'intégrité du projet et empêcher les arnaques commerciales :
- **Le nom « KaïroOS » et son logo officiel** sont protégés.
- **Interdiction de White-Label non autorisé** : Il est formellement interdit de modifier le code pour remplacer l'identité visuelle de KaïroOS par un autre nom de marque afin de le commercialiser en faisant croire qu'il s'agit d'un système propriétaire.
- Seuls les partenaires certifiés ayant souscrit à une licence OEM officielle peuvent bénéficier d'une option de co-branding (*« Powered by KaïroOS »*).

---

## 🪙 4. Le Système de Monnayeur, Jetons & Financement Éthique

### Pourquoi ce modèle ?
Dans l'histoire du rétrogaming, de nombreux constructeurs peu scrupuleux ont exploité le travail de projets open-source bénévoles (comme RetroPie ou Batocera) pour vendre des bornes à plusieurs milliers d'euros sans jamais reverser un centime aux développeurs qui maintiennent les émulateurs et le frontend.

KaïroOS fait le choix d'un **modèle équitable et pérenne** :
- Si un professionnel gagne sa vie grâce à la qualité de l'interface, la gestion du Kiosk et la fluidité de KaïroOS, **il contribue financièrement au maintien et à l'évolution du logiciel**.

### L'Extension Officielle « KaïroOS Operator »
Pour répondre aux besoins spécifiques des exploitants de bornes payantes, une suite d'outils professionnels dédiée est proposée :
- **Pilote universel de monnayeur** : Support des interfaces monnayeurs à impulsions (GPIO, cartes encodeuses USB/série, protocoles ccTalk).
- **Dashboard de rentabilité** : Suivi précis du nombre de jetons et pièces encaissés par jour, par semaine et par mois.
- **Statistiques des jeux les plus joués** : Analyse de rentabilité pour savoir quels titres attirent le plus de crédits dans la salle.
- **Télésurveillance & alertes mobiles** : Suivi de l'état de la borne et des recettes à distance via \kairo-remote\ pour le gérant.
- **Verrouillage Kiosk inviolable certifié exploitant** : Empêche toute sortie vers le bureau Windows, les réglages sensibles ou l'Explorateur de fichiers.

Cette suite est activée par une **clé de licence Opérateur**, délivrée dans le cadre d'un abonnement mensuel/annuel ou d'un palier de mécénat/financement participatif dédié (GitHub Sponsors / Patreon Pro).

---

## 📡 5. Télémétrie & Conformité RGPD

KaïroOS applique une politique de **confidentialité stricte** conforme au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679).

### A. Données collectées (Minimisation stricte)
La télémétrie de conformité et de santé système ne collecte **AUCUNE donnée personnelle** de joueur :
- ❌ Aucun nom, prénom, email ou identifiant de joueur.
- ❌ Aucun enregistrement de micro, caméra ou saisie clavier.
- ❌ Aucune adresse IP stockée en clair dans les bases de statistiques.

Les seules données transmises de manière anonymisée sont :
1. **Identifiant matériel haché (*Machine Hash*)** : Généré localement de manière irréversible à partir d'un sel cryptographique.
2. **Version du logiciel & Système d'exploitation** (ex: \0.1.0-alpha\, \Windows 11 x64\).
3. **Statut de licence** (\community_free\ ou \operator_pro\).
4. **Compteurs globaux d'activité** : Nombre total de sessions de jeu lancées, nombre global d'impulsions de monnayeur/jetons enregistrées sur la machine.

### B. Base légale & Transparence
- **Base légale RGPD** : *Intérêt légitime* de l'éditeur pour la prévention de la fraude, la vérification du respect des termes de licence et l'amélioration de la stabilité logicielle.
- **Option de désactivation** : Sur les machines domestiques personnelles, l'utilisateur conserve la possibilité de désactiver l'envoi de métriques anonymes dans les paramètres du système.
- **Fonctionnement Offline garanti** : KaïroOS est un système autonome. Une borne non reliée à Internet fonctionne parfaitement à 100%. Pour les exploitants professionnels, la validation de licence peut s'effectuer via un certificat cryptographique hors-ligne ou une synchronisation périodique.

---

## 🤝 6. Comment nous contacter pour un projet Pro ?

Vous êtes :
- Un **fabricant ou artisan de bornes d'arcade** souhaitant préinstaller KaïroOS sur vos créations ;
- Un **gérant de bar d'arcade, hôtel, cinéma ou salle de jeux** ;
- Une **agence événementielle** proposant des bornes en location ;
- Un investisseur ou sponsor souhaitant soutenir le développement :

📩 **Contact Officiel Partenariats & Licences Pro** :
- **Email** : \contact@kairoos.org\ ou \pro@kairoos.org- **GitHub Discussions / Sponsors** : [https://github.com/KairoOS-Official/KairoOS](https://github.com/KairoOS-Official/KairoOS)
- **Fondateur** : Florian — FlowCreativeStudio ([@NayrolfRdgs](https://github.com/NayrolfRdgs))
