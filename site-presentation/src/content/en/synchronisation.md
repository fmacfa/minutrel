# Standalone workspaces and synchronisation

A computer can run Minutrel without a server. The personal workspace and each team account are separate spaces. Joining a team is optional; sharing between people requires a common server.

## Standalone workspace

The local app manages projects and tasks, a segmented timer, manual entries, corrections, notes, manual monthly summaries and CSV/PDF/ZIP/JSON exports. It bundles no Node server or AI model. Storage uses the Tauri Rust bridge and versioned JSON documents, limited to 16 MiB per workspace. The PDF engine loads when needed.

Writes use a temporary file, flush its content, keep the previous state and replace the current file. Rust revision checks and a lock prevent the main window and widget from overwriting each other. An invalid current file can be recovered from its previous copy.

Local folders are private; Unix files are created with `0600` permissions. Protection relies on the operating system account. There is no independent file-encryption key. Local backups include descriptions, private notes and conflict archives. Sign-in tokens remain in the system keychain and are excluded from JSON copies.

## Team accounts and outages

The first online sign-in prepares the account, authorised projects and current timer. In connected mode, timer actions and new manual entries are persisted in a local outbox before confirmation. The server validates segments and calculates seconds. Durable receipts recognise a delivery already accepted, without writing it again; these receipts are separate from the usual 30-day REST idempotency records.

The client clock is adjusted using the last server time received. A backward clock change blocks a new transition; the server also rejects timestamps too far in the future. Time is not rounded to minutes or invented by an assistant.

Team project/account management, corrections to server entries and integrations require a connection. V0.1 does not provide offline writes for every team entity. Previously loaded projects and the timer can be recovered after restarting offline. After 30 days without account verification, opening a team cache requires signing in again. Standalone personal work has no such deadline.

The cache retains personally loaded history up to 5,000 entries; it is not a full team copy. Viewing a colleague’s entries requires the server. For final collective totals, reconnect and wait for all members to synchronise.

## Conflicts

Each send rechecks the active member, project/task access, expected version, coherent segments, unconfirmed overlaps and uniqueness of the active timer. Previously accepted closed segments are not replaced by synchronisation. Correct a finalised server entry through the normal reasoned correction flow.

A permission, version or overlap error stops sending and keeps the local outbox. A retry does not turn a conflict into success. Finish the local timer, export the copy and compare it with the server, then choose **Archive the queue and keep the server state**. Proposals stay in local archives. Re-enter genuinely missing durations manually after checking them. V0.1 does not automatically merge divergent histories.

Changing accounts does not apply an old account’s response to the new workspace. Changes made during a send keep their own proposal and use the version actually accepted as a base. Old receipts from a second window must not revert a newer state.

## Transfer personal work to a team

Finish personal timers and sign in to the team. Explicitly map personal projects to existing, authorised team projects. Selected completed entries are copied to your account with stable import identifiers. Originals remain local. Tasks and private notes are not automatically transferred. Changing a mapping after its first send is rejected for review.

This transfer does not replicate every object, create team projects automatically or connect two teams.

## Validation scenarios

- Work without a server, close/reopen, resume and finish.
- Start on the web, control from desktop, lose the connection and reconnect.
- Replay a lost acknowledgement, send from two windows and edit while sending.
- Change accounts during a response and check workspace isolation.
- Reject overlaps, stale versions, removed permissions and incoherent clocks without losing proposals.
- Transfer the same personal entries repeatedly without duplicates.

See the [user guide](guide/en/README.md) and [documented validation](VALIDATION_CI.md).
