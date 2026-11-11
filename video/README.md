# Minutrel — English videos, version 2

## November 2026 development guides

The four new guides show the development preview at `0001df2`. They use live recordings of the real English application on an isolated loopback server, with fictional names, projects, rates and hours. Each master is 1920 × 1080 (16:9) at 30 fps, H.264 with stereo AAC, English Kokoro `af_heart` narration and the original tutorial score. English captions are visible in the videos and supplied as separate SRT files.

| Guide | Composition | MP4 in `out/updates-en/` |
| --- | --- | --- |
| 13 · Custom subcategories | `MinutrelCustomSubcategoriesEN` | `minutrel-13-custom-subcategories.mp4` |
| 14 · Project budgets and actions | `MinutrelProjectPlanningEN` | `minutrel-14-project-planning.mp4` |
| 15 · Gantt, workload and rates | `MinutrelGanttWorkloadEN` | `minutrel-15-gantt-workload-rates.mp4` |
| 16 · Weekly timesheets | `MinutrelWeeklyTimesheetsEN` | `minutrel-16-weekly-timesheets.mp4` |

From the repository root, using Node.js 24:

```sh
minutrel_capture_source=$(mktemp -d)
git archive 0001df2 | tar -x -C "$minutrel_capture_source"
(cd "$minutrel_capture_source" && npm ci --ignore-scripts && npm run build:web)
cd video
npm ci --workspaces=false
npx playwright install chromium
mkdir -p public/brand public/fonts
cp ../brand/assets/logos/minutrel-primary.svg ../brand/assets/logos/minutrel-reverse.svg public/brand/
cp ../brand/fonts/Manrope-Regular.ttf ../brand/fonts/Manrope-SemiBold.ttf ../brand/fonts/Manrope-ExtraBold.ttf ../brand/fonts/OFL.txt public/fonts/
python3 scripts/generate-score-en-v2.py
node scripts/updates/audio.mjs
node scripts/updates/record.mjs --snapshot "$minutrel_capture_source"
node scripts/updates/record.mjs --snapshot "$minutrel_capture_source" --record
node scripts/updates/timeline.mjs
npm run typecheck
node scripts/updates/render.mjs --stills
```

Inspect `out/updates-en/qa/`, then render, verify and package:

```sh
node scripts/updates/render.mjs
node scripts/verify-series.mjs --updates
node scripts/sample-series.mjs --updates
node scripts/updates/package.mjs
```

The recorder checks the live UI before rendering. Demo data and random session credentials stay in memory. It validates the saved subcategory, budget, action link and rate, then downloads a real approved-only CSV and checks that draft time is excluded. `scripts/updates/story.mjs` holds the English script; `src/UpdatesFilm.tsx` controls the layout. The package includes a local player (`index.html`), posters, captions and draft English publication metadata (`publication.json`).

## Introduction and first steps

The current delivery follows the revised brief: a faster explanation of the product, and an English walkthrough with narration and background music.

| Composition              | Output                                | Duration           | Format                    |
| ------------------------ | ------------------------------------- | ------------------ | ------------------------- |
| `MinutrelPresentationEN` | `out/minutrel-presentation-en-v2.mp4` | 26 seconds         | 1920 × 1080, 16:9, 30 fps |
| `MinutrelTutorialEN`     | `out/minutrel-tutorial-en-v2.mp4`     | 2 minutes 1 second | 1920 × 1080, 16:9, 30 fps |

Both videos use H.264 video and AAC stereo audio. They include English narration, original background music and English on-screen text. Matching English `.srt` subtitle files are in `out/`. The earlier French exports are preserved.

## Creative direction

The presentation defines Minutrel immediately: **open-source time tracking, by project**. Five short scenes explain time tracking, work context, reports, independent use on a computer and team use on a self-hosted server. Large type, simple graphics, quick entrances and a 120 BPM score provide the pace. It contains no website footage, browser frames or application screenshots.

The tutorial is a fresh recording of the English application with English fictional projects, descriptions, notes and summaries. It follows Atlas through selecting a project, starting/pausing/resuming/finishing a timer, reviewing time entries, adding a manual duration, sharing a note and exporting a PDF. The opening identifies the demo as an administrator account; collective export permissions are explained.

## Sound

- Narration: local Kokoro speech synthesis, voice `af_heart`, with separate clips aligned to each action. This is a synthetic English voice.
- Presentation music: an original procedural score at 120 BPM.
- Tutorial music: an original procedural score at 96 BPM.
- Music volume drops under speech and fades at the beginning and end. The two sound sources remain separate in the Remotion project.
- The score uses generated tones and percussion, with no third-party music recording, commercial sample or borrowed melody.

The [Kokoro model card](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) lists the model under Apache 2.0. Logos and the application icon come from the existing Minutrel brand assets. Manrope keeps its SIL OFL license in `public/fonts/OFL.txt`. Dependencies retain their own licenses.

## Reproduce

Prerequisites: Node.js 24; the application dependencies and built web app; Python 3 with NumPy for the original music generator.

From `video/`:

```sh
npm ci --workspaces=false
npx remotion browser ensure
npx playwright install chromium
node scripts/synthesize-en-v2.mjs
python3 scripts/generate-score-en-v2.py
```

Speech inference runs locally. The first run downloads public model weights into `.cache/kokoro-models`; no project data is sent to a speech service.

From the application root, start the dedicated fictional demo:

```sh
node video/scripts/prepare-demo-en-v2.mjs
```

It listens at `http://127.0.0.1:8086` and uses only `.cache/video-demo-en-v2-2026-11-06`. It prepares an English browser session in `video/.cache/session-en-v2.json`; this session is excluded from version control and from the rendered media. It also copies the required brand assets and local fonts.

In another terminal, from `video/`:

```sh
node scripts/configure-capture-en-v2.mjs
node scripts/capture-site.mjs --config capture.en-v2.config.json --validate
node scripts/capture-site.mjs --config capture.en-v2.config.json
node scripts/build-timeline-en-v2.mjs
npm run typecheck
node scripts/render-en-v2.mjs --stills
```

Reinspect live selectors before a new capture. The runner refuses to overwrite an existing recording or screenshot. Archive the generated files named in the capture configuration before making another take; actions add real entries to the isolated fictional demo. The runner supports deliberate `type` and `select` actions as well as the original capture actions.

Inspect `out/qa-en-v2/`, then render:

```sh
node scripts/render-en-v2.mjs --videos
```

Equivalent individual render commands:

```sh
npm run render:presentation
npm run render:fonctionnement
```

The render works from bundled captures, fonts and audio without the application server. `npm run studio` opens the editable compositions.

## Verification

```sh
npm run verify
node scripts/sample-en-v2.mjs
```

Verification checks dimensions, frame rate, duration, H.264, AAC stereo and full video decoding. It decodes the final sound, checks signal levels and clipping, detects music in narration gaps, and compares every narration clip against its expected position in the exported mix. Results are saved in `out/verification-en-v2.json`. Final MP4 samples are saved under `out/qa-en-v2/final-*` for visual inspection.

## Edit the videos

- `src/PresentationEN.tsx`: the five graphic presentation scenes and their timing.
- `src/TutorialEN.tsx`: the tutorial, English headings and capture framing.
- `src/DesignEN.tsx`: shared colors, typography, logos, icons and entrance animations.
- `src/AudioEN.tsx`: narration playback, music level, ducking and fades.
- `scripts/story-en-v2.mjs`: the English spoken script and presentation cue positions.
- `scripts/generate-score-en-v2.py`: the original music arrangement and instruments.
- `capture.en-v2.config.json`: the recorded English interaction sequence.
- `src/voice-en-v2.json`: generated voice asset metadata.
- `src/timing-en-v2.json`: capture markers and the synchronized narration timeline.

The English 16:9 compositions are registered in `src/Root.tsx`. No unverified public website or download URL is included in the end card.

## The ten additional English guides

All ten use English interface text, English fictional examples, synthetic English narration, the original 96 BPM music and English captions. They are exported to `out/series-en/` as Full HD H.264 MP4 with AAC stereo sound. SRT and WebVTT files accompany the delivery.

| No. | Composition                | Subject                                                   | Approximate duration |
| --- | -------------------------- | --------------------------------------------------------- | -------------------- |
| 03  | `MinutrelMiniTimerEN`      | Mini timer: open, pause, resume and finish                | 43 s                 |
| 04  | `MinutrelSoloEN`           | Personal workspace, projects, time and local copy         | 52 s                 |
| 05  | `MinutrelTeamEN`           | Accounts, roles, project assignments and connection       | 1 min                |
| 06  | `MinutrelTimeEntriesEN`    | Manual durations and corrections with a reason            | 57 s                 |
| 07  | `MinutrelMonthlyReportsEN` | Monthly totals, people, context and exports               | 57 s                 |
| 08  | `MinutrelWorkJournalEN`    | Private notes, sharing, drafts and approval               | 53 s                 |
| 09  | `MinutrelOfflineEN`        | Real server interruption, local queue and synchronisation | 57 s                 |
| 10  | `MinutrelTransferEN`       | Map personal projects and transfer completed time         | 1 min                |
| 11  | `MinutrelAssistantsEN`     | Personal MCP permissions, configuration and revocation    | 1 min 20 s           |
| 12  | `MinutrelSelfHostEN`       | Node.js installation, setup, HTTPS and backups            | 2 min 18 s           |

The browser chapters use real Playwright recordings. Desktop chapters use a sequence of real screenshots from a separate Tauri demonstration application, with graphic framing and narration; they are not continuous screen recordings. Native mini-timer, offline queue and personal transfer actions were performed in that separate application. No production Minutrel data or settings were used.

The offline chapter disables only a loopback proxy for the fictional demonstration server. The operating system network stays connected. The transfer chapter copies three completed personal entries into that demonstration team and checks the saved result. The assistant chapter creates and revokes a demonstration token; secret fields are hidden in recordings. The optional AI provider form is shown without saving a provider or sending notes to an AI service.

The installation chapter mixes documented project commands with a genuine first-run workspace setup and a test project/timer/report. Its public HTTPS address and reverse proxy block are examples, rather than a deployed public service.

### Rebuild this series

```sh
# From the application root, keep this process running:
node video/scripts/prepare-series.mjs

# From video/, prepare narration and capture the browser chapters:
node scripts/synthesize-series.mjs
node scripts/capture-series-web.mjs 5 6 7 8 11
node scripts/capture-install.mjs

# After capturing the native screenshots named in build-series.mjs:
node scripts/build-series.mjs
npm run typecheck
node scripts/render-series.mjs --stills
# Inspect out/series-en/qa/ before rendering:
node scripts/render-series.mjs --videos
node scripts/verify-series.mjs
node scripts/sample-series.mjs
node scripts/package-series.mjs
```

Capture scripts keep existing recordings. To retake a chapter, archive its generated `.webm` and `.json` first and reset the relevant fictional records as needed. The native screenshot names are mapped in `scripts/build-series.mjs`; capture them from an isolated English desktop workspace. `video/.cache/` and the root `.cache/video-series-*` folders contain temporary development data and authentication state, and are excluded from the delivery.

Rendering uses the installed Playwright Chromium build because the cached Remotion browser in this environment does not complete root initialisation. The render script also prevents directory paths from being read as files on this macOS setup and disables Webpack's persistent cache. Neither workaround alters the application or the exported video content.

The editable script is `scripts/story-series.mjs`; generated voice metadata is `src/series/voices.json`. `src/series/catalog.json` combines speech timing, real capture markers, native stills and chapter framing. `src/SeriesFilm.tsx` contains the shared layouts. Numeric chapter arguments select a subset of guides for rendering, verification or final sampling. Use `--force` to replace an existing MP4.

`scripts/finish-series.mjs` can validate and sample each MP4 as a long render completes. Verification checks every frame can decode, format and duration, music presence, clipping and the alignment of every voice clip. Results are in `out/series-en/verification.json`; final MP4 sample frames are in `out/series-en/qa-final/`. `index.html` is an offline player for the delivered ten videos. The ZIP contains only the finished media, subtitles, posters, player and public delivery metadata.
