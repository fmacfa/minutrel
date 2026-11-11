# Autohéberger Minutrel V0.1

Guide vidéo en anglais : [installer et autohéberger Minutrel sur YouTube](https://youtu.be/HklZXL_R114). [Télécharger le MP4](videos/minutrel-12-self-host.mp4) · [Tous les guides et sous-titres](VIDEOS.md).

Une instance possède un espace d’équipe et une base SQLite commune. Les clients web et ordinateur ne nécessitent aucun service commercial. Docker Compose est la voie la plus courte ; Node.js 24 peut aussi lancer le serveur directement.

## Docker Compose

Depuis la racine des sources :

```sh
cp .env.example .env
docker compose up -d --build
docker compose exec minutrel cat /app/data/setup-token
```

Ouvrir `http://127.0.0.1:8080`, saisir le secret d’installation affiché, puis créer l’espace et son premier administrateur. Ce secret ne crée plus de compte une fois l’espace initialisé. Les comptes suivants sont créés par l’administrateur dans **L’équipe**.

Le [Compose](../compose.yml) construit une seule application qui sert l’interface, l’API et MCP. Le processus s’exécute sans privilèges, avec une racine de conteneur en lecture seule, un volume `/app/data`, un volume `/backups` et un dossier temporaire borné. Le volume de données contient la base, son journal et la clé de chiffrement. Conserver ce volume lors des mises à jour.

Le volume de sauvegardes reste sur l’hôte Docker ; la [procédure de sauvegarde](../infra/backup/README.md) permet d’en emporter une copie.

## Adresse HTTPS pour l’équipe

Placer un proxy HTTPS devant l’application. Par exemple, avec Caddy sur la machine hôte :

```caddyfile
temps.votre-equipe.fr {
    reverse_proxy 127.0.0.1:8080
}
```

Définir dans `.env` :

```dotenv
APP_PUBLIC_URL=https://temps.votre-equipe.fr
APP_SECURE_COOKIES=true
```

Puis appliquer la configuration :

```sh
docker compose up -d
```

Pour que la limite des tentatives de connexion utilise l’adresse de chaque client, renseigner `APP_TRUSTED_PROXIES` avec les adresses IP des proxys effectivement vus par le serveur. Pour Node et Caddy sur le même hôte en IPv4, c’est généralement `127.0.0.1`. Avec Compose, vérifier l’adresse du proxy ou de la passerelle hôte sur le réseau du conteneur (par exemple avec `docker network inspect minutrel_default`). Le proxy d’entrée doit définir `X-Forwarded-For` à partir de la connexion du client. Garder le port Minutrel accessible uniquement au proxy ou à la machine locale. [Comportement des en-têtes avec Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults).

Le proxy doit conserver le `Host` public et laisser passer `/api/`, `/mcp` et `/hooks/`. Les événements SSE demandent l’absence de buffering et un délai de lecture long. Un exemple nginx est fourni dans [infra/docker/nginx.conf](../infra/docker/nginx.conf).

Chaque membre ouvre l’adresse HTTPS dans son navigateur et la saisit dans le client ordinateur. Le client natif accepte HTTP uniquement pour `localhost`, `127.0.0.1` ou `::1` ; une instance sur un autre ordinateur utilise HTTPS avec un certificat reconnu par le système.

Si le proxy est lui-même conteneurisé, le relier au réseau de l’application et viser `minutrel:8081`. Ne pas publier le port de l’application en direct si le proxy suffit. Le bind par défaut reste `127.0.0.1` ; `MINUTREL_BIND_ADDR` permet un autre choix explicite.

## Configuration

| Variable | Usage |
| --- | --- |
| `APP_PUBLIC_URL` | Origine publique exacte autorisée pour les écritures du navigateur |
| `APP_TRUSTED_PROXIES` | Adresses IP des proxys de confiance, séparées par des virgules. Vide pour un accès direct |
| `APP_SECURE_COOKIES` | `true` derrière HTTPS ; `false` uniquement pour l’essai HTTP local |
| `APP_DATA_DIR` | Dossier persistant ; fixé à `/app/data` dans l’image |
| `APP_SETUP_TOKEN` | Remplace le secret initial généré automatiquement, si l’exploitant le fournit |
| `APP_MASTER_KEY` | Clé de 32 octets encodée en base64url ; sinon générée dans `master.key` |
| `APP_AI_ALLOWED_HOSTS` | Liste des hôtes exacts autorisés à recevoir les demandes IA |
| `APP_HOST`, `APP_PORT` | Écoute Node, `127.0.0.1:8081` hors Docker |
| `APP_WEB_DIR` | Interface construite ; déterminée automatiquement dans le dépôt |
| `MINUTREL_PORT` | Port publié par Compose, `8080` par défaut |

Le fichier `.env` est lu par Compose. En lancement Node, les variables doivent être exportées dans l’environnement ; le serveur ne charge pas automatiquement `.env`.

## Sans Docker

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Le serveur sert l’application sur `http://127.0.0.1:8081`. Le dossier `data/` est créé à la racine du projet. La même configuration HTTPS et la même procédure de sauvegarde s’appliquent. Si `APP_PUBLIC_URL` est défini, sa valeur doit correspondre à l’adresse utilisée par le navigateur.

Un seul processus serveur doit exploiter le dossier SQLite de cette instance. La V0.1 ne propose pas de déploiement en plusieurs réplicas ni de base sur un partage réseau.

## Moteurs IA

Aucun moteur n’est nécessaire pour les chronomètres et les rapports. Un fournisseur se configure dans **Les connexions** avec son URL `/v1`, son modèle et sa clé éventuelle. Ajouter son nom d’hôte à `APP_AI_ALLOWED_HOSTS` avant de l’activer. Les noms `ollama`, `vllm` et `api.anthropic.com` font partie de la configuration d’exemple.

Dans un conteneur, `localhost` désigne le conteneur. Relier le moteur au réseau approprié ou définir une adresse de serveur explicitement autorisée. La clé reste côté serveur ; le modèle s’exécute sur le fournisseur choisi.

## Mise à jour et restauration

Sauvegarder les données et la clé avant de reconstruire avec une nouvelle version. Conserver les volumes de Compose. `docker compose down` arrête les services ; `docker compose down --volumes` retire leurs volumes et n’est pas une commande de mise à jour.

Le premier démarrage de cette version de développement migre SQLite vers le schéma 3. Pour revenir à une version du serveur qui utilise le schéma 1 ou 2, utiliser la sauvegarde prise avant la migration.

Vérifier `/api/v1/health/live` et `/api/v1/health/ready`, puis une connexion et un rapport. Pour un retour à une version antérieure, restaurer une sauvegarde compatible dans un dossier vide ; une base marquée comme plus récente est refusée au démarrage.

Les paquets ordinateur de cette première version sont des paquets de test. Leur signature, notarisation et mise à jour automatique font partie du [backlog](BACKLOG.md).
