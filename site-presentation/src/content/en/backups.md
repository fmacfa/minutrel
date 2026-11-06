# Back up and restore Minutrel

The supplied backup script uses Node’s SQLite backup API to produce a consistent copy, even while the server is active in WAL mode. The backup contains `minutrel.sqlite`, `master.key`, the initial setup secret when present and a manifest. The key is needed to recover encrypted provider secrets. The output folder is restricted to its owner.

## Direct Node launch

```sh
npm run backup
```

A dated folder appears under `backups/`. Choose explicit locations with:

```sh
node scripts/backup.mjs --data data --out backups/my-backup
```

If `APP_MASTER_KEY` is set in the environment, that value is included instead of another file key.

## Docker Compose

```sh
docker compose exec -T minutrel node scripts/backup.mjs --out /backups/my-backup
mkdir -p backups
docker compose cp minutrel:/backups/my-backup backups/my-backup
```

Use a new name for each backup. Keep a copy outside the original volume according to your instance’s needs. `/backups` is a local working volume, separate from the database volume.

## Restoration

Stop the server first. The script refuses a non-empty destination and never replaces an existing database:

```sh
node scripts/backup.mjs --restore backups/my-backup --data restored-data
```

The script checks SQLite integrity after copying. Start a compatible Minutrel version with `APP_DATA_DIR` pointing to the restored folder. For Docker, prepare an empty volume, copy the restored files with the `node` user’s permissions (UID 1000), then mount it on `/app/data`.

The public address, HTTPS proxy and provider hostnames remain external deployment configuration. Include them in your operational backup procedure.

## Verification and local workspaces

The persistence test exercises a timer across a restart, a live database backup, restoration, duration recovery and decryption of a fictional secret. The app’s shared-work JSON export is a portability format; full V0.1 server restoration uses SQLite backups.

For standalone desktop work, quit the app and copy its full configuration folder, including `offline-*.json`, `.bak` and `connection.json`. **Export local copy** also produces JSON, but importing it through the interface is not delivered in V0.1. The [user guide](../../docs/guide/en/README.md) lists the operating system paths.
