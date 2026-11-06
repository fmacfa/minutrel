# Espaces locaux et synchronisation — V0.1

Un ordinateur peut utiliser Minutrel sans serveur. L’espace personnel et chaque compte d’équipe sont des espaces distincts. La connexion à une équipe est facultative ; le partage entre plusieurs personnes nécessite le serveur commun.

## Espace autonome

L’interface locale gère projets/tâches, chronomètre segmenté, saisies manuelles, corrections, notes, comptes rendus manuels, rapports et exports CSV/PDF/ZIP/JSON. Aucun processus Node, serveur, modèle IA ou compte distant n’est embarqué. Le stockage utilise le pont Rust du client Tauri et des documents JSON versionnés, limités à 16 Mio par espace. Le PDF est chargé à la demande.

Le client écrit un fichier temporaire, synchronise son contenu, conserve la version précédente puis remplace le fichier courant. Une révision comparée dans un verrou Rust évite qu’une fenêtre principale et un widget écrasent leurs écritures. Un fichier courant invalide peut être relu depuis sa copie précédente. Les dossiers sont privés et les fichiers sont créés en `0600` sur Unix ; la protection des fichiers locaux repose sur le compte du système. Ils ne sont pas chiffrés par une clé indépendante de ce compte.

Le chemin dépend d’une empreinte SHA-256 stable du serveur et du membre ; le profil personnel possède son propre emplacement. Les jetons de connexion restent dans le trousseau et ne font pas partie des copies JSON. Les sauvegardes locales contiennent en revanche les descriptions, notes privées et archives de conflits.

## Compte d’équipe et coupures

La première connexion prépare le compte, les projets autorisés et le temps courant. En mode relié, toute commande de chronomètre et toute nouvelle saisie manuelle est persistée dans une file locale avant confirmation. La synchronisation conserve les segments et calcule les secondes côté serveur. Un accusé déjà reçu est reconnu de nouveau sans réécriture ; les reçus de synchronisation ne sont pas purgés avec l’idempotence REST courante de 30 jours.

L’horloge du client est ajustée par la dernière heure reçue du serveur. Un recul de l’horloge bloque une nouvelle transition ; le serveur refuse aussi des dates trop éloignées dans le futur. Les heures de travail ne sont ni arrondies à la minute ni inventées par un assistant. Les projets, comptes, corrections de temps serveur et intégrations nécessitent la connexion ; la V0.1 ne synchronise pas hors connexion toutes les entités de gestion.

Les projets déjà disponibles et le chronomètre peuvent être retrouvés après redémarrage hors connexion. Après 30 jours sans vérification du compte, l’ouverture de la copie d’un compte d’équipe demande une nouvelle connexion. Le profil personnel autonome ne dépend pas de cette échéance.

L’historique personnel effectivement chargé en ligne est conservé, dans la limite de 5 000 temps en cache. Il ne constitue pas une copie complète de l’équipe : les vues hors connexion portent sur ce cache personnel, et sélectionner les temps d’un collègue exige le serveur. Pour des totaux mensuels collectifs définitifs, rétablir la connexion et attendre la synchronisation de tous les membres.

## Conflits

Le serveur vérifie à chaque envoi : membre actif, accès au projet et à la tâche, version attendue, segments cohérents, absence de chevauchement non confirmé et unicité du chronomètre actif. Les anciens segments déjà acceptés ne sont pas remplacés par une synchronisation. Un temps finalisé sur le serveur se corrige par le parcours motivé habituel.

Une erreur de droits, de version ou de chevauchement interrompt les envois et conserve la file. La reprise automatique ne transforme pas un conflit en succès. Le membre peut terminer le temps local, exporter sa copie, comparer le serveur, puis **Archiver la file et conserver le serveur**. Les propositions sont conservées dans les archives locales. Une réintroduction manuelle des durées manquantes reste nécessaire après vérification ; la V0.1 ne fusionne pas automatiquement deux historiques divergents.

Un changement de compte n’applique pas l’accusé d’un ancien compte dans le nouvel espace. Une modification produite pendant un envoi conserve sa propre proposition et prend pour base la version effectivement acceptée. Les reçus anciens d’une seconde fenêtre ne doivent pas ramener un temps à un état déjà dépassé.

## Rattacher un travail personnel à une équipe

Après finalisation des temps personnels et connexion à l’équipe, le membre choisit explicitement les correspondances de projets. Les temps sélectionnés sont copiés vers son compte avec des identifiants d’import stables. Les originaux restent locaux. Tâches et notes privées ne sont pas envoyées automatiquement. Un changement de correspondance après un premier envoi est refusé et demande une vérification.

Le transfert personnel n’est pas une réplication de tous les objets, une création automatique de projets ou une connexion entre plusieurs équipes.

## Recette à maintenir

- Compter sans serveur, fermer/réouvrir, reprendre et terminer.
- Démarrer sur le web, commander depuis un client ordinateur, perdre la connexion puis rétablir le serveur.
- Rejouer un accusé perdu, envoyer depuis deux fenêtres et modifier pendant l’envoi.
- Changer de compte pendant une réponse et vérifier l’isolation des espaces.
- Refuser un chevauchement, une version périmée, un droit retiré et une horloge incohérente sans perdre la proposition.
- Transférer les mêmes temps personnels plusieurs fois sans doublon.

Voir [les tests et mesures consignés](VALIDATION_CI.md) et [le guide utilisateur](guide/fr/README.md).
