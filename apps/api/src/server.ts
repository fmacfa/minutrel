// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from './app.ts';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const app = createApp({ logLevel: 'warn' });
const webRoot = resolve(
  process.env.APP_WEB_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url)),
);
if (existsSync(webRoot))
  app.register(staticFiles, {
    root: webRoot,
    maxAge: '30d',
    immutable: true,
    setHeaders(response, path) {
      response.header(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
      );
      if (path.endsWith('.html')) response.header('Cache-Control', 'no-cache');
    },
  });
const port = Number(process.env.APP_PORT ?? 8081);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new RangeError('APP_PORT doit être compris entre 1 et 65535.');
}
await app.listen({ port, host: process.env.APP_HOST ?? '127.0.0.1' });
console.log(`Minutrel API : ${app.server.address() ? port : 'indisponible'}`);
if (!app.store.get('SELECT 1 FROM workspace'))
  console.log(
    'Premier lancement : utilisez le secret du fichier data/setup-token (ou APP_SETUP_TOKEN) pour créer votre espace.',
  );
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
