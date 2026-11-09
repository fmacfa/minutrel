# Modèle de données V0.1

Dans l’interface, les anciennes tâches sont nommées **sous-catégories**. Les noms techniques `tasks`, `taskId` et `taskName` restent inchangés. Aucun intitulé n’est imposé ou créé par défaut ; la description du travail appartient au temps enregistré.

SQLite est stocké sur le serveur commun. Le schéma exécuté se trouve dans [store.ts](../apps/api/src/store.ts). Il porte `PRAGMA user_version=1` ; le code refuse une base d’une version ultérieure. Les clés étrangères et WAL sont activés.

Les identifiants des entités sont des UUID, les instants sont des secondes Unix entières, les dates de travail sont des chaînes ISO `AAAA-MM-JJ`. Les durées sont des secondes entières, sans nombre flottant d’heures.

| Table | Contenu et contraintes |
| --- | --- |
| `workspace` | Espace unique : identité, nom et fuseau des rapports |
| `members` | Identité, e-mail unique sans distinction de casse, rôle, état actif et mot de passe scrypt |
| `sessions` | Empreinte de session, propriétaire, CSRF, type navigateur/natif et expiration |
| `projects` | Nom, description, couleur, archivage et version |
| `assignments` | Association unique projet/membre |
| `tasks` | Tâches d’un projet, nom et archivage |
| `entries` | Membre, projet, tâche facultative, origine, état, description, date déclarée, secondes, version et dates de mise à jour |
| `segments` | Début et fin d’une portion de chronomètre ou d’un intervalle manuel |
| `notes` | Texte, auteur, projet, date, état privé/partagé et origine humaine/assistant |
| `summaries` | Compte rendu mensuel, origine, état brouillon/validé et références de temps |
| `tokens` | Empreinte de jeton MCP personnel, droits, nom et expiration |
| `providers` | Destinataire IA, modèle, activation et secret chiffré |
| `idempotency` | Membre et clé uniques, empreinte de demande, résultat d’origine ; conservation de 30 jours |
| `exports` | Créateur, format, instantané JSON privé et expiration de téléchargement à 24 h |
| `audit` | Acteur, opération, objet, motif/détail et instant |
| `sync_receipts` | Membre et mutation/import uniques, empreinte de contenu et reçu durable ; distinct de l’idempotence courante |

## États et cohérence

Une entrée a l’état `running`, `paused`, `finished` ou `deleted`. L’index unique partiel `one_active_timer` interdit plusieurs entrées `running`/`paused` pour un membre. `one_open_segment` interdit plusieurs segments ouverts par entrée. Les segments fermés ne peuvent pas avoir une fin antérieure au début.

Les opérations composées utilisent une transaction synchrone courte. Le verrou d’écriture est acquis avant la recherche de l’état actif et la vérification de l’idempotence. Aucune requête réseau ni génération de document ne se déroule dans une transaction de temps.

Une suppression de temps est logique et auditée. L’archivage d’un projet garde ses relations et bloque les nouveaux démarrages. Un projet, une affectation ou une tâche encore utilisé par un chronomètre ne peut pas être retiré de façon à rendre ce temps inaccessible.

## Protection des secrets

Le mot de passe est stocké sous forme `sel:clé_dérivée`, jamais en clair. Les jetons de session et MCP sont stockés par empreinte. Les clés de fournisseurs sont chiffrées avec AES-256-GCM et une clé serveur de 32 octets, qui doit accompagner la sauvegarde.

Le trousseau du client ordinateur est distinct de cette base. Il conserve une session native par adresse de serveur. Si le trousseau est indisponible, la session reste uniquement en mémoire et l’interface l’indique.

Le client possède aussi des fichiers locaux `LocalData.schema=1`, enveloppés par une révision Rust. Ils contiennent profil, projets, temps/segments, notes, comptes rendus, file et archives de conflits. Le profil personnel possède son propre emplacement ; chaque compte d’équipe est séparé par serveur et membre. Les corrections personnelles conservent jusqu’à 1 000 traces récentes avec valeur précédente et motif. Ces fichiers ne contiennent pas le jeton de connexion, mais contiennent le travail privé ; leur protection dépend du compte du système. Voir [SYNCHRONISATION.md](SYNCHRONISATION.md).

## Portabilité

L’export JSON `schema_version: 2` contient l’espace, les identités nécessaires à l’association des membres, les projets, affectations, tâches, temps finalisés, segments, notes partagées et comptes rendus validés. Il ne contient ni mots de passe, ni sessions, ni clés de fournisseurs, ni notes privées. Les identifiants de segments y sont opaques et déterministes.

La sauvegarde SQLite est la voie de restauration complète de la V0.1. L’import JSON avec association des comptes est prévu pour la version suivante. Le fichier [d’exemple historique v1](../examples/exports/donnees-exemple.json) demeure une fixture de calcul ; il ne constitue pas une route d’import implémentée.
