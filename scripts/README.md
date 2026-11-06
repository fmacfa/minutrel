# Outils du dépôt

- `build-api.mjs` : bundle serveur et polices/notices nécessaires aux rapports.
- `build-desktop.mjs` : installateur Tauri adapté au système courant.
- `backup.mjs` : copie SQLite cohérente et restauration dans un dossier vide.
- `demo.mjs` : espace fictif isolé et accès aléatoire local.
- `check_repository.py` : fichiers, liens, fixtures de calcul et configurations d’assistants.
- `check_brand.py` : intégrité des ressources de marque.
- `check_running_instance.py` : recette avec écritures, réservée aux instances CI jetables.
- `install_actionlint.py`, `check_ci_results.py` : contrôles GitHub Actions.
- `package_source.py` : archive source et SHA-256, hors données et caches ignorés par Git.
- `build_brand.py` : génération reproductible de la charte et des ressources.

Les outils Python documentaires utilisent la bibliothèque standard. La génération de marque emploie les dépendances de `requirements-brand.txt`.
