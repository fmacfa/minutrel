# Self-host Minutrel V0.1

One instance hosts one team workspace and a shared SQLite database. The web and desktop clients require no commercial service. Docker Compose is the shortest installation route; Node.js 24 can also run the server directly.

## Docker Compose

Download and extract the source archive from **Resources → Downloads**. Open a terminal in the folder containing `compose.yml` and `package.json`. Install Docker with Compose, then run:

```sh
cp .env.example .env
docker compose up -d --build
docker compose exec minutrel cat /app/data/setup-token
```

Open `http://127.0.0.1:8080`, enter the displayed setup secret and create the workspace and its first administrator. The secret can no longer create an account after initial setup. Administrators create subsequent accounts in **Team**. There is no default password.

The [Compose file](../compose.yml) builds a single application serving the interface, API and MCP. It runs without privileges, with a read-only container root, a persistent `/app/data` volume, a `/backups` volume and a bounded temporary folder. The data volume contains SQLite, its journal and the encryption key. Keep it during updates.

Backups in the Docker volume still live on the Docker host. Follow the [backup procedure](../infra/backup/README.md) to copy them elsewhere.

## An HTTPS address for your team

Place an HTTPS proxy in front of the app. For example, with Caddy on the host:

```caddyfile
time.your-team.example {
    reverse_proxy 127.0.0.1:8080
}
```

Set these values in `.env`, using your actual domain:

```dotenv
APP_PUBLIC_URL=https://time.your-team.example
APP_SECURE_COOKIES=true
```

Apply the configuration:

```sh
docker compose up -d
```

Keep the public `Host` header and forward `/api/`, `/mcp` and `/hooks/`. SSE needs buffering disabled and a long read timeout. A sample [nginx configuration](../infra/docker/nginx.conf) is included.

Members open the HTTPS address in their browser and enter that same address in the desktop app. The native client accepts HTTP only for `localhost`, `127.0.0.1` or `::1`; remote instances require HTTPS and a certificate recognised by the operating system.

If the proxy is containerised, attach it to the application network and use `minutrel:8081`. The default published bind address is `127.0.0.1`; `MINUTREL_BIND_ADDR` changes it explicitly. A proxy may make direct publication of the app port unnecessary.

## Configuration

| Variable | Purpose |
| --- | --- |
| `APP_PUBLIC_URL` | Exact public origin allowed for browser writes |
| `APP_SECURE_COOKIES` | `true` behind HTTPS; `false` only for a local HTTP trial |
| `APP_DATA_DIR` | Persistent folder; fixed to `/app/data` in the image |
| `APP_SETUP_TOKEN` | Optional operator-supplied replacement for the generated initial secret |
| `APP_MASTER_KEY` | 32-byte base64url key; otherwise generated in `master.key` |
| `APP_AI_ALLOWED_HOSTS` | Exact hostnames allowed to receive AI requests |
| `APP_HOST`, `APP_PORT` | Node listen address; `127.0.0.1:8081` outside Docker |
| `APP_WEB_DIR` | Built interface folder; detected automatically in the repository |
| `MINUTREL_PORT` | Published Compose port; `8080` by default |

Compose reads `.env`. Direct Node launches do not load it automatically: export the required variables in the process environment.

## Without Docker

Install Node.js **24**, then run from the extracted source folder:

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open `http://127.0.0.1:8081`. The server creates `data/` at the project root, including `data/setup-token` for initial setup. The same HTTPS and backup procedures apply. `APP_PUBLIC_URL`, when set, must match the browser address.

Only one server process may use an instance’s SQLite folder. V0.1 supports neither multiple server replicas nor a database on a network share.

## Optional AI providers

Timers and reports need no AI provider. An administrator can configure a provider in **Connections** with its `/v1` base URL, model and optional key. Add its exact hostname to `APP_AI_ALLOWED_HOSTS` before enabling it. The example configuration includes `ollama`, `vllm` and `api.anthropic.com`.

Inside a container, `localhost` refers to that container. Connect the provider to the appropriate network or use an explicitly allowed server address. Keys stay on the server; models run at your chosen provider. See [integrations](INTEGRATIONS_IA.md).

## Updates and restoration

Back up the database and key before rebuilding with a new version. Keep the Compose volumes. `docker compose down` stops the services; `docker compose down --volumes` removes their volumes and is not an update procedure.

Check `/api/v1/health/live` and `/api/v1/health/ready`, then verify sign-in and a report. To roll back, restore a compatible backup into an empty folder. A database marked as newer than the running software is rejected at startup.

Desktop packages in V0.1 are unsigned test packages. Signing, notarisation and automatic updates remain future work. Read the [version scope](ETAT_V0_1.md) and [documented validation](VALIDATION_CI.md).
