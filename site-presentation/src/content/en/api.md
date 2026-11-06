# Minutrel V0.1 HTTP API

REST uses `/api/v1`; MCP uses `/mcp` and Streamable HTTP. REST objects use `camelCase`. The separate portability JSON document uses `schema_version: 2` and historical `snake_case` fields.

## Authentication

The browser receives a `minutrel` cookie with HttpOnly, SameSite=Strict and Secure when `APP_SECURE_COOKIES=true`. Authenticated writes use `X-CSRF-Token`, returned at sign-in and by `GET /me`. Foreign-origin writes are rejected. Setup and sign-in routes are rate-limited.

Native sign-in uses `native: true`. The Bearer session is returned to Rust once, stored in the keychain and removed from the response passed to the JavaScript renderer. Personal MCP tokens are different: they open scoped MCP tools and, with `work.draft_own`, the note webhook. They grant no REST access.

| Method | REST path | Purpose and permissions |
| --- | --- | --- |
| GET | `/instance`, `/health/live`, `/health/ready` | Public instance version and health |
| GET | `/setup` | Whether the first workspace needs creation |
| POST | `/setup` | First administrator with `setupToken`, workspace name/time zone, identity and password |
| POST | `/auth/login`, `/auth/logout` | Sign in and revoke the current session |
| GET | `/me` | Account, workspace, CSRF and server time |
| POST | `/me/password` | Current/new password; revokes sessions and personal tokens |
| PATCH | `/workspace` | Administrator: workspace name/time zone; time zone fixed after the first entry |
| GET | `/members` | Member list; manager or administrator |
| POST | `/members` | Create account and role; administrator |
| PATCH | `/members/{id}` | Identity, role and enabled state; administrator |
| POST | `/members/{id}/password` | Reset password and revoke access; administrator |
| GET, POST | `/members/{id}/timer`, `/members/{id}/timer/stop` | View/resolve active timer with version and reason; administrator |
| GET, POST | `/projects` | Authorised projects; manager/administrator creation |
| PATCH | `/projects/{id}` | Edit, archive and assign members with version; manager/administrator |
| POST | `/projects/{id}/tasks` | Add a task; manager/administrator |
| PATCH | `/tasks/{id}` | Rename/archive task; manager/administrator |
| GET | `/timer` | Own timer and server time |
| POST | `/timer/start`, `/timer/pause`, `/timer/resume`, `/timer/stop` | Personal, idempotent writes with version checks |
| GET, POST | `/time-entries` | Paginated list and personal manual entries |
| PATCH, DELETE | `/time-entries/{id}` | Correct/remove completed entry; version and reason required |
| PATCH | `/time-entries/{id}/description` | Edit description without replacing segments |
| GET, POST | `/notes` | Own notes; human-created private/shared notes |
| PATCH, DELETE | `/notes/{id}` | Review/share or delete own note |
| GET, POST | `/summaries` | Own summaries; create a manual draft |
| PATCH | `/summaries/{id}` | Author edits text and `draft`/`approved` status |
| POST | `/summaries/generate` | Personal AI draft; configured provider and `consent: true` |
| GET | `/reports/monthly?month=YYYY-MM` | Personal report; administrator may select members |
| POST | `/exports` | Create CSV/PDF/ZIP snapshot; administrator |
| GET | `/exports/{id}` | Download own valid snapshot; administrator permission rechecked |
| GET | `/workspace/export` | Shared, completed-work JSON export; administrator |
| GET | `/audit` | Recent administration events; administrator |
| GET, POST | `/mcp-tokens` | List/create own assistant tokens; secrets not redisplayed |
| DELETE | `/mcp-tokens/{id}` | Revoke own token |
| GET | `/providers` | Provider profiles without secrets; signed-in account |
| POST, PATCH, DELETE | `/providers`, `/providers/{id}` | Provider management; administrator |
| GET | `/events` | Authenticated SSE: `connected`, `change`, heartbeat; no business data in events |
| POST | `/sync/time-entry` | Personal timer snapshot with `mutationId`, `baseVersion` and segments; rights/history rechecked |
| POST | `/sync/import` | Personal manual entry with stable `localId` and `input`; durable receipt avoids duplicates |

## Timer and concurrency

Timer writes and manual entry creation require an `Idempotency-Key`: 8–128 alphanumeric characters, hyphens or `_`, unique to the request. The original result is kept for 30 days. Reusing a key for different content returns `409`.

```http
POST /api/v1/timer/start
Idempotency-Key: 6c508152-4964-4d50-82a1-30f7c4545d90
Content-Type: application/json

{"projectId":"PROJECT_UUID","taskId":null,"description":"Prepare mockups"}
```

`pause`, `resume` and `stop` receive `{"version":1}` with the current version. The response contains the entry and its new version. `GET /timer` returns `{"timer":...,"serverNow":...}`. Reread after a conflict; do not blindly resubmit with a newer version.

## Entries and lists

A manual duration has `projectId`, optional `taskId`, `description`, `kind: "duration"`, `workDate: "2026-11-05"` and `duration: "1h30"`. An interval uses `kind: "interval"`, `startedAt`, `endedAt` in ISO format with explicit UTC offsets, and optionally `allowOverlap: true` after confirmation.

Lists accept `memberId=me` or an authorised UUID, `month`, `offset` and `limit` (1–100, default 50). They return `items`, `total` and `serverNow`. Contributors cannot select another member.

A full correction uses the manual-entry form with `version` and `reason`. A description-only correction preserves segments and takes the new description, version and reason.

## Reports

`memberIds` is comma-separated UUIDs for report GET requests or an array for export creation. Without a selection, administrators see the whole team; other roles see themselves.

Reports contain `totalSeconds`, `entryCount`, member/project aggregates, up to 100 preview `entries`, shared notes and approved summaries. Each preview row has `reportSeconds` for its portion of that month.

`POST /exports` receives `month`, `format` (`csv`, `pdf`, `zip`), `language` (`fr`, `en`, `de`; default French) and optional `memberIds`. It returns `id`, `url`, `filename` and `expiresAt`. The private snapshot keeps its original content and language after later entry changes.

## Desktop synchronisation

Standalone mode exposes no API. For connected accounts, `/sync/time-entry` accepts a UUID `mutationId`, expected `baseVersion` or `null`, and `entry`: `id`, `projectId`, `taskId`, `description`, `state`, and `segments` with second-based `startedAt`/`endedAt`. The server calculates durations, rejects incoherent states and never rewrites already finalised segments. Response: `{entry, serverNow}`.

`/sync/import` accepts `localId` and `input` in the manual-entry format. Repeating it returns the same record; changed content for an existing identifier returns `409`. Sync receipts are separate from ordinary 30-day idempotency records. See [synchronisation](SYNCHRONISATION.md).

## Errors

Errors use `{"error":"...","message":"..."}`. Common codes are `400` (input), `401` (session), `403` (permissions/CSRF/origin), `404` (object or expired export), `409` (concurrency/state), `429` (limit) and `502` (AI provider). Client-facing errors must not expose database internals, passwords or keys.
