# API, MCP and incoming webhook

The team instance provides three complementary access paths. A standalone desktop workspace exposes no network port.

| Access | Purpose | Authentication |
| --- | --- | --- |
| `/api/v1` | Accounts, projects, time entries, sync, reports and exports | App session with member permissions; browser cookie + CSRF or native Bearer session |
| `/mcp` | Personal tools for Codex and Claude Code | Expiring, revocable personal token with explicit scopes |
| `POST /hooks/work-notes` | Receive a proposed private work note | Personal token with `work.draft_own` and an `Idempotency-Key` |

A personal MCP token does not open REST routes, collective exports or another member’s account. See the [REST reference](API.md) and [assistant integrations](INTEGRATIONS_IA.md).

## Call the API

`POST /api/v1/auth/login` with `email`, `password` and `native: true` returns an application Bearer session. Treat it like a password. It inherits the account’s permissions and expires; it is not a narrowly scoped integration token. For REST automation, use a dedicated account with the minimum necessary role and keep credentials outside the repository. V0.1 has no separate REST service tokens or OAuth.

```http
GET /api/v1/projects
Authorization: Bearer APPLICATION_SESSION
```

Time commands carry the received version and a unique idempotency key. If a network response is lost, replay the same key and content. After `409`, reread the state and resolve the conflict.

```http
POST /api/v1/timer/start
Authorization: Bearer APPLICATION_SESSION
Content-Type: application/json
Idempotency-Key: automation-2026-11-06-0001

{"projectId":"PROJECT_UUID","description":"Prepare the presentation"}
```

Browsers use their cookie and `X-CSRF-Token`; JavaScript does not receive a native Bearer session. Cross-origin writes are rejected. The native client keeps its session in the system keychain.

## Prepare a work-note webhook

In **Connections → Create access**, name the automation, choose its lifetime and select only **Propose private drafts**. Copy the secret once and store it in the external tool’s secret manager. Add `projects.read` only if MCP project discovery is also needed.

Send HTTPS requests with a stable identifier for each source event:

```http
POST /hooks/work-notes
Authorization: Bearer PERSONAL_TOKEN
Content-Type: application/json
Idempotency-Key: source-event-2026-11-06-0001

{
  "projectId": "ASSIGNED_PROJECT_UUID",
  "workDate": "2026-11-06",
  "text": "Mockups prepared; next step: review navigation."
}
```

Response: `{"id":"NOTE_UUID","shared":false,"source":"assistant"}`. The note belongs to the token owner and stays private in **Work notes** until its owner reviews it. The webhook rejects extra properties such as `memberId`, `shared`, duration or administration flags. Even an administrator can target only projects personally assigned to them.

The endpoint permits 60 requests per minute per token, with at most 8,000 text characters. The same key and body return the existing note; the same key with different content returns `409`. Ordinary REST/webhook keys are retained for 30 days; time-sync receipts have separate retention.

Revocation cuts MCP and webhook access at the next request. Account deactivation and other access revocations apply as well. Keep secrets out of URLs, logs and screenshots.

## Hosting and errors

Forward `/hooks/` through the same proxy as `/api/` and `/mcp`. No inbound port needs to be opened on desktop clients.

| Status | Action |
| --- | --- |
| `400` | Check the schema and work date |
| `401` | Token missing, expired or revoked |
| `403` | Scope or project assignment insufficient |
| `409` | Same key reused with different content; resolve before retrying |
| `429` | Slow down; keep the same key for the same event |

External tools must handle errors and never claim a write succeeded without confirmation.

## Scope in V0.1

This is an **incoming private-note webhook**. Outgoing event subscriptions, signed notifications to third-party URLs and webhooks that modify hours are not delivered. MCP timer commands require the additional explicit personal scope `timer.write_own`.
