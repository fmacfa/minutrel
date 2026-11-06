# Cahier des charges — Minutrel V0.1

Version du produit : 0.1.0. Langues : français, anglais, allemand. Code libre AGPL-3.0-or-later. Instance d’équipe autohébergée et client ordinateur autonome sans serveur ni compte commercial obligatoire.

## Objet

Permettre à une équipe de compter ses heures et minutes par projet, de retrouver les mêmes données dans le navigateur et sur ordinateur, puis de produire un état mensuel du travail réalisé par les salariés.

Le logiciel doit rester sobre en ressources et utilisable sans IA. Les clients installables ciblent macOS, Windows et Linux ; ils se connectent au serveur de l’équipe.

## Utilisateurs et droits

| Rôle | Droits de la V0.1 |
| --- | --- |
| Contributeur | Projets affectés, chronomètre personnel, saisies et corrections de ses temps, notes et comptes rendus personnels |
| Responsable | Gestion des projets, tâches et affectations ; consultation des membres et des temps de l’équipe ; correction motivée de temps finalisés |
| Administrateur | Droits précédents, gestion des accès, configuration de l’espace et des moteurs IA, rapports mensuels et exports collectifs |

Le dernier administrateur actif ne peut pas perdre ses droits sans qu’un autre administrateur actif existe. La désactivation révoque les accès et conserve l’historique. Un chronomètre actif doit être arrêté explicitement avant désactivation. L’intervention d’un administrateur sur un temps actif d’autrui demande un motif.

Une instance héberge un espace. Le nom et le fuseau sont définis à l’installation ; le fuseau est figé après la première saisie afin de préserver la signification des rapports.

## Exigences fonctionnelles

| Référence | Fonction attendue |
| --- | --- |
| F01 | Installation protégée par un secret à usage initial, création du premier administrateur et absence de mot de passe par défaut |
| F02 | Connexion et déconnexion, changement de mot de passe, création/désactivation des comptes et réinitialisation par l’administrateur |
| F03 | Projets nommés, description, couleur, affectation des membres et archivage conservant les temps |
| F04 | Tâches facultatives appartenant à un seul projet, sans arborescence de dossiers locaux |
| F05 | Démarrage, pause, reprise et arrêt d’un seul chronomètre actif par membre, tous appareils confondus |
| F06 | Segments persistés ; reprise de l’état après fermeture, veille, déconnexion ou redémarrage du client |
| F07 | Saisie d’une durée explicite sur une date, ou d’un intervalle avec fuseau explicite |
| F08 | Détection des chevauchements, correction motivée, versions contre les écrasements concurrents et journal d’audit |
| F09 | Vue des temps paginée et rapport mensuel calculé dans le fuseau de l’équipe |
| F10 | Notes de travail privées ou partagées ; compte rendu mensuel relu et validé avant diffusion |
| F11 | Administrateur : choix du mois et des salariés, CSV détaillé, PDF et ZIP collectif avec rapports individuels |
| F12 | Export indépendant de l’IA, chiffres exacts, temps en cours signalés à part et instantané cohérent |
| F13 | Widget ordinateur déplaçable au-dessus des fenêtres, choix d’un projet Minutrel, commandes de temps et icône de barre de menus |
| F14 | Barre de chronomètre persistante sur le web ; détachement facultatif si le navigateur prend en charge Document Picture-in-Picture |
| F15 | Connexion facultative à Codex d’OpenAI et Claude Code par un accès MCP personnel limité |
| F16 | Rédaction facultative avec Ollama, vLLM ou Claude, sans embarquer de modèle dans les clients |
| F17 | Export JSON du travail partagé et sauvegarde/restauration complète de la base et de sa clé |

Les modalités figurent dans [API.md](API.md), [COMMANDE_RAPIDE.md](COMMANDE_RAPIDE.md), [RAPPORTS_MENSUELS.md](RAPPORTS_MENSUELS.md) et [INTEGRATIONS_IA.md](INTEGRATIONS_IA.md).

## Règles de temps

L’unité de stockage et de calcul est la seconde entière. Une durée accepte `1h30`, `01:30`, `90 min` ou `1,5 h`. Les saisies ambiguës sont refusées. Une durée manuelle est positive et limitée à 24 h par saisie ; un intervalle passé est limité à sept jours.

Les pauses ne comptent pas. Un temps actif n’entre pas dans les totaux finalisés. Les intervalles sont semi-ouverts et découpés aux frontières locales du mois, y compris lors des changements d’heure. Une modification du texte d’un temps doit pouvoir conserver ses segments.

Un échec de réseau ne vaut pas acceptation du serveur. Le client ordinateur sauvegarde les actions de chronomètre et nouvelles saisies dans une file locale avant envoi. Le serveur contrôle versions, affectations et chevauchements. Les conflits restent conservés et peuvent être archivés pour reprendre le serveur. Le navigateur et les opérations de gestion d’équipe nécessitent une connexion.

Le client peut aussi fonctionner seul, sans compte en ligne, pour gérer ses projets personnels, temps, notes, comptes rendus manuels et exports. Le rattachement ultérieur à une équipe demande une correspondance explicite de projets et conserve les originaux locaux. Le [contrat de synchronisation](SYNCHRONISATION.md) précise la portée.

## Assistants et confidentialité

« Coder » désigne **Codex d’OpenAI**. Les assistants accèdent aux données personnelles autorisées par leur jeton, même si son propriétaire est administrateur. Ils ne disposent pas des exports collectifs ni de l’administration. Le droit de commander le chronomètre est facultatif et distinct des droits de lecture et de proposition de notes.

Aucune surveillance automatique des dossiers, captures d’écran ou conversations des autres logiciels n’est prévue. Les propositions restent privées jusqu’à relecture et partage. Un moteur IA peut rédiger un aperçu du travail ; il ne peut ni inventer des heures, ni modifier les chiffres calculés par le serveur.

## Exigences techniques et livraison

Le serveur commun est l’autorité pour les comptes, les droits et les temps. SQLite WAL permet une installation légère de la V0.1 ; aucune base n’est à installer sur chaque poste. Le [guide d’autohébergement](AUTOHEBERGEMENT.md) doit couvrir HTTPS, données persistantes, sauvegarde et restauration.

Le dépôt doit comprendre sources, licence, guides utilisateur illustrés FR/EN/DE, documentation technique, identité visuelle libre, dépendances verrouillées, contrôles automatisés, constructions web/API, matrice native et conteneurs. Les installateurs initiaux sont des paquets de test ; la signature et la mise à jour automatique sont des travaux ultérieurs.

Les [budgets de ressources](RESSOURCES.md) sont des objectifs mesurables. La cible de charge future est 50 comptes, 20 utilisateurs simultanés, 500 projets et 100 000 temps par instance ; elle doit être éprouvée avant d’être annoncée comme capacité garantie.

## Critères de recette

Deux clients connectés au même compte doivent voir le même chronomètre, y compris une pause et un arrêt effectués ailleurs. Deux démarrages concurrents ne doivent produire qu’un temps actif. Une double requête ne doit pas doubler la durée. Un contributeur ne doit pas lire les temps d’autrui.

Un rapport mensuel doit conserver les secondes exactes, exclure les pauses et les temps actifs, inclure l’historique des membres désactivés et donner les mêmes chiffres dans ses exports. Une sauvegarde doit restaurer les temps et les secrets chiffrés. Les traitements IA doivent échouer sans empêcher le suivi du temps.

Le [plan de recette](RECETTE.md), l’[état de la V0.1](ETAT_V0_1.md) et le [backlog](BACKLOG.md) servent de référence pour la réception et la suite.
