// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const bundle = { darwin: 'app,dmg', win32: 'nsis', linux: 'deb' }[process.platform];
if (!bundle) throw new Error('Ce système n’est pas pris en charge.');
const child = spawn(
  process.execPath,
  [
    resolve('node_modules/@tauri-apps/cli/tauri.js'),
    'build',
    '--bundles',
    bundle,
    '--ci',
    ...process.argv.slice(2),
  ],
  { cwd: resolve('apps/desktop'), stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
