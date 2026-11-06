# Vérification de la V0.1

Les tests exécutables vivent près du code : `packages/domain/src/`, `apps/api/src/` et `apps/api/src/integrations/`. Vitest couvre durées, calendrier, rôles, sessions, temps concurrents, corrections, exports, persistance, sauvegardes, MCP réel et réponses IA simulées.

Les dossiers unit/integration/e2e restent des emplacements de classement pour les suites à venir. La recette d’interface et de plateformes est décrite dans [RECETTE.md](../docs/RECETTE.md) ; les résultats exécutés sont dans [VALIDATION_CI.md](../docs/VALIDATION_CI.md).

`check_running_instance.py` écrit dans une instance CI jetable. Ne pas le diriger vers une instance contenant le travail d’une équipe.
