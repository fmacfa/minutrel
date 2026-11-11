import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const updates = process.argv.includes('--updates');
const directory = updates ? 'out/updates-en' : 'out/series-en';
const films = JSON.parse(
  await readFile(updates ? 'src/updates/catalog.json' : 'src/series/catalog.json', 'utf8'),
);
const ids = process.argv
  .slice(2)
  .filter((arg) => /^\d+$/.test(arg))
  .map(Number);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
try {
  for (const film of films.filter((f) => !ids.length || ids.includes(f.id))) {
    const name = `minutrel-${String(film.id).padStart(2, '0')}-${film.slug}`;
    const times = [
      0.5,
      ...film.scenes.map((s) =>
        updates
          ? (s.atFrame + Math.floor(s.length * 0.64)) / 30
          : s.at + Math.min(s.length * 0.55, 3),
      ),
      film.total - 0.1,
    ];
    await page.goto(pathToFileURL(resolve(`${directory}/${name}.mp4`)).href);
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
    const dir = `${directory}/qa-final/${name}`;
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
