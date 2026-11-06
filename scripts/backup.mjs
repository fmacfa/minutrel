// SPDX-License-Identifier: AGPL-3.0-or-later
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, copyFile, writeFile, readFile, readdir, chmod, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const data = resolve(option('--data') ?? process.env.APP_DATA_DIR ?? 'data');
const source = option('--restore');
if (source) {
  const archive = resolve(source);
  const metadata = JSON.parse(await readFile(join(archive, 'backup.json'), 'utf8'));
  if (metadata.format !== 'minutrel-backup' || metadata.version !== 1)
    throw new Error('Sauvegarde Minutrel invalide.');
  await mkdir(data, { recursive: true, mode: 0o700 });
  if ((await readdir(data)).length)
    throw new Error('La restauration exige un dossier de données vide et un serveur arrêté.');
  for (const name of ['minutrel.sqlite', 'master.key', 'setup-token']) {
    const file = join(archive, name);
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink())
        throw new Error('Fichier de sauvegarde invalide.');
      await copyFile(file, join(data, name));
      await chmod(join(data, name), 0o600);
    } catch (error) {
      if (error.code !== 'ENOENT' || name === 'minutrel.sqlite') throw error;
    }
  }
  const database = new DatabaseSync(join(data, 'minutrel.sqlite'), { readOnly: true });
  const result = database.prepare('PRAGMA integrity_check').get();
  database.close();
  if (result.integrity_check !== 'ok')
    throw new Error('Le contrôle de la base restaurée a échoué.');
  console.log(`Restauration vérifiée : ${data}`);
} else {
  const output = resolve(
    option('--out') ?? `backups/minutrel-${new Date().toISOString().replaceAll(':', '-')}`,
  );
  await mkdir(output, { recursive: false, mode: 0o700 }).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    const { dirname } = await import('node:path');
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await mkdir(output, { mode: 0o700 });
  });
  const database = new DatabaseSync(join(data, 'minutrel.sqlite'), { readOnly: true });
  try {
    await backup(database, join(output, 'minutrel.sqlite'));
  } finally {
    database.close();
  }
  await chmod(join(output, 'minutrel.sqlite'), 0o600);
  if (process.env.APP_MASTER_KEY)
    await writeFile(join(output, 'master.key'), process.env.APP_MASTER_KEY, { mode: 0o600 });
  else {
    try {
      await copyFile(join(data, 'master.key'), join(output, 'master.key'));
      await chmod(join(output, 'master.key'), 0o600);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  try {
    await copyFile(join(data, 'setup-token'), join(output, 'setup-token'));
    await chmod(join(output, 'setup-token'), 0o600);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeFile(
    join(output, 'backup.json'),
    `${JSON.stringify({ format: 'minutrel-backup', version: 1, appVersion: '0.1.0', createdAt: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(`Sauvegarde SQLite cohérente : ${output}`);
}
