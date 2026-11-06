# Recette de la V0.1

Utiliser l’espace fictif de `npm run demo` pour la recette d’interface. Les tests automatisés utilisent des bases en mémoire ou des dossiers temporaires distincts.

## Parcours d’équipe

1. Initialiser une nouvelle instance avec le secret généré, puis créer un responsable et un contributeur.
2. Créer un projet, une tâche et affecter le contributeur. Vérifier qu’un autre contributeur non affecté ne le voit pas.
3. Se connecter au même compte dans le navigateur et le client ordinateur.
4. Démarrer dans le navigateur, mettre en pause depuis l’ordinateur, reprendre puis arrêter depuis le widget. Les trois surfaces doivent montrer le même état et les pauses ne doivent pas compter.
5. Ouvrir deux commandes de démarrage simultanées : une seule doit réussir. Rejouer la même requête avec la même clé : aucun doublon.
6. Ajouter une durée manuelle et un intervalle. Confirmer uniquement les chevauchements voulus.
7. Corriger une description en conservant les segments ; corriger une durée avec motif. Une version périmée doit être refusée.
8. Désactiver un membre après finalisation de son temps et retrouver son historique dans le rapport.

## Travail et rapports

1. Créer une note privée puis une note partagée. Seule la seconde apparaît dans le rapport administrateur.
2. Préparer un compte rendu manuel ou IA. Le brouillon ne doit pas être exporté avant validation.
3. Choisir un mois et plusieurs salariés ; contrôler CSV, PDF et ZIP. Comparer les secondes exactes et la présence des textes validés.
4. Créer un export, corriger ensuite un temps et télécharger l’export : il doit conserver son instantané.
5. Vérifier un intervalle à cheval sur deux mois locaux et sur un changement d’heure.
6. Retirer le droit administrateur avant téléchargement : l’export doit devenir inaccessible.

## Connexions et coupures

Un jeton MCP de lecture ne doit pas exposer de commande de temps. Un jeton avec le droit supplémentaire peut seulement commander le chronomètre de son propriétaire. Les notes créées par outil restent privées. La révocation prend effet à la requête suivante.

Arrêter le serveur puis ouvrir l’espace personnel : créer un projet, démarrer/pause, quitter/réouvrir, reprendre/terminer et exporter CSV/PDF/ZIP. Aucune connexion ne doit être nécessaire et les pauses ne doivent pas compter.

Pour un compte relié, couper le réseau après première connexion : commander le chronomètre et ajouter une saisie, vérifier la file durable, puis rétablir le serveur. Rejouer une réponse perdue et modifier un temps pendant un envoi ; aucun doublon ou retour à un état ancien ne doit apparaître. Produire un conflit de version/chevauchement, conserver la copie et archiver la file après comparaison. Changer d’espace pendant une réponse ne doit pas appliquer les données au nouvel espace. Le client ne doit pas demander de dossier du disque pour chronométrer.

Transférer des temps personnels avec des correspondances de projets, répéter le transfert, vérifier l’absence de doublon et l’exclusion des notes privées. Tester un webhook sans droit, avec droit de brouillon, rejoué puis révoqué. Changer de langue FR/EN/DE et vérifier les vues à 320, 390, 768 et 1280 pixels, y compris les tableaux défilables et boutons d’icône nommés.

Le moteur IA doit recevoir uniquement les données consenties du membre. Un délai dépassé, une réponse erronée ou une file pleine ne doit pas empêcher le suivi du temps.

## Restauration et exploitation

Démarrer un temps, redémarrer le serveur et retrouver ses segments. Produire une sauvegarde, la restaurer dans un dossier vide et retrouver le temps ainsi qu’un secret de fournisseur fictif. Vérifier qu’une restauration refuse un dossier non vide et qu’une base de version ultérieure n’est pas rétrogradée.

Les tests exécutables se trouvent dans `apps/api/src/*.test.ts`, `apps/api/src/integrations/`, `packages/domain/` et `packages/ui/src/*.test.ts`. La [validation consignée](VALIDATION_CI.md) distingue automatisation locale, contrôle visuel, construction native et tâches GitHub encore à exécuter.
