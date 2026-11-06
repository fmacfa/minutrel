# Client ordinateur Minutrel

Tauri 2 et Rust, pour macOS, Windows et Linux. Le rendu est le même que sur le web ; les appels HTTP, la session du trousseau et la connexion SSE commune sont gérés dans Rust. Le widget ne propose que des projets Minutrel, sans lire les dossiers du disque.

**Utiliser sur cet ordinateur** ouvre un espace personnel sans serveur ni compte en ligne. Les données sont persistées par le pont Rust avec révision, verrou et copie précédente. **Ouvrir un espace d’équipe** est facultatif. Un compte relié peut enregistrer les commandes de chronomètre et nouvelles saisies hors connexion, puis envoyer la file avec contrôle des droits et des conflits. Les profils personnels et d’équipe restent distincts.

Installer les prérequis Tauri et Rust via rustup. Depuis la racine : `npm run build:desktop` produit les formats de la plateforme courante. Le raccourci proposé est Ctrl/Cmd + Alt + M. La fermeture de la fenêtre principale la masque ; Quitter ferme le client, sans terminer un temps local ou serveur.

En développement, démarrer `npm run dev:web` et l’API, puis `npm run dev:desktop`. Saisir l’adresse de l’API, par exemple `http://127.0.0.1:8081`, dans le client. Pour l’usage d’équipe, saisir l’origine HTTPS de l’instance.

[Commande rapide](../../docs/COMMANDE_RAPIDE.md) · [Limites de la V0.1](../../docs/ETAT_V0_1.md).

[Guides FR/EN/DE](../../docs/guide/README.md) · [Fonctionnement local et synchronisation](../../docs/SYNCHRONISATION.md).
