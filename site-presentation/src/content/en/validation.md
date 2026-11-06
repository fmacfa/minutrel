# Documented V0.1 validation

These are the project’s recorded local checks from **5–6 November 2026**, on macOS ARM64 using Node.js 24.22.1 and Rust 1.99.1. They are historical product checks, not new test runs caused by opening this website. Container checks from 5 November do not validate all extensions added on 6 November.

## Recorded results

| Check | Recorded observation |
| --- | --- |
| Formatting, ESLint and strict TypeScript | Passed |
| Vitest | 78 tests passed in 10 files |
| Configured business-code coverage | 98.81% lines, 97.84% statements, 94.69% functions, 86.51% branches |
| npm audit | No vulnerabilities reported at that check |
| Web/API builds | Passed; initial JavaScript 112.05 KB gzip; local/PDF engines loaded on demand |
| Rust | Formatting, 2 tests and clippy without warnings passed |
| macOS | ARM64 app and DMG built; DMG integrity checked |
| Standalone use | Server stopped, timer paused, app closed/reopened, pause restored, resumed/finished; 15 seconds transferred to the team |
| Offline team outbox | Server stopped, timer start/pause/finish, 8 seconds queued, automatic send after reconnection, exactly one matching web entry |
| Local export | PDF produced without server; CSV/PDF/ZIP, long text, accents, pagination, seconds and spreadsheet-formula handling tested |
| Languages and layout | French/English/German views captured; app layouts checked at 320, 390, 768 and 1280 px |
| Persistence | Restart, live backup, restoration and key recovery verified |
| MCP | Official HTTP client connected end to end; scopes and revocation tested |
| AI writing | Adapters tested with controlled responses; no paid provider contacted |
| Incoming webhook | Personal scopes, assignment, private note, repeat delivery and revocation tested |
| Reports | CSV/PDF/ZIP compared from the same snapshot; private drafts excluded |
| Docker, 5 November state | API/web images built; account/time/export/SSE/MCP checks behind nginx passed |
| Production Compose, 5 November state | Non-privileged process, read-only root, volumes and backup/restore tried |
| Documentation and branding | Source Markdown links, fixtures and brand assets checked |
| GitHub workflow | Accepted by actionlint; no remote GitHub run was created |

Coverage figures apply to the configured domain/server business modules. Other client tests are included in the 78 tests without being part of those thresholds. This is not an exhaustive accessibility audit or validation of every gesture on every system.

## Checked macOS package

`Minutrel_0.1.0_aarch64.dmg`: **5,947,932 bytes**.

```text
d3c6a61d6646674bf1af15a9cc4b4bf8fb4430a2d28ebfbdf0a97eec4577c585
```

This is an unsigned, unnotarised local test package for ARM64 Macs. The unpacked app is approximately 16 MiB and the DMG approximately 5.67 MiB. Other targets require their own builds.

## One-off container observation

On 5 November, in an isolated Linux ARM64 VM with 2 vCPUs and 3 GiB RAM, a small-data test recorded 59.25 MiB and 0.05% CPU for the production container, limited to 768 MiB, without AI. The separate nginx variant used about 3.5 MiB. This was a point-in-time observation of the 5 November state, not a peak measurement or a load campaign for later extensions.

Targets of 50 accounts, 20 concurrent users, 500 projects and 100,000 entries remain to be tested. Native/WebView memory and resource consumption across all operating systems also remain to be measured.

## Still to validate elsewhere

Run the prepared Windows/Linux build matrices remotely, complete field testing, rebuild the containers for the same final commit, and validate signing, automatic updates, real AI models, independent security review, load and restoration on another desktop. See the [version scope](ETAT_V0_1.md).
