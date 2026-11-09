# Dépôt GitHub de Minutrel

La langue principale de GitHub est **l’anglais** : README racine, consignes de contribution, sécurité, historique, modèles de tickets/PR et intitulés de CI. Le français reste disponible dans [README.fr.md](../README.fr.md) et les guides utilisateur existent en EN/FR/DE. Les documents techniques français restent accessibles et signalés comme tels.

Le dépôt public unique est [fmacfa/minutrel](https://github.com/fmacfa/minutrel), sur la branche principale `main`. Il réunit le serveur, le client web, le client ordinateur macOS/Windows/Linux, les bibliothèques partagées, le site vitrine et les sources de sa vidéo de présentation.

La [vidéothèque](VIDEOS.md) et son [catalogue anglais](VIDEOS.en.md) regroupent les 12 vidéos, leurs sous-titres et les MP4 disponibles. La [playlist publique](https://www.youtube.com/playlist?list=PLR7Pc9PfnKIk) suit l’ordre de découverte du produit. Le catalogue de publication de `video/publication/youtube.json` conserve les liens réellement publiés.

Le dossier courant est la racine du projet. Les commandes de vérification et de commit ci-dessous restent locales ; `git push` envoie les modifications vers GitHub.

## Contenu prêt à publier

- Cahier des charges, architecture, modèle de données, contrat API et plan de recette.
- Dossiers des clients web et ordinateur, du serveur et des composants partagés.
- Licence AGPL-3.0-or-later complète, règles de contribution et historique.
- Modèles GitHub de bug, de fonctionnalité et de pull request.
- Identité de marque, charte PDF, logos, icônes et polices libres.
- Application React, Fastify et Tauri avec dépendances verrouillées.
- CI des documents, de l’identité, des tests, des builds natifs et des conteneurs.
- Backlog des itérations suivant la V0.1.
- Guides utilisateur illustrés FR/EN/DE, autonomie, synchronisation et webhook entrant.

La V0.1 contient les fonctions décrites dans [ETAT_V0_1.md](ETAT_V0_1.md). Les installateurs de test ne sont pas signés. Les exécutions distantes sont consultables dans [GitHub Actions](https://github.com/fmacfa/minutrel/actions).

La première diffusion est à présenter comme une préversion d’essai. La [liste avant publication](PRE_PUBLICATION.md) distingue publication des sources, validation du commit par GitHub et conditions d’une diffusion stable.

## Vérifier avant le premier commit

Depuis la racine du projet :

```sh
python3 scripts/check_repository.py
python3 scripts/check_brand.py
npm ci --ignore-scripts
npm run check
git status --short
```

Vérifier la licence choisie et les fichiers à publier. Le nom public proposé est `minutrel` ; le texte de description peut être : “Open-source, self-hosted project time tracking for teams. Web and desktop apps with offline support.”

Le fichier `.env.example` ne contient que des valeurs documentaires. Les fichiers `.env`, bases et certificats privés, ainsi que les emplacements prévus pour les sauvegardes et exports de production, sont exclus par `.gitignore`. Cette exclusion ne remplace pas l’examen du contenu du premier commit.

## Créer le premier commit

La préparation initialise un dépôt Git local sur la branche `main`. Vérifier que `git rev-parse --show-toplevel` désigne bien le dossier de ce projet avant de poursuivre. Le dossier conserve son emplacement initial « COMPTE TEMPS ». S’il a été copié sans ses métadonnées Git, exécuter d’abord `git init -b main`.

```sh
git add .
git commit -m "feat: livrer Minutrel V0.1 avec sa marque et sa CI"
```

Git peut demander de configurer le nom et l’adresse de l’auteur. Utiliser l’identité de contribution souhaitée ; aucune identité n’est créée par la préparation du projet.

## Relier le dépôt distant

Le dépôt `fmacfa/minutrel` existe déjà. Pour une copie locale qui n’a pas encore de distant `origin`, utiliser les commandes suivantes. Une copie obtenue avec `git clone` possède déjà ce distant.

```sh
git remote add origin git@github.com:fmacfa/minutrel.git
git push -u origin main
```

L’authentification s’effectue avec le mécanisme GitHub habituel de l’utilisateur. Aucun jeton ne doit être écrit dans l’URL du dépôt ou dans un fichier du projet.

## Configurer la collaboration

Activer Issues, conserver les modèles présents et créer les jalons « V0.1 », « Recette multiplateforme » et « V0.2 ». Reprendre les tickets du [backlog](BACKLOG.md) avec leurs exigences et critères de validation. Un ticket de fonctionnalité précise le rôle utilisateur et les clients concernés.

Configurer les protections de `main` avec une pull request et le contrôle final « CI » après sa première exécution réussie, quand les capacités du dépôt le permettent. Ajouter les responsables réels au fichier CODEOWNERS seulement après avoir choisi leurs comptes ; aucun compte fictif n’est livré.

Les modèles de tickets sont reconnus par GitHub et peuvent être utilisés depuis le [parcours de création d’issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue).

## Versions futures

Le [workflow fourni](CI.md) construit le socle, les images de test et les installateurs non signés à chaque envoi sur `main`, pull request ou tag `v*`. Il ne déploie ni ne publie de logiciel.

Pour les versions applicatives, utiliser des tags sémantiques, des notes de version et des artefacts correspondant au même commit. Les secrets de signature seront configurés dans l’environnement de publication, hors Git. Prévoir un responsable de maintenance et un canal privé de signalement avant la première version publique.
