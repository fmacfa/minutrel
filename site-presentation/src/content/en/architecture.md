# Minutrel V0.1 architecture

Connected clients use the same API and accounts. SQLite lives on the shared team server. Desktop additionally provides a separate personal workspace and persistent outbox. Local storage goes through Rust with versioned files and a previous-state copy; no Node server process is bundled in desktop.

## Technical choices

- One Node.js 24 / Fastify server process.
- Node’s built-in SQLite with foreign keys, WAL and short transactions. V0.1 needs no PostgreSQL, Redis, broker or ORM.
- React and TypeScript for the shared interface, built with Vite.
- Tauri 2 and Rust for desktop functions, using the system WebView rather than bundling Chromium.
- Temporal for calendar boundaries; PDFKit for server PDFs; lazy-loaded pdf-lib/fontkit for local PDFs; fflate for ZIP files.
- The official MCP SDK for Streamable HTTP without persistent protocol sessions.

The server can serve the built interface and API on its own. The main [Compose configuration](../compose.yml) uses one application and a data volume; nginx is available as a separate proxy variant.

## Timer

The server stores segment timestamps and does not rewrite the database every second. Pausing closes the current segment; resuming opens another. A unique constraint prevents two active entries for one member. Totals use integer seconds; an immediate finish with no positive duration removes the empty entry.

Timer writes carry an idempotency key and a version. Repeats return the original result; changed content for the same key or an obsolete version produces a conflict. Clients then reread shared state.

SSE sends invalidations, after which clients reread authorised data. Native windows share one SSE connection. The widget loads projects and the timer rather than full reports or notes. Only the counter display updates every second, without per-second network traffic.

Native commands are persisted before sending. The server revalidates versioned snapshots and calculates seconds; durable receipts avoid duplicate imports. Conflicting proposals stay local. Read [synchronisation](SYNCHRONISATION.md).

## Sessions and permissions

Browsers use HttpOnly SameSite=Strict cookies, CSRF tokens and Secure cookies under production HTTPS. Native requests happen in Rust, with the session kept in the operating system keychain rather than localStorage or the JavaScript renderer.

Passwords use scrypt with per-account salts. Sessions and MCP tokens are indexed by SHA-256 fingerprints. Provider secrets use AES-256-GCM; back up the server key with the database. Deactivation and relevant role changes revoke access.

Local files rely on operating system account protection, without independent encryption. Spaces are separated by server and member. The personal workspace opens no network port.

## Reports and background work

Monthly boundaries use the workspace time zone. Intervals crossing a month boundary are split, including daylight-saving changes. Manual durations belong to their declared work date.

Reports aggregate completed entries. Screens receive a bounded preview; exports capture a private snapshot before producing CSV/PDF/ZIP. PDF and AI have separate, serialised queues. AI produces a private text draft and cannot write to durations.

Read the [data model](MODELE_DE_DONNEES.md), [REST reference](API.md) and [version scope](ETAT_V0_1.md).
