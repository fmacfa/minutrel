# Serveur Minutrel V0.1

Fastify et Node.js 24, avec SQLite central en WAL. `src/store.ts` initialise le schéma versionné ; `routes.ts` contrôle les accès ; `service.ts` porte les opérations de temps et les calculs de rapport. `reports.ts` produit CSV/PDF/ZIP. Les connecteurs MCP et IA sont dans `src/integrations/`.

Depuis la racine : `npm run dev:api`. Le dossier `data/` de la racine conserve la base et la clé. Après `npm run build`, `npm start` sert aussi l’interface sur le port 8081. Les tests utilisent des bases distinctes.

[API](../../docs/API.md) · [Autohébergement](../../docs/AUTOHEBERGEMENT.md) · [Sauvegardes](../../infra/backup/README.md).
