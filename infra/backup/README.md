# Sauvegarder et restaurer Minutrel V0.1

La sauvegarde utilise l’API SQLite de Node pour produire une copie cohérente, même si le serveur est actif et utilise WAL. Elle emporte `minutrel.sqlite`, `master.key`, le secret initial s’il existe et un manifeste. La clé permet de retrouver les secrets de fournisseurs chiffrés. Le dossier produit est réservé à son propriétaire.

## Lancement Node

```sh
npm run backup
```

Le dossier daté apparaît dans `backups/`. Pour choisir les emplacements :

```sh
node scripts/backup.mjs --data data --out backups/ma-sauvegarde
```

Si `APP_MASTER_KEY` est fourni dans l’environnement, cette valeur est intégrée à la sauvegarde plutôt qu’une autre clé de fichier.

## Docker Compose

```sh
docker compose exec -T minutrel node scripts/backup.mjs --out /backups/ma-sauvegarde
mkdir -p backups
docker compose cp minutrel:/backups/ma-sauvegarde backups/ma-sauvegarde
```

Employer un nom nouveau à chaque sauvegarde. Conserver une copie hors du volume d’origine selon les besoins de l’instance. Le volume `/backups` reste un emplacement local de travail, distinct du volume de la base.

## Restauration

Arrêter le serveur avant de restaurer. Le script refuse un dossier cible non vide et ne remplace aucune base existante :

```sh
node scripts/backup.mjs --restore backups/ma-sauvegarde --data data-restauree
```

Le script contrôle l’intégrité SQLite avant de publier la copie restaurée. Il invalide les sessions web et ordinateur ainsi que les jetons MCP et webhook. Les membres doivent se reconnecter et recréer les jetons utilisés par leurs intégrations. Vérifier les comptes et rôles qui ont changé depuis la sauvegarde. Démarrer ensuite avec `APP_DATA_DIR` pointant vers le dossier restauré, dans un environnement utilisant la même version de Minutrel ou une version compatible. Pour Docker, préparer un volume vide, y copier les fichiers restaurés avec les droits de l’utilisateur `node` (UID 1000), puis le monter sur `/app/data`.

Les variables externes telles que l’adresse publique, le proxy HTTPS et les noms des moteurs restent des paramètres de déploiement ; les sauvegarder avec la procédure d’exploitation de l’instance.

## Vérification

Le test [persistence.test.ts](../../apps/api/src/persistence.test.ts) démarre un temps, redémarre le serveur, finalise ce temps, sauvegarde une base ouverte et restaure une copie. Il vérifie la durée et le déchiffrement d’un secret fictif. Un export JSON de l’interface est un export de portabilité du travail partagé ; la restauration complète de la V0.1 utilise cette sauvegarde SQLite.
