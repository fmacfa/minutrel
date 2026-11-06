# Avant la publication de Minutrel V0.1

La V0.1 peut être présentée comme une **préversion de test libre et autohébergée**, avec un client autonome. La présence des sources et de la CI ne suffit pas à qualifier une version de stable pour toute équipe, tout système et tout volume.

## Fonctions proposées

- Ordinateur autonome sans serveur ni compte en ligne ; données personnelles locales.
- Espace d’équipe avec plusieurs membres, trois rôles, projets et chronomètre commun au web et au client ordinateur.
- File hors connexion des temps, contrôle des versions et conflits conservés.
- Rapports CSV/PDF/ZIP, copie JSON et sauvegarde/restauration du serveur.
- MCP pour les assistants, fournisseurs de rédaction facultatifs, REST et webhook entrant de notes privées.
- Interface et guides utilisateur illustrés en français, anglais et allemand.

Les [guides](guide/fr/README.md), l’[état livré](ETAT_V0_1.md), le [contrat API/webhook](API_WEBHOOKS.md) et la [synchronisation](SYNCHRONISATION.md) fixent la portée exacte. Les webhooks sortants, la fusion automatique des conflits, les invitations et l’import général d’un espace JSON ne sont pas présentés comme livrés.

## Contrôles techniques

Les résultats datés figurent dans [VALIDATION_CI.md](VALIDATION_CI.md). Les tests vérifient notamment sessions, CSRF, rôles, temps d’autrui, révocations, idempotence, conflits, export privé et restauration serveur. Les tests du client couvrent le journal de temps, la file et les changements d’espace pendant un envoi. Un audit de dépendances rapporte les vulnérabilités connues au moment de son exécution ; il ne constitue pas un audit exhaustif du produit.

Les protections locales reposent sur le compte du système. Les jetons d’équipe sont dans le trousseau, mais les fichiers de travail et les copies JSON ne possèdent pas de chiffrement indépendant. La sécurité d’un déploiement dépend aussi de son serveur HTTPS, des comptes administrateurs, des sauvegardes et des mises à jour. Aucun audit de sécurité indépendant ou test d’intrusion complet n’est annoncé comme exécuté.

## Première publication du code

- Choisir le compte ou l’organisation propriétaire et créer un dépôt vide `minutrel` avec la visibilité souhaitée.
- Examiner les fichiers du premier commit ; exclure configuration réelle, bases, clés, sauvegardes, caches et identifiants. Les captures du dépôt ne contiennent que la démonstration fictive.
- Envoyer le code et attendre le contrôle final **CI** sur le commit exact de la publication.
- Valider les constructions natives Windows/Linux de la matrice, puis compléter par une recette sur les appareils réels. La construction locale macOS ne remplace pas ces contrôles.
- Activer les signalements privés de vulnérabilités, choisir les mainteneurs réels et mettre à jour `SECURITY.md`.
- Publier des notes de préversion reprenant les limites réelles et joindre des artefacts du même commit, avec empreintes.

Le [guide GitHub](GITHUB.md) fournit les commandes. Cette préparation locale ne crée aucun dépôt distant, ne choisit pas sa visibilité et n’envoie aucun code à un tiers.

## Avant une diffusion stable plus large

Signature/notarisation et mise à jour vérifiée des installateurs ; recette des trousseaux, raccourcis, widgets et WebViews des trois systèmes ; restauration des données locales sur une autre machine ; charge et mémoire sur les volumes visés ; accessibilité approfondie ; audit de sécurité indépendant ; recette des modèles IA réellement choisis. Les moteurs IA restent facultatifs pour utiliser le produit.

L’[identité du nom](DISPONIBILITE_NOM.md) est une vérification préliminaire, sans réservation de domaine ni garantie de marque. La disponibilité du dépôt doit être vérifiée dans le compte propriétaire au moment de sa création.
