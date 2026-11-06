import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'minutrel-notices',
      apply: 'build',
      async closeBundle() {
        const destination = fileURLToPath(new URL('./dist/licenses/', import.meta.url));
        await mkdir(destination, { recursive: true });
        await copyFile(
          fileURLToPath(new URL('../../brand/fonts/OFL.txt', import.meta.url)),
          `${destination}/Manrope-OFL.txt`,
        );
        await copyFile(
          fileURLToPath(new URL('../../LICENSE', import.meta.url)),
          `${destination}/AGPL-3.0-or-later.txt`,
        );
        const workspace = fileURLToPath(new URL('../../', import.meta.url));
        const lock = JSON.parse(await readFile(`${workspace}/package-lock.json`, 'utf8')) as {
          packages: Record<string, { version?: string; license?: string; link?: boolean }>;
        };
        const notices = await Promise.all(
          Object.entries(lock.packages)
            .filter(([name, p]) => name.startsWith('node_modules/') && !p.link)
            .map(async ([name, p]) => {
              const texts = await Promise.allSettled(
                ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'license', 'license.txt', 'LICENCE'].map(
                  (file) => readFile(`${workspace}/${name}/${file}`, 'utf8'),
                ),
              );
              const found = texts.find(
                (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled',
              );
              return `${name.replace(/^node_modules\//, '')} ${p.version ?? ''} · ${p.license ?? 'see package metadata'}\n${found?.value ?? 'See the package distribution for its complete notices.'}`;
            }),
        );
        await writeFile(
          `${destination}/THIRD-PARTY-NOTICES.txt`,
          notices.join('\n\n--------------------\n\n'),
        );
      },
    },
  ],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8081', changeOrigin: false },
      '/mcp': { target: 'http://127.0.0.1:8081', changeOrigin: false },
      '/hooks': { target: 'http://127.0.0.1:8081', changeOrigin: false },
    },
  },
});
