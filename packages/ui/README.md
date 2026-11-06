# Interface commune

Écrans React FR/EN/DE, composants accessibles et styles utilisant les tokens de marque. `transport.ts` utilise fetch et cookie sur le web, ou le pont Rust sous Tauri. Les sessions natives ne sont pas persistées dans JavaScript. `local.ts` charge le moteur personnel à la demande ; `local-engine.ts` gère le stockage natif, les propositions hors connexion et leurs accusés. `local-core.ts` contient le journal de chronomètre et les rapports personnels.

Les vues comprennent chronomètre, projets, temps, équipe, notes, rapports, intégrations et paramètres. Le compteur actif s’actualise localement. L’espace personnel ne nécessite aucun serveur ; les modifications d’équipe sont validées par le serveur commun. PDF et ZIP locaux sont chargés à la demande. Le catalogue `locales/messages.ts` et ses tests contrôlent traductions et paramètres.

[Guides illustrés](../../docs/guide/README.md) · [Synchronisation](../../docs/SYNCHRONISATION.md).
