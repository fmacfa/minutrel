# Client web Minutrel

React et Vite, interface FR/EN/DE partagée dans `packages/ui`. Depuis la racine : `npm run dev:web`, avec l’API démarrée par `npm run dev:api`. Le proxy de développement route `/api`, `/mcp` et `/hooks` vers le serveur local 8081. Le navigateur utilise l’espace d’équipe connecté ; le mode autonome est fourni par le client ordinateur.

`npm run build:web` construit les fichiers statiques et leurs notices de licence. En production, ils sont servis par le serveur Minutrel ou l’image nginx.

[Parcours](../../docs/INTERFACE.md) · [Commande rapide](../../docs/COMMANDE_RAPIDE.md).
