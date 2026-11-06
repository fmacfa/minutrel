# Images Minutrel V0.1

Le Dockerfile comporte une cible `api` (serveur et interface intégrée) et une cible `web` (nginx). Les images de base sont épinglées par digest. Les dépendances et builds sont préparés dans une étape distincte ; le processus API tourne sous l’utilisateur node.

Le Compose de production est à la racine et utilise une seule image. `compose.ci.yml` valide la variante API + nginx, avec un volume jetable et un secret de test. Son port peut être déplacé avec `CI_PORT`.

Le proxy conserve Host, transmet `/api/` et `/mcp`, désactive le buffering des événements SSE et expose uniquement les fichiers statiques attendus. Les contenus partagés et les rapports ne sont pas des fichiers publics du proxy.

[Autohébergement](../../docs/AUTOHEBERGEMENT.md) · [CI](../../docs/CI.md).
