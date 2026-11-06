# Utiliser le site de présentation en local

Cette procédure concerne le site que vous consultez. Pour installer le logiciel de suivi du temps, suivez le [guide d’autohébergement de Minutrel](../docs/AUTOHEBERGEMENT.md).

Ce site est disponible en **français et en anglais** : présentation, fonctionnalités, fonctionnement, guide et autohébergement. Fichiers, scripts, polices et index de recherche sont locaux. Aucun compte ni service en ligne n’est nécessaire. Le chronomètre de démonstration ne transmet aucune durée.

## Ouvrir directement les fichiers

Dans **Ressources → Les téléchargements**, récupérez **Site de présentation autonome**, puis décompressez le ZIP. Ouvrez `minutrel-site/index.html` pour le français ou `minutrel-site/en/index.html` pour l’anglais.

Le sélecteur **FR / EN** conserve la page correspondante. La recherche est embarquée dans un fichier JavaScript : elle fonctionne aussi en ouvrant le site en `file://`, ainsi que les filtres, le chrono et les captures agrandies.

La copie des commandes dépend des autorisations du navigateur. Si le presse-papiers n’est pas accessible, le texte est sélectionné pour une copie manuelle.

## Démarrer un serveur local

Dans le dossier de travail éditable `site-presentation/`, double-cliquez sur **Ouvrir Minutrel.command** sous macOS, ou lancez :

```sh
python3 serve.py
```

Le serveur écoute uniquement sur `127.0.0.1` et ouvre la page française. Pour ouvrir directement l’anglais :

```sh
python3 serve.py --language en
```

Arrêtez-le avec `Ctrl+C` dans son terminal. Aucun service système n’est créé. Si le port est occupé, ajoutez `--port 4176`.

Depuis un dossier de site déjà exporté, Python 3 peut aussi servir les fichiers avec :

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

## Héberger les fichiers statiques

Copiez le contenu complet du site en conservant `en/`, `assets/`, `downloads/` et les fichiers de recherche. Exemple Caddy, à adapter à votre domaine et au chemin réel :

```caddyfile
presentation.votre-equipe.fr {
    root * /srv/minutrel-site
    file_server
}
```

Apache, nginx ou un hébergement statique existant conviennent. Les liens comportent `.html` : aucune réécriture d’application n’est nécessaire. Les fichiers n’emportent pas de connexion ChatGPT ; les restrictions d’accès éventuelles se configurent sur votre hébergement.

## Vérifier le résultat

1. Ouvrez l’accueil puis les pages Fonctionnalités, Guide et Autohébergement.
2. Changez de langue avec FR / EN et vérifiez la page correspondante.
3. Recherchez « sauvegarde » ou « backup », puis ouvrez un résultat.
4. Testez une capture, un téléchargement et le menu sur petit écran.

Dans sa propre archive, le lien de téléchargement du site renvoie à cette procédure pour éviter la récursion. Vous pouvez déposer l’archive originale dans `downloads/` si vous souhaitez la proposer à nouveau depuis votre hébergement.

## Modifier et reconstruire

| Fichier | Usage |
| --- | --- |
| `src/pages.py` | Présentation et fonctionnalités en français |
| `src/en.json` | Textes anglais du site et des commandes |
| `src/content/en/` | Documentation essentielle en anglais |
| `src/bilingual.py` | Routes de langue et correspondance des chapitres |
| `src/styles.css`, `src/site.js` | Style et interactions |
| `build.py` | Construction des pages et archives |

Reconstruisez avec `python3 build.py`. Pour actualiser les guides d’origine, utilisez d’abord `python3 sync-content.py --project-root ..`. La construction reste locale et ne publie rien.

Conservez la licence Minutrel et la notice SIL OFL de Manrope. Les documents supplémentaires et PDF d’exemple conservent leur langue d’origine lorsqu’elle est précisée.
