import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { bundle } = require('@remotion/bundler');
const { getCompositions, renderStill, renderMedia, openBrowser } = require('@remotion/renderer');
const timing = JSON.parse(await readFile('src/timing-en-v2.json', 'utf8'));
const serveUrl = await bundle({
  entryPoint: resolve('src/index.tsx'),
  outDir: resolve('.cache/bundle-en-v2'),
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
      duration: c.durationInFrames / c.fps,
      width: c.width,
      height: c.height,
      fps: c.fps,
    })),
  );
  if (process.argv.includes('--stills')) {
    await mkdir('out/qa-en-v2', { recursive: true });
    const checks = {
      MinutrelPresentationEN: [
        0, 0.5, 2.5, 3.9, 4.2, 6.2, 8.9, 9.2, 11.5, 13.9, 14.2, 16.5, 20.8, 21.2, 23.5, 25.95,
      ],
      MinutrelTutorialEN: [
        0,
        2,
        6,
        ...[
          'Projects',
          'Choose',
          'Describe',
          'Start',
          'Pause',
          'Resume',
          'Finish',
          'History',
          'Manual',
          'Duration',
          'SaveTime',
          'NoteText',
          'Share',
          'Reports',
          'Period',
          'Export',
        ].map((k) => timing.intro + timing.markers[k] + 1.4),
        timing.intro + timing.duration + 2,
        timing.total - 0.1,
      ],
    };
    for (const composition of compositions)
      for (const seconds of checks[composition.id]) {
        const frame = Math.min(composition.durationInFrames - 1, Math.round(seconds * 30));
        await renderStill({
          serveUrl,
          composition,
          frame,
          output: resolve(`out/qa-en-v2/${composition.id}-${String(frame).padStart(5, '0')}.png`),
          puppeteerInstance: browser,
          imageFormat: 'png',
          logLevel: 'error',
        });
        console.log('Still', composition.id, frame);
      }
    await writeFile('out/qa-en-v2/manifest.json', JSON.stringify(checks, null, 2));
  }
  if (process.argv.includes('--videos'))
    for (const composition of compositions) {
      const name = composition.id === 'MinutrelPresentationEN' ? 'presentation' : 'tutorial';
      let last = -1;
      await renderMedia({
        serveUrl,
        composition,
        outputLocation: resolve(`out/minutrel-${name}-en-v2.mp4`),
        codec: 'h264',
        crf: 18,
        muted: false,
        audioCodec: 'aac',
        audioBitrate: '192k',
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
      console.log('Rendered', name);
    }
} finally {
  await browser.close({ silent: true });
}
