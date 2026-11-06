# Identité de marque de Minutrel

Proposition du 5 novembre 2026. Le périmètre couvre le nom, la signature, le logo, les couleurs, les typographies, les icônes, la voix de marque et les ressources destinées aux développeurs.

## Nom et positionnement

**Minutrel** associe l’idée de minute au travail relié entre plusieurs membres. Prononciation proposée : « mi-nu-trel ». L’orthographe reste identique en français et dans les identifiants techniques : `minutrel`, sans accent ni tiret.

La signature est **« Le temps de vos projets, ensemble. »** Le descriptif court est : « Suivi du temps par projet en équipe, libre et autohébergé. » La marque s’adresse aux équipes qui souhaitent des temps fiables et une maîtrise de leurs données.

Le nom de travail « Compte Temps » est écarté pour la diffusion : une application proche utilise déjà CompteTemps. Les recherches sur Minutrel et leurs limites sont dans le [rapport de disponibilité](DISPONIBILITE_NOM.md). Ce dossier reste dans son emplacement actuel sur l’ordinateur ; seul le nom du produit est harmonisé.

## Logo

Le symbole forme un M ouvert : deux appuis sont reliés par un mouvement central. Un point citron sert de repère. Le mot est dessiné à partir de Manrope ExtraBold et livré sous forme de tracés vectoriels.

| Variante | Usage |
| --- | --- |
| [Principale](../brand/assets/logos/minutrel-primary.svg) | Fond blanc ou papier : symbole vert, point citron, mot encre. |
| [Inversée](../brand/assets/logos/minutrel-reverse.svg) | Fond encre : symbole et mot blancs, point citron. |
| [Monochrome sombre](../brand/assets/logos/minutrel-mono-dark.svg) | Impression une couleur ou marquage technique. |
| [Monochrome blanche](../brand/assets/logos/minutrel-mono-white.svg) | Fond sombre lorsque seule une couleur est possible. |
| [Symbole seul](../brand/assets/logos/minutrel-symbol.svg) | Emplacements compacts, après identification de la marque. |

Conserver au moins 12 unités libres autour du symbole, sur une grille de 96. Taille minimale recommandée : 24 px pour le symbole et 140 px pour le logo complet. Pour 16 px, utiliser le favicon dédié. Ne pas déformer, incliner, appliquer une ombre ou recomposer les couleurs.

## Couleurs

| Couleur | Valeur | Usage |
| --- | --- | --- |
| Encre | `#142C38` | Texte principal, navigation sombre et fond de marque. |
| Vert | `#087F75` | Actions principales, liens et repères fonctionnels. |
| Vert foncé | `#05665E` | Survol d’une action principale. |
| Citron | `#D3EF70` | Accent, état actif et surfaces courtes avec texte encre. |
| Papier | `#F8F7F3` | Fond général clair. |
| Blanc | `#FFFFFF` | Cartes et texte sur les surfaces sombres autorisées. |
| Ardoise | `#536570` | Texte secondaire sur fond clair. |
| Bordure | `#D7DEDA` | Séparation décorative ; ne suffit pas seule à identifier un champ. |
| Erreur | `#B93838` | Erreurs, accompagnées d’un libellé et d’une icône adaptée. |

Les combinaisons de texte de référence sont encre sur papier, blanc sur vert, encre sur citron et ardoise sur blanc. Les ratios calculés sont publiés dans la charte PDF. Le citron ne sert pas à un texte courant sur fond blanc. Les bordures des contrôles doivent avoir un contraste suffisant avec leur fond ; utiliser un contour plus sombre que la bordure décorative si nécessaire.

Les variables sont disponibles dans [tokens.css](../brand/tokens.css) et les valeurs structurées dans [tokens.json](../brand/tokens.json). Les couleurs ne remplacent pas un texte, un symbole ou un état accessible.

## Typographie et mise en page

Manrope est livrée localement, avec sa licence SIL Open Font License. Les fichiers de référence proviennent du [répertoire Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope). Les instances statiques sont générées depuis la police variable, sans changement des dessins de lettres.

Utiliser 400 pour le texte, 600 pour les commandes et 800 pour les titres. Taille courante : 16 px ; aide : 14 px ; titre de page : 24 à 36 px ; titre de communication : jusqu’à 72 px. Prévoir un interligne de 1,5 pour le texte et de 1,1 à 1,2 pour les grands titres.

Les espacements suivent une grille de 4 px : 4, 8, 12, 16, 24, 32, 48 et 64. Les rayons de référence sont 8 px pour les contrôles, 16 px pour les cartes et 999 px pour les pastilles. Un écran métier privilégie la lisibilité des durées et des projets.

Afficher les unités et préserver les secondes quand elles sont utiles. Utiliser `font-variant-numeric: tabular-nums` si la police et le moteur le prennent en charge. La mise en forme ne doit pas changer les calculs de temps.

## Icônes et illustrations

Le pack contient un favicon SVG, des icônes PNG et les formats ICO et ICNS. Le symbole applicatif est blanc sur un carré encre arrondi avec son point citron. Les icônes de commandes futures doivent conserver une épaisseur et une géométrie cohérentes et être accompagnées d’un libellé accessible.

Éviter les photographies décoratives dans les écrans de saisie. Les exemples de temps et d’équipe sont fictifs. La [maquette HTML](../brand/preview/index.html) illustre le style ; elle ne remplace pas les fonctionnalités à développer.

## Voix et messages

Le ton est direct, calme et précis. L’interface vouvoie l’utilisateur et nomme l’action : « Ajouter un temps », « Mettre en pause », « Inviter un membre » ou « Voir les temps du projet ».

Une erreur précise ce qui peut être corrigé : « Indiquez une durée comme 1h30 ou 45 min. » Une coupure doit expliquer l’état réel : « L’arrêt n’a pas été confirmé. Reconnectez-vous pour retrouver le chronomètre. » Ne jamais afficher un succès tant que l’écriture n’est pas confirmée.

## Distribution des ressources

Le [dossier brand](../brand/README.md) est le point d’entrée des ressources, avec leurs sources et leur manifeste. La charte PDF sert au partage, les SVG servent à l’intégration et les tokens servent aux composants. Les fichiers sont versionnés avec le code pour garder la même identité entre web et ordinateur.
