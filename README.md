# Minutrel — V0.1

**English** · [Français](README.fr.md) · [Deutsch — user guide](docs/guide/de/README.md)

Your project time, together. **Open source, self-hosted time tracking** for teams, with a web app and desktop clients for macOS, Windows and Linux. Licensed under **AGPL-3.0-or-later**.

**Website: [English](https://minutrel-presentation.pippo-247.chatgpt.site/en/) · [Français](https://minutrel-presentation.pippo-247.chatgpt.site/).**

Minutrel V0.1 includes team accounts and permissions, projects with custom subcategories, timers, manual time entries, offline desktop recording, work notes, monthly CSV/PDF/ZIP reports, a REST API, an incoming webhook and MCP tools. The interface supports **English, French and German**.

The desktop app can also run **entirely on its own, without an online account or server**. Joining a team is optional. Team clients connect to the same self-hosted server, which stores shared data in SQLite. Desktop clients use Tauri and the system WebView, with no bundled AI model.

This is a **test prerelease**. Packages are unsigned. Check the [validation record](docs/VALIDATION_CI.md) and [publication checklist](docs/PRE_PUBLICATION.md), currently in French, for checks actually completed and the remaining platform, signing, load and security validation.

**Illustrated user guides: [English](docs/guide/en/README.md) · [Français](docs/guide/fr/README.md) · [Deutsch](docs/guide/de/README.md).**

## Watch Minutrel

[![Minutrel introduction in English](docs/videos/posters/01.png)](https://youtu.be/q6VeUbyOhn8)

[Introduction](https://youtu.be/q6VeUbyOhn8) · [How it works and first steps](https://youtu.be/u5MItUvsxQc) · [YouTube playlist](https://www.youtube.com/playlist?list=PLR7Pc9PfnKIk)

The [English video catalog](docs/VIDEOS.en.md) lists all **12 English videos**, with narration, original music and subtitles. All twelve are public on YouTube; the assistant and self-hosting guides also provide MP4 downloads. Examples use fictional prerelease data.

## Try it locally

Install **Node.js 24**, as pinned in [.nvmrc](.nvmrc), then run:

```sh
npm ci --ignore-scripts
npm run demo
```

Open **http://127.0.0.1:8080**. Random demo credentials are stored in `.cache/demo/access.json`. Fictional demo data stays in `.cache/demo/`. No AI provider is contacted. Stop the server with `Ctrl+C`.

## Create your own workspace

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open **http://127.0.0.1:8081** and create the first administrator using the secret in `data/setup-token`. There is no default password. The database and encryption key stay in `data/`.

Administrators create members and assign roles; managers organise projects and membership. All team devices connect to this same instance.

## Self-host with Docker

```sh
docker compose up -d --build
docker compose exec minutrel cat /app/data/setup-token
```

Open **http://127.0.0.1:8080**. By default, the service is exposed only on the host computer. For team access, configure HTTPS and a reverse proxy using the [self-hosting guide](docs/AUTOHEBERGEMENT.md), currently in French. Data persists in a Docker volume.

## Desktop app and offline work

For a team, enter the server address at sign-in. Use the same account to share projects, entries and permissions with the web app.

To work independently, choose **Use on this computer**. Create projects, record time, write notes and export locally, without a server or online account. You can later choose **Open a team workspace** and explicitly map personal projects before transferring completed time entries.

A linked desktop account can record timer actions and new manual entries while temporarily offline, after its first online sign-in. Changes are saved locally before sending; the server rechecks permissions, versions and overlaps. Personal and team workspaces stay separate. See the [English user guide](docs/guide/en/README.md) and [technical synchronisation notes](docs/SYNCHRONISATION.md), the latter in French.

**Mini timer** and the system tray/menu icon open a movable widget above ordinary windows. Select a Minutrel project and optional subcategory, then start, pause, resume or stop. No local disk folder is requested. The proposed shortcut is `Ctrl/Cmd + Alt + M`, subject to system support.

To build an installer on the current platform, install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and Rust through `rustup`, then run:

```sh
npm run build:desktop
```

The script produces a macOS `.dmg`, Windows NSIS installer or Linux `.deb` under `apps/desktop/src-tauri/target/`. V0.1 test packages are unsigned. CI defines a build matrix for all three platforms; a configured matrix does not itself confirm a successful build or manual test on each system.

## Custom project subcategories

Each project can contain **subcategories named by you**. Under **Projects → Subcategories**, the creation input starts empty, with no suggested or predefined labels. In a team, managers and administrators manage them; standalone users manage their own.

When recording time, choose a project and optional subcategory, then describe what you did. The subcategory and description are retained in the time entry and exports. Existing task data remains compatible with the API. Read the [subcategory guide](docs/SUBCATEGORIES.md).

## Work notes, reports and AI assistants

- **Work journal:** private or shared notes and monthly summaries for human review and approval.
- **Reports:** administrators choose the month and employees, then download CSV, PDF or ZIP. Totals use completed time entries; AI text cannot change durations.
- **Integrations:** create a personal, expiring MCP token for Codex or Claude Code. Timer commands require a separate optional permission.
- **Ollama / vLLM / Claude:** an administrator can configure an optional writing provider. Each generation requires the member’s consent to send their descriptions and notes. No model is bundled with the clients.
- **REST and incoming webhook:** application sessions provide API access; a limited personal token can submit private note drafts through `/hooks/work-notes`. Outgoing webhook subscriptions are not included.

Real AI providers and credentials must be configured on your infrastructure. Adapters have protocol tests; no paid subscription or model is supplied. Standalone mode supports manual notes and summaries; these AI integrations use the team server.

## Project planning and weekly timesheets

The development version adds project time budgets, deadlines, actions, a Gantt chart and a weekly workload view. Planning works in team workspaces and in the standalone desktop workspace. Team members can submit weekly timesheets, managers can approve or return them, and administrators can export a month of approved time in CSV, PDF or ZIP. See the [illustrated planning and timesheet guide](docs/guide/en/README.md#14-project-planning-and-timesheets).

## Checks and backups

```sh
npm run check
python3 scripts/check_repository.py
python3 scripts/check_brand.py
npm run backup
```

Server backups include a consistent SQLite copy and the key required for restoration. See the [backup procedure](infra/backup/README.md), currently in French. The desktop app can export its local copy; also back up its complete configuration folder. Invitations, general workspace JSON import and automatic conflict merging remain on the backlog.

## Repository map

| Directory | Contents |
| --- | --- |
| `apps/web` | Browser entry point and Vite configuration |
| `apps/desktop` | Tauri app, OS credential store, widget and system tray |
| `apps/api` | API, authentication, SQLite, reports and integrations |
| `packages/domain` | Duration calculations and report calendar |
| `packages/contracts` | Shared API types |
| `packages/ui` | EN/FR/DE React UI, local storage and sync queue |
| `brand` | Logos, icons, open fonts, colours and brand guidelines |
| `infra`, `.github` | Deployment, backups and continuous integration |
| `site-presentation` | English and French product website |
| `video` | Presentation and tutorial video sources |

GitHub’s main README, contribution instructions, security reporting guidance, issue/PR templates and workflow labels use **English first**. User guides are available in all three interface languages. Detailed technical documents are currently mostly in French and are identified as such when linked here.

[Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [Changelog](CHANGELOG.md) · [Subcategories](docs/SUBCATEGORIES.md) · [English user guide](docs/guide/en/README.md)

Technical references in French: [Requirements](docs/CAHIER_DES_CHARGES.md) · [Delivered features](docs/ETAT_V0_1.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [API and webhook](docs/API_WEBHOOKS.md) · [Acceptance testing](docs/RECETTE.md) · [GitHub publishing](docs/GITHUB.md) · [Preliminary name check](docs/DISPONIBILITE_NOM.md) · [Brand guidelines](docs/IDENTITE_DE_MARQUE.md).

Code: [AGPL-3.0-or-later](LICENSE). Manrope retains its SIL OFL licence; see [LICENSING.md](LICENSING.md). When operating a modified version over a network, provide users with the corresponding source as required by the licence.
