# V0.1 data model

SQLite lives on the shared server. The executed schema is in [store.ts](../apps/api/src/store.ts), with `PRAGMA user_version=1`. Newer database versions are refused. Foreign keys and WAL are enabled.

Entities use UUIDs, timestamps use integer Unix seconds, work dates use ISO `YYYY-MM-DD` strings, and durations use integer seconds rather than floating-point hours.

| Table | Content and constraints |
| --- | --- |
| `workspace` | Single workspace: identity, name and report time zone |
| `members` | Identity, case-insensitive unique email, role, enabled state and scrypt password |
| `sessions` | Session fingerprint, owner, CSRF, browser/native type and expiry |
| `projects` | Name, description, colour, archive state and version |
| `assignments` | Unique project/member association |
| `tasks` | Project tasks, name and archive state |
| `entries` | Member, project, optional task, source, state, description, work date, seconds, version and timestamps |
| `segments` | Start/end of a timer segment or manual interval |
| `notes` | Text, author, project, date, private/shared state and human/assistant source |
| `summaries` | Monthly text, source, draft/approved state and time-entry references |
| `tokens` | Personal MCP token fingerprint, scopes, name and expiry |
| `providers` | AI recipient, model, enabled state and encrypted secret |
| `idempotency` | Unique member/key pair, request fingerprint and original result; retained 30 days |
| `exports` | Creator, format, private JSON snapshot and 24-hour download expiry |
| `audit` | Actor, operation, object, reason/detail and time |
| `sync_receipts` | Unique member/mutation or import, content fingerprint and durable receipt; separate from ordinary idempotency |

## States and consistency

Entry states are `running`, `paused`, `finished` and `deleted`. The partial `one_active_timer` unique index prevents multiple running/paused entries for one member. `one_open_segment` prevents several open segments per entry. Closed segments cannot end before they start.

Compound operations use short synchronous transactions. The write lock is acquired before looking up the active state and checking idempotency. Network requests and document generation do not run inside a time-write transaction.

Removing a time entry is a logged logical deletion. Project archiving preserves relationships and blocks new starts. Projects, tasks and assignments in use by a timer cannot be removed in a way that makes it inaccessible.

## Secrets and desktop files

Passwords are stored as salt/derived-key values; sessions and MCP tokens as fingerprints. Provider keys use AES-256-GCM with a 32-byte server key that must accompany backups.

Desktop’s system keychain is separate from SQLite and holds one native session per server address. If unavailable, the session stays only in memory and the interface shows that state.

Local `LocalData.schema=1` files are wrapped in a Rust revision. They hold profiles, projects, entries/segments, notes, summaries, the outbox and conflict archives. Spaces are separated by server/member, with a distinct personal profile. Personal corrections keep up to 1,000 recent traces with previous values and reasons. Local files contain private work, but no sign-in token; their protection relies on the operating system account.

## Portability

The `schema_version: 2` JSON export contains the workspace, identities needed for member matching, projects, assignments, tasks, completed entries/segments, shared notes and approved summaries. It excludes passwords, sessions, provider keys and private notes. Segment identifiers are opaque and deterministic.

Full V0.1 restoration uses SQLite backup. General JSON import with account matching remains future work. The historical v1 example is a calculation fixture, not an implemented import endpoint.
