# Minutrel — site local français / English local website

Site de présentation complet en **français et en anglais**, avec sélecteur FR / EN : présentation, 20 fonctionnalités, fonctionnement, guide illustré, autohébergement du logiciel, sauvegardes, rapports, API et intégrations. Les références techniques supplémentaires conservent leur langue d’origine ; les pages essentielles existent dans les deux langues. Les captures utilisent des données fictives ; certaines montrent l’interface française de l’application.

## Ouvrir directement / Open directly

- Français : ouvrir `dist/index.html` dans un navigateur.
- English: open `dist/en/index.html` in a browser.

La recherche, les filtres, le chronomètre et les captures agrandies fonctionnent aussi en `file://`. Tous les scripts, index et polices sont locaux. Aucun compte ni connexion à ChatGPT n’est nécessaire. La copie dépend des autorisations du navigateur ; si le presse-papiers n’est pas disponible, le texte est sélectionné pour une copie manuelle.

The French and English websites work directly from local files, including search, filters, the demo timer and enlarged screenshots. All assets are bundled. No account, translation service or ChatGPT connection is required.

La vidéothèque (`dist/videos.html` et `dist/en/videos.html`) regroupe les 12 vidéos en anglais, avec voix, musique originale et fichiers SRT. Les douze lecteurs YouTube se chargent uniquement au clic et demandent une connexion Internet ; en `file://`, ils ouvrent la vidéo sur YouTube. Les guides assistants et autohébergement proposent aussi un téléchargement MP4, lisible hors connexion. Le site fournit des liens vers le [dépôt public](https://github.com/fmacfa/minutrel) et la [playlist](https://www.youtube.com/playlist?list=PLR7Pc9PfnKIk).

The video library includes twelve English guides. YouTube playback needs an Internet connection and starts only after a play action; local files open the video on YouTube. The assistant and self-hosting MP4 guides and all English SRT subtitles are bundled for offline use.

## Serveur local facultatif / Optional local server

Sur macOS, double-cliquer sur **Ouvrir Minutrel.command**, ou lancer la commande ci-dessous. Python 3 est le seul prérequis. Le lanceur ouvre le navigateur ; le serveur écoute uniquement sur `127.0.0.1` et s’arrête avec `Ctrl+C` dans son terminal.

```sh
python3 serve.py
```

Open English directly:

```sh
python3 serve.py --language en
```

French: `http://127.0.0.1:4175/`. English: `http://127.0.0.1:4175/en/`. Use `--port 4176` if the port is busy. The launcher creates no background system service.

## Reconstruire / Rebuild

```sh
python3 build.py
```

La construction utilise uniquement la bibliothèque standard de Python. Elle ne publie rien et ne synchronise aucune source distante. Le site local fonctionne indépendamment de l’accès privé Sites.

Pour actualiser les documents d’origine depuis le projet Minutrel :

```sh
python3 sync-videos.py --project-root ..
python3 sync-content.py --project-root ..
python3 build.py
```

Les traductions de `src/content/en/` sont éditoriales et doivent être relues après une modification des originaux. Le guide anglais illustré suit celui du projet.

| Fichier / File | Contenu / Contents |
| --- | --- |
| `src/pages.py` | Présentation française / French editorial content |
| `src/en.json` | Textes anglais du site et des commandes / English site and UI translations |
| `src/content/en/` | Documentation essentielle en anglais / English core documentation |
| `src/bilingual.py` | Routes et chapitres FR/EN / Locale and chapter links |
| `sync-videos.py`, `src/videos.json`, `src/video_library.py` | Catalogue vérifié et vidéothèque bilingue / Verified catalog and bilingual video library |
| `src/styles.css`, `src/site.js` | Style et interactions locales / Styles and local interactions |
| `build.py` | Construction des pages et archives / Static build and archives |
| `serve.py` | Serveur local facultatif / Optional local server |

## Exporter / Export

`dist/downloads/minutrel-site-autonome.zip` contient le site bilingue prêt à ouvrir ou héberger, sans identité Sites ni clé d’accès. Décompresser puis ouvrir `minutrel-site/index.html` ou `minutrel-site/en/index.html`. Le lien vers l’archive du site dans sa propre copie renvoie au guide local, pour éviter une archive récursive ou un téléchargement absent.

L’archive autonome inclut les deux guides MP4. Ses liens vers le code source téléchargent le dépôt public sur GitHub ; l’archive de sources du site complet reste aussi dans `dist/downloads/`. This keeps the portable website download small enough for static hosting; its app source links use the public GitHub archive.

Pour un hébergement statique, copier le contenu de `dist/` en conservant `en/`, `assets/`, `downloads/` et les fichiers de recherche. Les liens `.html` ne demandent aucune réécriture. Les restrictions d’accès se configurent sur votre hébergement.

`autohebergement.html` concerne le **logiciel Minutrel** ; `heberger-le-site.html` concerne le **site de présentation**.

## Données et licence / Data and licence

Le chronomètre reste en mémoire dans la page et ne transmet rien. Le site ne contient ni suivi d’audience, ni formulaire de compte, ni connexion à une instance de travail réelle. Les archives du logiciel excluent données, bases, clés et caches. Le paquet macOS disponible reste un paquet de test non signé.

Original Minutrel content: AGPL-3.0-or-later, full text in `src/downloads/LICENSE.txt`. Manrope: SIL OFL, notice in `src/assets/fonts/OFL.txt`.
