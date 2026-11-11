import '../guard-directory-reads.cjs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir, readFile, access } from 'node:fs/promises';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { bundle } = require('@remotion/bundler');
const { getCompositions, openBrowser, renderStill, renderMedia } = require('@remotion/renderer');
const all = JSON.parse(await readFile('src/updates/catalog.json', 'utf8'));
const args = process.argv.slice(2);
const ids = args.filter((arg) => /^1[3-6]$/.test(arg)).map(Number);
const films = all.filter((f) => !ids.length || ids.includes(f.id));
const output = 'out/updates-en';
if (films.length !== (ids.length || 4)) throw new Error('Run the update timeline builder first');
await mkdir(`${output}/qa`, { recursive: true });
const serveUrl = await bundle({
  entryPoint: resolve('src/index.tsx'),
  outDir: resolve('.cache/bundle-updates-en'),
  webpackOverride: (config) => ({ ...config, cache: false }),
});
const browser = await openBrowser('chrome', {
  browserExecutable: chromium.executablePath(),
  logLevel: 'error',
});
try {
  const comps = await getCompositions(serveUrl, { puppeteerInstance: browser, logLevel: 'error' });
  for (const film of films) {
    const composition = comps.find((c) => c.id === film.composition);
    if (!composition || composition.durationInFrames !== film.durationInFrames)
      throw new Error(`Missing composition ${film.composition}`);
    if (args.includes('--stills')) {
      for (const scene of film.scenes) {
        const samples =
          scene.layout === 'cover'
            ? [['cover', 0.48]]
            : [
                ['start', 0.12],
                ['action', 0.53],
                ['result', 0.91],
              ];
        for (const [label, progress] of samples) {
          await renderStill({
            serveUrl,
            composition,
            frame: scene.atFrame + Math.floor(scene.length * progress),
            output: resolve(`${output}/qa/${film.id}-${scene.key}-${label}.png`),
            puppeteerInstance: browser,
            imageFormat: 'png',
            logLevel: 'error',
          });
        }
      }
      console.log(`Review stills ready: ${film.composition}`);
      continue;
    }
    const path = resolve(`${output}/minutrel-${film.id}-${film.slug}.mp4`);
    if (
      !args.includes('--force') &&
      (await access(path).then(
        () => true,
        () => false,
      ))
    ) {
      console.log(`Existing render kept: ${film.id}`);
      continue;
    }
    let last = -1;
    await renderMedia({
      serveUrl,
      composition,
      outputLocation: path,
      codec: 'h264',
      crf: 18,
      pixelFormat: 'yuv420p',
      audioCodec: 'aac',
      audioBitrate: '192k',
      muted: false,
      concurrency: 4,
      puppeteerInstance: browser,
      logLevel: 'error',
      onProgress: ({ progress }) => {
        const phase = Math.floor(progress * 5);
        if (phase > last) {
          last = phase;
          console.log(`${film.id} ${film.shortTitle}: ${20 * phase}%`);
        }
      },
    });
    console.log(`Rendered ${film.composition}: ${film.total.toFixed(2)} s`);
  }
} finally {
  await browser.close({ silent: true });
}
