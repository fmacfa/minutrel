# État de Minutrel V0.1

Version du produit : **0.1.0**. Ce fichier distingue les fonctions livrées des objectifs des versions suivantes.

## Fonctions présentes

| Domaine | V0.1 |
| --- | --- |
| Installation | Premier administrateur protégé par un secret généré localement ; pas d’inscription publique |
| Équipe | Création des comptes, rôles contributeur/responsable/administrateur, désactivation et réinitialisation par l’administrateur |
| Projets | Création, modification, couleur, description, affectations, sous-catégories personnalisées et archivage |
| Planification | Budget horaire, échéance, actions rattachables aux saisies, Gantt, plan de charge et taux horaires facultatifs |
| Chronomètre | Démarrer, pause, reprise, arrêt ; segments persistés ; un temps actif par membre ; contrôle des versions et des répétitions |
| Saisies | Durées explicites, intervalles avec décalage UTC, détection des chevauchements et correction motivée |
| Partage | Serveur commun aux clients web et ordinateur, notifications SSE et relecture des droits côté serveur |
| Travail effectué | Notes privées/partagées, brouillons proposés par assistant, comptes rendus relus et validés |
| Rapports | Mois dans le fuseau de l’équipe, secondes exactes, salariés désactivés inclus, CSV/PDF/ZIP pour l’administrateur |
| Feuilles de temps | Soumission et validation hebdomadaires en équipe, renvoi motivé et exports mensuels des temps approuvés |
| Instantanés | Un export conserve les données de sa création ; téléchargement privé limité à 24 h et contrôlé de nouveau après génération |
| Bureau | Tauri, connexion HTTP native, session dans le trousseau, widget au-dessus des fenêtres, icône de barre de menus et raccourci |
| Web | Barre de chronomètre persistante ; fenêtre compacte si Document Picture-in-Picture est disponible |
| Codex / Claude Code | Serveur MCP HTTP réel, jetons personnels limités, expiration, révocation et outils privés par défaut |
| Ollama / vLLM / Claude | Adaptateurs de rédaction facultatifs, hôtes autorisés, secrets chiffrés côté serveur, validation humaine |
| Données | SQLite WAL, journal des corrections, sauvegarde/restauration CLI et export JSON v2 du travail partagé |
| GitHub | Dépôt local préparé, dépendances verrouillées, CI et modèles de contributions |
| Autonomie ordinateur | Espace personnel sans serveur ni compte en ligne, projets, temps, notes, comptes rendus manuels et exports locaux |
| Hors connexion | File durable pour chronomètre et nouvelles saisies d’un compte d’équipe, reçus d’envoi, conflits conservés et archivables |
| Rattachement à une équipe | Transfert explicite des temps personnels finalisés, correspondances de projets et répétitions sans doublon |
| Webhook entrant | Notes privées via `/hooks/work-notes`, jeton personnel à droit limité, idempotence et révocation |
| Langues et guides | Interface FR/EN/DE, libellés de rapports serveur localisés et guides utilisateur illustrés dans les trois langues |

## Portée de cette première version

Une instance héberge un espace d’équipe. Les responsables gèrent l’ensemble des projets et peuvent consulter/corriger les temps de l’équipe avec motif. Les contributeurs ne lisent que leurs temps et les projets affectés. Les exports mensuels collectifs sont réservés aux administrateurs.

Le navigateur utilise le serveur commun. Le client ordinateur possède aussi un espace autonome sans serveur et une file personnelle pour le chronomètre et les nouvelles saisies hors connexion d’un compte d’équipe. Les espaces restent distincts. Les écrans indiquent stockage local, attente d’envoi et conflits ; les corrections des temps serveur et la gestion d’équipe nécessitent une connexion. Voir [SYNCHRONISATION.md](SYNCHRONISATION.md).

Les moteurs IA restent facultatifs et ne suivent ni les dossiers locaux ni les conversations des autres logiciels. Le mode autonome propose une rédaction manuelle ; les intégrations IA et le webhook utilisent le serveur d’équipe.

L’API affiche un aperçu de 100 entrées par rapport, avec des totaux portant sur toute la période. Un export accepte jusqu’à 100 membres et 20 000 entrées. Une génération IA accepte au maximum 500 temps et 80 000 caractères de données. Les générations sont sérialisées, avec une file bornée.

## Versions suivantes

- Fusion assistée des conflits et extension du hors connexion aux notes et aux entités de gestion d’équipe.
- Invitations à usage unique et SSO/OIDC.
- Import JSON avec association des comptes et prévisualisation transactionnelle.
- Définition de périmètres de gestion plus fins que le rôle responsable global.
- Facturation et verrouillage général des périodes.
- Politique de conservation et anonymisation pilotées dans l’interface.
- Signature, notarisation, mise à jour automatique des clients et validation terrain Windows/Linux.
- Mesures de charge et de ressources sur les volumes cibles, et validation des fournisseurs IA réels choisis par l’exploitant.
- Webhooks sortants, jetons REST de service et restauration de copie locale par l’interface.

Les contrôles réellement exécutés et les mesures sont consignés dans [VALIDATION_CI.md](VALIDATION_CI.md). Les objectifs de performance ne constituent pas une capacité déjà démontrée sur toute infrastructure.
