import './guard-directory-reads.cjs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
const require = createRequire(import.meta.url),
  { bundle } = require('@remotion/bundler'),
  { getCompositions, renderStill, renderMedia, openBrowser } = require('@remotion/renderer');
const catalog = JSON.parse(await readFile('src/series/catalog.json', 'utf8')),
  ids = process.argv
    .slice(2)
    .filter((x) => /^\d+$/.test(x))
    .map(Number),
  selected = catalog.filter((f) => f.ready && (!ids.length || ids.includes(f.id)));
if (ids.some((id) => !selected.some((f) => f.id === id)))
  throw new Error('Selected video not ready');
const serveUrl = await bundle({
  entryPoint: resolve('src/index.tsx'),
  outDir: resolve(`.cache/bundle-series-${selected.map((f) => f.id).join('-')}`),
  webpackOverride: (config) => ({ ...config, cache: false }),
});
await mkdir('out/series-en/qa', { recursive: true });
const browser = await openBrowser('chrome', {
  logLevel: 'error',
  browserExecutable: require('playwright').chromium.executablePath(),
});
try {
  const comps = await getCompositions(serveUrl, {
    puppeteerInstance: browser,
    logLevel: 'error',
    onBrowserLog: (log) => console.log('Browser:', log.text),
  });
  for (const film of selected) {
    const composition = comps.find((c) => c.id === film.composition);
    if (!composition) throw new Error('Missing composition ' + film.id);
    const prefix = String(film.id).padStart(2, '0');
    if (process.argv.includes('--stills')) {
      for (const scene of film.scenes) {
        const second = scene.at + (scene.key === 'intro' ? 1.5 : scene.length * 0.63),
          frame = Math.min(composition.durationInFrames - 1, Math.round(second * 30));
        await renderStill({
          serveUrl,
          composition,
          frame,
          output: resolve(`out/series-en/qa/${prefix}-${scene.key}.png`),
          puppeteerInstance: browser,
          imageFormat: 'png',
          logLevel: 'error',
        });
      }
      console.log('QA stills ready', prefix, film.shortTitle);
    }
    if (process.argv.includes('--videos')) {
      const file = resolve(`out/series-en/minutrel-${prefix}-${film.slug}.mp4`);
      let exists = false;
      try {
        await access(file);
        exists = true;
      } catch {}
      if (exists && !process.argv.includes('--force')) {
        console.log('Existing video kept', prefix);
        continue;
      }
      let last = -1;
      await renderMedia({
        serveUrl,
        composition,
        outputLocation: file,
        codec: 'h264',
        crf: 18,
        audioCodec: 'aac',
        audioBitrate: '192k',
        muted: false,
        concurrency: 2,
        puppeteerInstance: browser,
        logLevel: 'error',
        onProgress: (p) => {
          const pct = Math.floor(p.progress * 5);
          if (pct > last) {
            last = pct;
            console.log(`${prefix} ${film.shortTitle}: ${pct * 20}%`);
          }
        },
      });
      console.log('RENDERED', prefix, film.total.toFixed(2), file);
      await writeFile(
        `out/series-en/${prefix}-render.json`,
        JSON.stringify(
          {
            composition: film.composition,
            seconds: film.total,
            file,
            voice: film.voice,
            scenes: film.scenes.map((s) => ({
              key: s.key,
              at: s.at,
              length: s.length,
              visual: s.visual,
            })),
          },
          null,
          2,
        ),
      );
    }
  }
} finally {
  await browser.close({ silent: true });
}
