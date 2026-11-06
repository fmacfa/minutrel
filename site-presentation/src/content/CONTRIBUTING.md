# Contribuer à Minutrel

Commencer par le [cahier des charges](docs/CAHIER_DES_CHARGES.md) et le [backlog](docs/BACKLOG.md). Le dépôt contient un socle compilable ; les fonctions de suivi du temps en équipe restent à développer.

## Proposer une modification

Créer un ticket pour un changement de périmètre ou une fonctionnalité. Indiquer le besoin, le rôle utilisateur, les plateformes concernées et les exigences F, R ou Q concernées. Une correction documentaire simple peut directement faire l’objet d’une pull request.

Travailler sur une branche courte, avec des commits lisibles. Une pull request décrit le comportement obtenu et les vérifications réellement effectuées. Toute modification de calcul doit préciser son effet sur les temps existants et les exports.

## Vérifications

Pour le dépôt documentaire :

```sh
python3 scripts/check_repository.py
```

`npm run check` exécute formatage, lint, types, tests avec couverture et construction du socle. `python3 scripts/check_brand.py` contrôle les ressources graphiques. Les [commandes natives et la CI](docs/CI.md) complètent ces contrôles. Les cas critiques du [plan de recette](docs/RECETTE.md) guident les prochains tests.

## Données et dépendances

Utiliser uniquement des données fictives dans les exemples. Ne jamais commiter de base réelle, jeton, certificat privé, export client ou mot de passe. Toute nouvelle dépendance doit avoir une licence compatible documentée et une version verrouillée.

Les contributions sont soumises à la licence AGPL-3.0-or-later du projet. Les ressources tierces conservent leurs notices et conditions propres.
