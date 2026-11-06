# Modules partagés

- `contracts` : objets échangés entre serveur et clients.
- `domain` : durées entières et calculs calendaires des rapports.
- `ui` : écrans React communs au navigateur et au client Tauri.

Les contrôles d’accès et la base restent dans le serveur. Le sous-module `domain/reports` utilise Temporal côté serveur et n’alourdit pas le client web.
