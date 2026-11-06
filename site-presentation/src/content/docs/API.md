# API HTTP de Minutrel V0.1

REST : `/api/v1`. MCP : `/mcp`, avec le SDK officiel Streamable HTTP. Les objets REST utilisent `camelCase`. L’export de portabilité est un document JSON distinct avec `schema_version: 2` et des champs historiques `snake_case`.

## Authentification

Le navigateur reçoit un cookie `minutrel` HttpOnly, SameSite=Strict, Secure lorsque `APP_SECURE_COOKIES=true`. Les écritures authentifiées portent `X-CSRF-Token`, retourné à la connexion et par `GET /me`. Une origine tierce est refusée. Les routes d’installation/connexion sont limitées en fréquence.

Le client natif utilise `native: true` lors de la connexion. Sa session est retournée une seule fois au pont Rust, conservée dans le trousseau puis envoyée avec `Authorization: Bearer <session>`. Ce jeton est retiré de la réponse remise au rendu JavaScript.

Un jeton MCP est différent d’une session d’application : il ouvre `/mcp` et les outils correspondant à ses droits. Avec `work.draft_own`, il autorise aussi le webhook entrant de notes privées. Il n’autorise aucune route REST. Voir [API et webhook](API_WEBHOOKS.md).

| Méthode | Chemin REST | Fonction et droit |
| --- | --- | --- |
| GET | `/instance`, `/health/live`, `/health/ready` | Version et état public de l’instance |
| GET | `/setup` | Indique si le premier espace doit être créé |
| POST | `/setup` | Premier administrateur avec `setupToken`, nom de l’espace, fuseau, identité et mot de passe |
| POST | `/auth/login`, `/auth/logout` | Connexion et révocation de la session courante |
| GET | `/me` | Compte, espace, CSRF et heure serveur |
| POST | `/me/password` | Mot de passe actuel et nouveau ; révoque sessions et jetons personnels |
| PATCH | `/workspace` | Nom/fuseau ; administrateur, fuseau figé après première saisie |
| GET | `/members` | Liste des membres ; responsable ou administrateur |
| POST | `/members` | Créer un compte et son rôle ; administrateur |
| PATCH | `/members/{id}` | Identité, rôle et activation ; administrateur |
| POST | `/members/{id}/password` | Réinitialiser et révoquer les accès ; administrateur |
| GET, POST | `/members/{id}/timer`, `/members/{id}/timer/stop` | Voir/résoudre un temps actif avec version et motif ; administrateur |
| GET, POST | `/projects` | Projets autorisés ; création responsable/administrateur |
| PATCH | `/projects/{id}` | Modifier, archiver, affecter les membres ; responsable/administrateur avec version |
| POST | `/projects/{id}/tasks` | Ajouter une tâche ; responsable/administrateur |
| PATCH | `/tasks/{id}` | Renommer/archiver une tâche ; responsable/administrateur |
| GET | `/timer` | Chronomètre personnel et heure serveur |
| POST | `/timer/start`, `/timer/pause`, `/timer/resume`, `/timer/stop` | Écritures personnelles idempotentes, contrôlées par version |
| GET, POST | `/time-entries` | Liste paginée et saisie personnelle manuelle |
| PATCH, DELETE | `/time-entries/{id}` | Correction ou retrait d’un temps finalisé, version et motif obligatoires |
| PATCH | `/time-entries/{id}/description` | Modifier le texte sans remplacer les segments |
| GET, POST | `/notes` | Notes personnelles ; création humaine privée ou partagée |
| PATCH, DELETE | `/notes/{id}` | Relire/partager ou supprimer sa note |
| GET, POST | `/summaries` | Comptes rendus personnels, création d’un brouillon manuel |
| PATCH | `/summaries/{id}` | Texte et état `draft`/`approved`, par l’auteur |
| POST | `/summaries/generate` | Brouillon IA personnel, fournisseur configuré et `consent: true` |
| GET | `/reports/monthly?month=AAAA-MM` | Rapport personnel ; l’administrateur peut choisir les membres |
| POST | `/exports` | Créer un instantané CSV/PDF/ZIP ; administrateur |
| GET | `/exports/{id}` | Télécharger son instantané encore valide ; droit administrateur revérifié |
| GET | `/workspace/export` | Export JSON du travail partagé et finalisé ; administrateur |
| GET | `/audit` | Dernières opérations de gestion ; administrateur |
| GET, POST | `/mcp-tokens` | Voir/créer ses accès assistant, sans réafficher leur secret |
| DELETE | `/mcp-tokens/{id}` | Révoquer un accès personnel |
| GET | `/providers` | Profils IA sans secrets ; compte connecté |
| POST, PATCH, DELETE | `/providers`, `/providers/{id}` | Gestion des fournisseurs ; administrateur |
| GET | `/events` | SSE authentifié : `connected`, `change` et heartbeat, sans données métier dans l’événement |
| POST | `/sync/time-entry` | Instantané de chronomètre personnel avec `mutationId`, `baseVersion` et segments ; droits et historique revalidés |
| POST | `/sync/import` | Nouvelle saisie personnelle avec `localId` stable et formulaire `input` ; reçu durable sans doublon |

## Chronomètre et concurrence

Chaque écriture de chronomètre et chaque création manuelle porte `Idempotency-Key`, unique par demande, de 8 à 128 caractères alphanumériques, tirets ou `_`. Le serveur conserve le résultat d’origine pendant 30 jours. Une même clé avec un autre contenu donne `409`.

```http
POST /api/v1/timer/start
Idempotency-Key: 6c508152-4964-4d50-82a1-30f7c4545d90
Content-Type: application/json

{"projectId":"UUID_DU_PROJET","taskId":null,"description":"Préparer les maquettes"}
```

`pause`, `resume` et `stop` reçoivent `{"version":1}` avec la version courante. La réponse contient l’entrée et sa nouvelle version. `GET /timer` retourne `{"timer":...,"serverNow":...}`. Un conflit demande une relecture ; il ne faut pas recommencer aveuglément avec une nouvelle version.

## Saisies et listes

Une durée manuelle contient `projectId`, `taskId` facultatif, `description`, `kind: "duration"`, `workDate: "2026-11-05"` et `duration: "1h30"`. Un intervalle contient `kind: "interval"`, `startedAt`, `endedAt` en ISO avec décalage explicite, et éventuellement `allowOverlap: true` après confirmation.

La liste accepte `memberId=me` ou un UUID autorisé, `month`, `offset` et `limit` (1 à 100, 50 par défaut). Elle retourne `items`, `total` et `serverNow`. Un contributeur ne peut pas choisir un autre membre.

La correction complète reprend le formulaire manuel avec `version` et `reason`. La correction de description conserve les segments et ne reçoit que ces deux champs et le nouveau texte.

## Rapports

`memberIds` est une liste d’UUID séparés par des virgules dans le rapport GET, ou un tableau dans la création d’export POST. Sans sélection, l’administrateur voit l’équipe entière ; les autres rôles voient leur rapport personnel.

Le rapport contient `totalSeconds`, `entryCount`, les agrégats par membre/projet, un aperçu de 100 `entries`, les notes partagées et les comptes rendus validés. Chaque ligne d’aperçu porte `reportSeconds` pour la portion du mois concerné.

`POST /exports` reçoit `month`, `format` (`csv`, `pdf`, `zip`), `language` (`fr`, `en`, `de`, français par défaut) et les `memberIds` facultatifs. La réponse contient `id`, `url`, `filename` et `expiresAt`. Le snapshot est privé au créateur et conserve le même contenu et la même langue lors d’une modification ultérieure des temps.

## Synchronisation ordinateur

Le client peut rester autonome sans ouvrir d’API réseau. Pour un compte relié, `POST /sync/time-entry` reçoit un UUID `mutationId`, la version serveur attendue `baseVersion` ou `null` pour une création, et `entry` : `id`, `projectId`, `taskId`, `description`, `state`, `segments` (`startedAt`, `endedAt` en secondes). Le serveur calcule les durées, refuse les états incohérents et ne réécrit pas les segments déjà finalisés. La réponse est `{entry, serverNow}`.

`POST /sync/import` reçoit `localId` et `input` au format d’une saisie manuelle. Une répétition restitue le même enregistrement. Changer le contenu associé à un identifiant déjà reçu produit `409`. Les reçus sont conservés séparément de l’idempotence de 30 jours des routes courantes. Voir [SYNCHRONISATION.md](SYNCHRONISATION.md).

## Erreurs

Les erreurs ont la forme `{"error":"...","message":"..."}`. Les codes courants sont `400` (données), `401` (session), `403` (droits/CSRF/origine), `404` (objet ou export expiré), `409` (concurrence/état), `429` (limite) et `502` (fournisseur IA). Un détail de base, mot de passe ou clé ne doit pas apparaître dans une erreur destinée au client.
