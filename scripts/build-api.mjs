import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: ['apps/api/src/server.ts'],
  outfile: 'apps/api/dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  external: [],
  plugins: [
    {
      name: 'workspace',
      setup(b) {
        b.onResolve({ filter: /^@minutrel\// }, (args) => ({
          path: fileURLToPath(
            new URL(
              `../packages/${args.path.split('/')[1]}/src/${args.path.endsWith('/reports') ? 'reports/index' : 'index'}.ts`,
              import.meta.url,
            ),
          ),
        }));
      },
    },
  ],
  sourcemap: true,
});
await mkdir('apps/api/dist/assets', { recursive: true });
for (const font of ['Manrope-Regular.ttf', 'Manrope-ExtraBold.ttf'])
  await copyFile(`brand/fonts/${font}`, `apps/api/dist/assets/${font}`);
await copyFile('brand/fonts/OFL.txt', 'apps/api/dist/assets/Manrope-OFL.txt');
