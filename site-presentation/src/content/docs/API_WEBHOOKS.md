# API, MCP et webhook entrant

Minutrel V0.1 propose trois accès complémentaires. Ils sont servis par l’instance de l’équipe ; le profil ordinateur autonome n’expose pas de port réseau.

| Accès | Usage | Authentification |
| --- | --- | --- |
| `/api/v1` | Comptes, projets, temps, synchronisation, rapports et exports | Session d’application avec les droits du membre ; cookie + CSRF pour le navigateur, session Bearer pour le client natif |
| `/mcp` | Outils personnels pour Codex et Claude Code | Jeton personnel à droits explicites, limité, expirant et révocable |
| `POST /hooks/work-notes` | Recevoir une proposition de note de travail depuis un outil externe | Jeton personnel possédant `work.draft_own`, plus `Idempotency-Key` |

Le [contrat REST](API.md) détaille les routes, la pagination, les versions et les erreurs. Les [exemples MCP](INTEGRATIONS_IA.md) couvrent les assistants. Un jeton MCP n’ouvre pas les routes REST, les exports d’équipe ou les comptes d’autrui.

## Appeler l’API

`POST /api/v1/auth/login` avec `email`, `password` et `native: true` retourne une session Bearer de l’application, à conserver comme un mot de passe. Elle reprend tous les droits de ce compte et expire ; elle n’est pas un jeton d’intégration finement limité. Pour une automatisation REST, prévoir un compte dédié avec le rôle minimal nécessaire, sans stocker le mot de passe ou la session dans le dépôt. Il n’y a pas encore de jeton REST de service indépendant ni d’OAuth.

```http
GET /api/v1/projects
Authorization: Bearer SESSION_APPLICATION
```

Une commande de temps reprend la version reçue et une clé unique. Après une réponse réseau perdue, rejouer la même clé et le même contenu ; après un `409`, relire et demander une résolution.

```http
POST /api/v1/timer/start
Authorization: Bearer SESSION_APPLICATION
Content-Type: application/json
Idempotency-Key: automatisation-2026-11-06-0001

{"projectId":"UUID_DU_PROJET","description":"Préparation de la présentation"}
```

Le navigateur utilise son cookie et `X-CSRF-Token`, sans récupérer une session Bearer depuis JavaScript. Les écritures d’une origine tierce sont refusées. Le client natif conserve la session dans le trousseau.

## Préparer un webhook de travail

Dans **Les connexions → Créer un accès**, nommer l’automatisation, choisir sa durée puis ne cocher que **Proposer des brouillons privés**. Copier le secret une seule fois et le garder dans le gestionnaire de secrets de l’outil externe. Le droit `projects.read` peut être ajouté si cet outil utilise aussi MCP pour découvrir les projets.

L’outil envoie une requête HTTPS avec un identifiant stable par événement :

```http
POST /hooks/work-notes
Authorization: Bearer JETON_PERSONNEL
Content-Type: application/json
Idempotency-Key: evenement-source-2026-11-06-0001

{
  "projectId": "UUID_DU_PROJET_AFFECTE",
  "workDate": "2026-11-06",
  "text": "Maquettes préparées ; prochaine étape : relire la navigation."
}
```

Réponse : `{"id":"UUID_DE_LA_NOTE","shared":false,"source":"assistant"}`. La note appartient au propriétaire du jeton et reste privée dans **Le fil du travail**. Le propriétaire doit la relire avant partage. Le webhook ne reçoit pas `memberId`, `shared`, une durée ou des droits d’administration ; les propriétés supplémentaires sont refusées. Même un administrateur ne peut viser que ses projets personnellement affectés par ce webhook.

Le serveur limite ce point d’entrée à 60 demandes par minute et par jeton. Le texte est limité à 8 000 caractères. Une répétition avec la même clé et le même corps restitue la note déjà créée ; la même clé avec un autre corps donne `409`. Les clés d’idempotence REST/webhook sont retenues 30 jours. Les reçus de synchronisation des temps ont une conservation distincte.

Révoquer le jeton coupe MCP et le webhook à la requête suivante. Une désactivation du compte ou les autres mesures de révocation s’appliquent également. Aucun secret ne doit figurer dans une URL, un journal ou une capture.

## Hébergement et erreurs

Le proxy doit transmettre `/hooks/` au même serveur que `/api/` et `/mcp`. Les exemples Caddy et nginx du dépôt sont compatibles avec cette route. Il n’est pas nécessaire d’ouvrir un port vers les clients ordinateur.

`401` : jeton absent, expiré ou révoqué. `403` : droit ou affectation insuffisant. `400` : schéma/date incorrects. `409` : clé réutilisée avec un contenu différent. `429` : ralentir les répétitions ; conserver la même clé pour la même demande. Les outils externes doivent traiter les erreurs et ne pas inventer un succès.

## Limites

Il s’agit d’un **webhook entrant de notes privées**. La V0.1 ne livre pas d’abonnements sortants, de notifications d’événements signées vers des URL tierces ou de webhook de modification des heures. Ces usages restent au backlog. Les assistants peuvent commander le chronomètre via MCP uniquement avec le droit personnel supplémentaire explicite.
