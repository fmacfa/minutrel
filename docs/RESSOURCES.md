# Sobriété des ressources

Minutrel V0.1 utilise un serveur commun et des clients légers. Les valeurs ci-dessous sont des objectifs de réception ; elles doivent être mesurées sur des postes et jeux de données de référence avant toute garantie de capacité.

| Élément | Objectif |
| --- | --- |
| Widget ordinateur, groupe de processus | 150 Mio de mémoire au repos |
| Client principal ordinateur, groupe de processus | 250 Mio de mémoire au repos |
| Interface web | 40 Mio de tas JavaScript après chargement, hors navigateur lui-même |
| API sans moteur IA | 180 Mio de mémoire au repos |
| Pile de temps | 512 Mio au repos, 1 Gio pour les traitements lourds bornés |
| Client au repos | Moins de 0,5 % d’un cœur sur une mesure stabilisée |
| JavaScript web initial | Moins de 120 Ko compressés gzip |
| Installateur ordinateur | Moins de 30 Mio, hors WebView fournie ou installée par le système |

## Choix présents dans la V0.1

- Tauri et WebView système ; aucun moteur Chromium embarqué dans chaque installation.
- SQLite sur le serveur commun ; aucun service de base à installer sur les postes.
- Un instant par segment de temps, sans réécriture en base chaque seconde.
- Compteur actif mis à jour localement ; pas de requête réseau par seconde ni de recalcul complet des pages pour ce compteur.
- SSE avec heartbeat espacé, connexion partagée entre fenêtres natives et relecture après invalidation.
- Le widget charge les projets et le temps actif, sans charger rapports, notes et historique.
- Listes de temps paginées, agrégats SQL et aperçu mensuel de 100 lignes ; les totaux portent sur toute la période.
- Une génération PDF à la fois, une génération IA à la fois, files bornées et limites explicites de sélection.
- Aucun modèle IA embarqué, téléchargement automatique de modèle, indexation de fichiers locaux ou lecture de conversations externes.
- Espace personnel sans serveur embarqué ; écritures locales lors des changements, pas à chaque seconde du compteur. La vérification de session inchangée ne renouvelle pas le fichier complet à chaque invalidation d’équipe.
- Moteur de stockage local chargé seulement par le client qui l’utilise ; bibliothèques PDF chargées à l’export.

## Mesures

La construction du 6 novembre produit environ **112 Ko de JavaScript gzip initial**, sous l’objectif de 120 Ko, puis environ 51,6 Ko pour le moteur personnel lorsqu’il est utilisé. Les bibliothèques PDF/fontkit représentent environ 550 Ko gzip supplémentaires à la demande. Le paquet macOS ARM64 de test représente environ 5,7 Mio, l’application décompressée environ 16 Mio. Ces tailles ne comprennent pas la mémoire d’exécution et ne préjugent pas des autres systèmes.

Les mesures de conteneur et les conditions de recette sont consignées dans [VALIDATION_CI.md](VALIDATION_CI.md). Le moteur IA, s’il est déployé, doit être mesuré séparément : son coût mémoire et matériel dépend du modèle choisi.

La charge cible à éprouver est 50 comptes, 20 utilisateurs simultanés, 500 projets et 100 000 entrées. Les tests fonctionnels de la V0.1 ne remplacent pas cette campagne. Les mesures natives doivent inclure les processus WebView et être répétées sur macOS, Windows et Linux.
