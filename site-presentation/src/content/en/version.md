# Minutrel V0.1 scope

Product version: **0.1.0**. This is a test preview. The following capabilities are delivered; future work is listed separately.

## Delivered features

| Area | V0.1 |
| --- | --- |
| Setup | First administrator protected by a locally generated secret; no public registration |
| Team | Create accounts, contributor/manager/administrator roles, deactivation and password resets |
| Projects | Names, descriptions, colours, assignments, optional tasks and archiving |
| Timer | Start, pause, resume, finish; persistent segments, one active entry per member, version/idempotency checks |
| Manual entries | Explicit durations, intervals with UTC offsets, overlap detection and reasoned corrections |
| Sharing | Common web/desktop server, SSE notifications and server-side permission checks |
| Work notes | Private/shared notes, assistant draft proposals and reviewed/approved summaries |
| Reports | Exact seconds, workspace time zone, disabled members’ history, administrator CSV/PDF/ZIP |
| Snapshots | Immutable export content, private download with a 24-hour lifetime and permission rechecks |
| Desktop | Tauri client, native HTTP, keychain session, floating widget, system icon and shortcut |
| Browser | Persistent compact timer; external mini window where Document Picture-in-Picture is supported |
| MCP | HTTP server for Codex/Claude Code; scoped, expiring and revocable personal tokens |
| AI writing | Optional Ollama/vLLM/Claude adapters, allowed hosts, encrypted server-side secrets and human review |
| Data | SQLite WAL, correction log, command-line backup/restore, shared-work JSON v2 |
| Standalone desktop | Personal workspace without server or online account, projects, time, notes, manual summaries and local exports |
| Offline team time | Persistent outbox for timer commands and new entries; receipts and preserved, archivable conflicts |
| Personal transfer | Explicit mapping to team projects and repeated imports without duplicates |
| Incoming webhook | Private drafts through `/hooks/work-notes`, scoped token, idempotency and revocation |
| Languages | App interface and illustrated guides in French, English and German; localised server reports |

## Scope and limits

One instance hosts one team workspace. Managers handle all projects and may view/correct team time with a reason. Contributors see their own time and assigned projects. Collective monthly exports are reserved for administrators.

The browser requires the shared server. Desktop additionally has a standalone personal workspace and a separate team outbox. Spaces stay distinct. Correcting server entries and managing the team require a connection. Offline changes show their actual waiting/conflict state.

AI is optional and reads neither local folders nor conversations in other software automatically. Standalone mode offers manual summaries; AI integrations and webhooks use the team server.

Report previews contain at most 100 rows with full totals. Exports accept 100 members and 20,000 entries. AI input is limited to 500 entries and 80,000 characters; generations are serialised with bounded waiting. These are implementation limits, not a demonstrated load-test capacity.

## Future versions

- Assisted conflict resolution and offline notes/team entity management.
- Single-use invitations, SSO/OIDC and finer manager scopes.
- JSON import with account matching and a transactional preview.
- Budgets, invoicing, rates and period locking.
- Retention and anonymisation controls in the interface.
- Signed/notarised desktop packages, automatic updates and Windows/Linux field validation.
- Load/resource measurements and validation of the actual AI providers selected by operators.
- Outgoing webhooks, independent REST service tokens and local-copy restoration through the interface.

See the [documented checks](VALIDATION_CI.md) for what was actually validated.
