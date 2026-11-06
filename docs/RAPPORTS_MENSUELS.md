# Rapports mensuels du travail

Dans **Les rapports**, l’administrateur choisit le mois et les salariés, ou l’équipe entière. Les membres désactivés restent disponibles pour leur historique. Les autres rôles consultent leur rapport personnel ; ils n’ouvrent pas les exports collectifs.

## Chiffres

Le serveur additionne les secondes des temps finalisés, sans les pauses ni les temps supprimés. Les chronomètres actifs sont signalés séparément. Les intervalles sont limités aux bornes du mois dans le fuseau de l’espace ; les changements d’heure sont pris en compte. Une durée manuelle appartient à sa date de travail.

Le rapport affiche total général, projets, membres, nombre de temps et aperçu de 100 lignes. Le total ne se limite pas à cet aperçu. CSV/PDF/ZIP acceptent jusqu’à 100 membres et 20 000 temps par export ; une sélection trop grande doit être réduite.

## Travail décrit

Les descriptions accompagnent les temps. Les notes apparaissent uniquement après partage par l’auteur, et les comptes rendus uniquement après validation. Les notes privées et les brouillons IA ne sont pas transmis à l’administrateur par le rapport.

La génération IA est facultative. Elle prépare du texte à partir des descriptions et notes personnelles consenties, sans écrire sur les temps. Les chiffres du rapport ne proviennent jamais de cette réponse. Un membre peut rédiger un compte rendu manuellement.

## Téléchargements

- **CSV** : UTF-8 avec BOM, séparateur point-virgule, secondes exactes, durée lisible, versions, descriptions et travail partagé. Les cellules susceptibles d’être interprétées comme formules de tableur sont neutralisées.
- **PDF** : total, répartition par membre/projet, détail, comptes rendus validés, notes partagées et pagination.
- **ZIP** : CSV des temps, totaux par projet, rapport d’équipe et PDF individuel pour chaque membre. Les fichiers individuels sont identifiés de façon stable par l’UUID du membre.

L’export crée d’abord un instantané privé du rapport. Une correction ultérieure ne change pas les chiffres déjà capturés. Le créateur doit encore être administrateur lors du téléchargement, y compris après une attente de génération. L’accès expire après 24 h. Les instantanés expirés sont purgés lors d’une nouvelle création d’export.

Un journal consigne la création et le téléchargement, la période, le format, les membres et le total, sans recopier le texte des notes dans cette trace. La génération PDF est sérialisée pour limiter les pics mémoire.

Un [exemple fictif de PDF](../output/pdf/minutrel-rapport-demo-2026-11.pdf) est produit avec le moteur de la V0.1. Le test de recette compare aussi CSV/PDF/ZIP et vérifie que les brouillons privés sont absents.
