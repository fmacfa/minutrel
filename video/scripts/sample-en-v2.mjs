import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const timing = JSON.parse(await readFile('src/timing-en-v2.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
try {
  for (const [name, times] of [
    ['presentation', [0, 0.5, 2, 4.3, 6, 8.9, 9.3, 11, 13.9, 14.3, 17, 20.9, 21.3, 23, 25.95]],
    [
      'tutorial',
      [
        0,
        2,
        6,
        ...[
          'Projects',
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
        ].map((k) => timing.intro + timing.markers[k] + 1.8),
        timing.total - 3,
        timing.total - 0.1,
      ],
    ],
  ]) {
    if (process.argv.includes('--presentation-only') && name === 'tutorial') continue;
    await page.goto(pathToFileURL(resolve(`out/minutrel-${name}-en-v2.mp4`)).href);
    await page.locator('video').waitFor();
    await page.evaluate(async () => {
      const v = document.querySelector('video');
      v.controls = false;
      v.muted = true;
      v.pause();
      Object.assign(v.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '100vw',
        height: '100vh',
        objectFit: 'fill',
        margin: '0',
      });
      if (v.readyState < 2)
        await new Promise((resolve, reject) => {
          v.addEventListener('loadeddata', resolve, { once: true });
          v.addEventListener('error', reject, { once: true });
        });
    });
    const dir = `out/qa-en-v2/final-${name}`;
    await mkdir(dir, { recursive: true });
    for (const seconds of times) {
      await page.evaluate(async (seconds) => {
        const v = document.querySelector('video');
        if (Math.abs(v.currentTime - seconds) > 0.001) {
          const p = new Promise((resolve) => v.addEventListener('seeked', resolve, { once: true }));
          v.currentTime = seconds;
          await p;
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, seconds);
      await page.screenshot({
        path: `${dir}/frame-${String(Math.round(seconds * 30)).padStart(5, '0')}.png`,
      });
    }
    console.log(`Sampled ${name}: ${times.length} final MP4 frames`);
  }
} finally {
  await browser.close();
}
