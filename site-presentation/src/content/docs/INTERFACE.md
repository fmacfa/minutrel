# Interface de Minutrel V0.1

L’interface **française, anglaise et allemande** est commune au navigateur et au client ordinateur. Le sélecteur de langue recharge l’interface après sauvegarde des formulaires ; les données saisies ne sont pas traduites automatiquement. Elle utilise l’identité Manrope, vert profond et fond clair définie dans [la charte](IDENTITE_DE_MARQUE.md).

## Écrans

- **Vue d’ensemble** : projet, tâche facultative et description, compteur, commandes et temps récents ; indicateurs personnels du mois.
- **Les temps** : mois, membre autorisé, pagination, ajout manuel, correction et suppression motivée.
- **Les projets** : recherche, actifs/archivés, affectations, tâches, couleur et description.
- **Le fil du travail** : notes privées ou partagées, brouillons personnels, rédaction manuelle ou avec fournisseur IA et validation.
- **Les rapports** : période mensuelle, salariés pour les administrateurs, agrégats, détails et téléchargements.
- **L’équipe** : comptes, rôles, activation, réinitialisation des accès et résolution exceptionnelle d’un temps actif.
- **Les connexions** : jetons personnels Codex/Claude Code et configuration des moteurs par administrateur.
- **Paramètres** : compte, mot de passe, espace, serveur, export JSON et journal de gestion pour l’administrateur.

Le contributeur ne voit pas les fonctions de gestion des membres ; les contrôles serveur restent obligatoires même si une commande est masquée dans l’interface.

Le client ordinateur propose **Utiliser sur cet ordinateur** sans serveur, puis **Ouvrir un espace d’équipe** de façon facultative. Les paramètres affichent copie locale, transfert des temps, file d’envoi et conflits. Le mode personnel ne présente pas les écrans de gestion d’équipe et de fournisseurs.

Les [guides FR/EN/DE](guide/fr/README.md) présentent les gestes et leurs captures. Les états distinguent espace local, synchronisation terminée, attente d’envoi, coupure et conflit.

## Temps manuel

Le formulaire propose une durée sur une date ou un début/une fin avec décalage UTC explicite. Une correction peut ne changer que la description, sans remplacer les segments d’origine. Le passage à une correction de durée/intervalle annonce le remplacement de ces segments et demande un motif.

## Commande rapide

Le [widget ordinateur](COMMANDE_RAPIDE.md) et la barre web suivent le même chronomètre. Les commandes choisissent un projet Minutrel ; aucun sélecteur de dossier local ne figure dans ce parcours.

## Lecture et accessibilité

Libellés associés aux champs, boutons nommés, focus visible, dialogue natif avec Échap, indication textuelle des états, tableaux défilables sur petit écran et compteur sans annonce vocale chaque seconde. Les animations sont supprimées lorsque le système demande une réduction des mouvements.

Le mode compact du navigateur dépend de Document Picture-in-Picture. Les écrans et les gestes natifs doivent aussi être éprouvés avec les outils d’accessibilité des trois plateformes avant une diffusion large.
