# Intégration continue de Minutrel V0.1

Le workflow [repository-check.yml](../.github/workflows/repository-check.yml) s’exécute sur pull request, push `main`, tag `v*` et déclenchement manuel. Le contrôle final à rendre obligatoire dans GitHub est **CI**.

| Travail | Contrôle |
| --- | --- |
| Documents | Liens locaux, fichiers requis, exemples de calcul et configuration des assistants ; Linux, macOS et Windows |
| Identité | Intégrité des logos, icônes, polices, couleurs et charte |
| Qualité | Format, ESLint, TypeScript strict, tests Vitest et seuils de couverture |
| Constructions | Interface web et serveur API avec Node 24 |
| Dépendances | Lockfiles npm/Cargo, audit npm et mises à jour Dependabot |
| Native | Rust fmt, tests et clippy ; Tauri `.dmg`, NSIS et `.deb` sur les runners correspondants |
| Conteneurs | Images API/web, recette HTTP à travers nginx, SSE, MCP, exports et redémarrage avec volume conservé |
| Production | Image unique sans privilèges, racine en lecture seule, recette et sauvegarde/restauration dans le conteneur |
| Archive | Sources nettoyées et empreinte SHA-256 |
| Workflows | Validation actionlint du YAML GitHub Actions |

Les actions tierces sont épinglées à un SHA et le jeton du workflow reste en lecture seule. Les constructions de paquets sont non signées ; le workflow ne publie pas de release ni d’image sur un registre.

Le job natif Linux sélectionne un miroir HTTPS de l’archive Ubuntu 24.04 accessible depuis le runner. APT vérifie les paquets avec le trousseau Ubuntu du runner. [Vérification de l’archive Ubuntu](https://documentation.ubuntu.com/security/software-integrity/archive-verification/)

## Tests métier

Les tests vérifient les rôles, les sessions, CSRF/origine, la limitation des tentatives, les affectations, les chronomètres concurrents, les répétitions, les pauses, les versions, les corrections motivées, les bornes mensuelles et changements d’heure, les brouillons privés, les instantanés d’export et le protocole MCP avec son client officiel.

La sauvegarde est restaurée dans un dossier vide ; le temps et un secret chiffré fictif doivent être retrouvés. Les adaptateurs IA sont testés sans appel à un fournisseur réel. Les commandes du widget sont soumises aux mêmes routes que les autres clients.

Les tests d’interface couvrent aussi le stockage autonome, la file hors connexion, les conflits, l’isolation des espaces, les catalogues de langues et les exports locaux. Les gestes et présentations natifs sont vérifiés par recette visuelle. Les seuils de couverture portent sur le domaine et les modules métier du serveur : 90 % pour lignes/fonctions/instructions et 85 % pour branches.

## Artefacts et validation locale

GitHub conserve couverture, builds, installateurs et archive pendant 14 jours. Les clés, bases, sauvegardes, caches et dépendances locales ne font pas partie des sources publiables.

```sh
npm ci --ignore-scripts
npm run check
python3 scripts/check_repository.py
python3 scripts/check_brand.py
python3 scripts/install_actionlint.py
.cache/tools/actionlint -shellcheck=
```

Rust et les conteneurs nécessitent leurs prérequis respectifs. [VALIDATION_CI.md](VALIDATION_CI.md) décrit ce qui a été exécuté localement. Une matrice préparée n’est pas une exécution GitHub : celle-ci débutera après création et envoi du dépôt distant.
