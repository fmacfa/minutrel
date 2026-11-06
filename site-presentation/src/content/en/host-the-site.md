# Run this presentation website locally

These instructions concern the presentation website you are reading. To install the time-tracking application, use [Minutrel self-hosting](../docs/AUTOHEBERGEMENT.md).

The website contains static HTML, CSS, JavaScript, screenshots, guides and downloads. Both the French and English versions work locally, with no account, database, translation service or remote font required. The demo timer sends no data.

## Open the files directly

Extract **Standalone presentation website** from Resources. Open `minutrel-site/index.html` for French or `minutrel-site/en/index.html` for English. The **FR / EN** selector changes language while staying on the corresponding page.

The search index is included as a local JavaScript file. Search, feature filters, the timer demo and screenshot enlargement also work when opening the files directly, without an HTTP server. Clipboard copying depends on browser permissions; if unavailable, the page selects the command so you can copy it manually.

## Start a local server

In the editable project folder, double-click **Ouvrir Minutrel.command** on macOS, or run:

```sh
python3 serve.py
```

The launcher serves the site only on `127.0.0.1` and opens the French home page. Choose **EN** for English. To open English immediately:

```sh
python3 serve.py --language en
```

Stop the server with `Ctrl+C` in its terminal. It creates no system service and needs no sign-in.

For an already exported static website, Python 3 can also serve its folder:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

## Host the static files

Copy the complete site contents to your static host, keeping `en/`, `assets/`, `downloads/` and the local search files. For example with Caddy, using your real domain and path:

```caddyfile
presentation.your-team.example {
    root * /srv/minutrel-site
    file_server
}
```

Apache, nginx and existing static hosts work as well. Links include `.html`; no application routing rewrite is needed. The exported files contain no ChatGPT authentication gate. Configure any desired access restrictions on your own host.

## Check the result

1. Open Home, Features, Guide and Self-hosting.
2. Switch between FR and EN and check the corresponding page.
3. Search for “backup” in English or “sauvegarde” in French and open a result.
4. Try a screenshot, a download and the menu on a small screen.

Inside its own export, the website archive link leads to this guide instead of a missing or recursive download. You can place the original ZIP in `downloads/` if you want to offer it again from your host.

## Edit and rebuild

| File | Purpose |
| --- | --- |
| `src/pages.py` | Presentation layout and French editorial content |
| `src/en.json` | English presentation and interface translations |
| `src/content/en/` | English documentation |
| `src/content/docs/guide/en/README.md` | Illustrated English user guide |
| `src/bilingual.py` | Language routes, matching anchors and English build |
| `src/styles.css`, `src/site.js` | Styling and local interactions |
| `build.py` | Static generation and portable archives |

Run `python3 build.py` to rebuild. To refresh original product documentation first, use `python3 sync-content.py --project-root ..`. The default build is local and does not publish or synchronise sources to a remote service.

Keep the Minutrel licence and the Manrope SIL OFL notice when redistributing. Source technical references and example PDF downloads retain their original language where explicitly labelled.
