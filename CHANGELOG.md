# Changelog

## Unreleased

- Make GitHub English first: main README, contribution and security guidance, issue/PR templates and workflow labels. Retain the French README and all three user guides.
- Present the existing optional project task level as custom subcategories. New projects have none; the creation input is empty, with user-defined names and no presets.
- Retain the chosen subcategory and work description in timer/manual entries and exports. Add a `subcategory` column to local CSV exports and show the subcategory in local PDFs. Server CSV headers now say Subcategory/Sous-catégorie/Unterkategorie; API fields remain `tasks`, `taskId` and `taskName`.
- Reject invalid local subcategory names, categories from another project and archiving a subcategory used by an active timer.

## 0.1.0 — 2026-11-06

First functional Minutrel version: shared SQLite server, team accounts and permissions, projects and tasks, persistent synchronised timers, manual time entries, corrections with reasons, notes and work summaries.

Monthly CSV/PDF/ZIP reports, shared-work JSON export and backup/restore. Web and Tauri clients with widget, system tray/menu and OS credential storage. MCP connections for Codex/Claude Code and optional Ollama/vLLM/Claude writing providers.

Standalone desktop workspace without a server, local journal with previous-state copy, offline team time outbox, conflict checks and explicit personal-work transfer. Interface and illustrated guides in English, French and German, localised server report labels and an incoming private-draft webhook with a scoped personal token and idempotency.

Brand assets, requirements, locked dependencies, Docker images and a three-platform CI matrix. Initial installers are unsigned. Invitations, general workspace JSON import, assisted conflict merging and outgoing webhooks remain on the backlog.
