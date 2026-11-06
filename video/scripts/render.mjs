import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { bundle } = require('@remotion/bundler');
const { getCompositions, renderStill, renderMedia, openBrowser } = require('@remotion/renderer');
const timing = JSON.parse(await readFile('src/timing.json', 'utf8'));
const serveUrl = await bundle({
  entryPoint: resolve('src/index.tsx'),
  outDir: resolve('.cache/bundle'),
  webpackOverride: (config) => config,
});
const browser = await openBrowser('chrome', { logLevel: 'error' });
try {
  const compositions = await getCompositions(serveUrl, {
    puppeteerInstance: browser,
    logLevel: 'error',
  });
  console.log(
    compositions.map((c) => ({
      id: c.id,
      width: c.width,
      height: c.height,
      fps: c.fps,
      duration: c.durationInFrames / c.fps,
    })),
  );
  if (process.argv.includes('--stills')) {
    await mkdir('out/qa', { recursive: true });
    const checks = {
      MinutrelPresentation: [0, 1.5, 5.5, 8, 12.5, 14, 17.5, 22, 27.5, 30, 34.5, 37, 39.9],
      MinutrelFonctionnement: [
        0,
        3,
        8,
        10.5,
        ...[
          'Projets',
          'Description',
          'Demarrer',
          'Pause',
          'Reprendre',
          'Terminer',
          'Historique',
          'Duree',
          'SauverManuel',
          'TexteNote',
          'Partager',
          'SauverNote',
          'Rapports',
          'Export',
        ].map((k) => 10 + timing.markers[k] + 1.5),
        10 + timing.duration + 1.5,
        16 + timing.duration,
      ],
    };
    for (const composition of compositions)
      for (const seconds of checks[composition.id]) {
        if (
          process.argv.includes('--reports-only') &&
          !(composition.id === 'MinutrelPresentation' && seconds >= 17 && seconds < 27) &&
          !(composition.id === 'MinutrelFonctionnement' && seconds > 107 && seconds < 131)
        )
          continue;
        const frame = Math.min(composition.durationInFrames - 1, Math.round(seconds * 30));
        const output = resolve(`out/qa/${composition.id}-${String(frame).padStart(5, '0')}.png`);
        await renderStill({
          serveUrl,
          composition,
          output,
          frame,
          puppeteerInstance: browser,
          imageFormat: 'png',
          logLevel: 'error',
        });
        console.log('Still', composition.id, frame);
      }
    await writeFile('out/qa/manifest.json', JSON.stringify(checks, null, 2));
  }
  if (process.argv.includes('--videos')) {
    for (const composition of compositions) {
      const outputLocation = resolve(
        `out/${composition.id === 'MinutrelPresentation' ? 'minutrel-presentation' : 'minutrel-fonctionnement'}.mp4`,
      );
      let last = -1;
      await renderMedia({
        serveUrl,
        composition,
        outputLocation,
        codec: 'h264',
        crf: 18,
        muted: true,
        concurrency: 2,
        puppeteerInstance: browser,
        logLevel: 'error',
        onProgress: (p) => {
          const pct = Math.floor(p.progress * 10);
          if (pct > last) {
            last = pct;
            console.log(`${composition.id}: ${pct * 10}%`);
          }
        },
      });
      console.log('Rendered', outputLocation);
    }
  }
} finally {
  await browser.close({ silent: true });
}
