import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import staticFiles from '@fastify/static';
import { createApp } from '../../apps/api/src/app.ts';
const { chromium } = createRequire(import.meta.url)('playwright');
const output = 'public/captures/series-en/12.webm';
try {
  await access(output);
  console.log('Existing installation capture kept');
  process.exit(0);
} catch {}
process.env.APP_DATA_DIR = resolve('../.cache/video-series-install-en-2026-11-06');
await mkdir(process.env.APP_DATA_DIR, { recursive: true, mode: 0o700 });
const app = createApp();
app.register(staticFiles, { root: resolve('../apps/web/dist') });
await app.listen({ host: '127.0.0.1', port: 8096 });
const password = 'Demo-' + randomBytes(24).toString('base64url');
const film = JSON.parse(await readFile('src/series/voices.json', 'utf8')).find((f) => f.id === 12);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: '.cache/series-recordings', size: { width: 1440, height: 900 } },
  locale: 'en-GB',
  timezoneId: 'Europe/Paris',
  reducedMotion: 'reduce',
});
await context.addInitScript(() => {
  localStorage.setItem('minutrel-language', 'en');
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent =
      '*{cursor:none!important}input[type=password]{visibility:hidden!important}input,textarea{caret-color:transparent!important}#__filmCursor{position:fixed;z-index:2147483647;pointer-events:none;width:24px;height:30px;left:30px;top:850px;filter:drop-shadow(0 1px 2px #142c38aa)}';
    document.head.append(style);
    const c = document.createElement('div');
    c.id = '__filmCursor';
    c.innerHTML =
      '<svg viewBox="0 0 24 30"><path d="M3 1 21 19 12 19 8 28Z" fill="white" stroke="#142c38" stroke-width="1.4"/></svg>';
    document.body.append(c);
    addEventListener('mousemove', (e) => {
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
    });
  });
});
const recordingStart = Date.now(),
  page = await context.newPage(),
  recording = page.video();
page.setDefaultTimeout(10000);
const b = (n) => page.getByRole('button', { name: n, exact: true });
let mouse = { x: 30, y: 850 };
const move = async (l) => {
  await l.scrollIntoViewIfNeeded();
  const z = await l.boundingBox();
  if (!z) throw new Error('Invisible capture target');
  const x = z.x + z.width / 2,
    y = z.y + z.height / 2;
  for (let i = 1; i <= 18; i++) {
    const p = 1 - (1 - i / 18) ** 3;
    await page.mouse.move(mouse.x + (x - mouse.x) * p, mouse.y + (y - mouse.y) * p);
    await page.waitForTimeout(18);
  }
  mouse = { x, y };
};
const click = async (l) => {
  await move(l);
  await l.click();
  await page.waitForTimeout(420);
};
const fill = async (l, text) => {
  await move(l);
  await l.fill('');
  await l.pressSequentially(text, { delay: 20 });
};
const secret = async (name, value) =>
  page.locator(`input[name=${name}]`).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
const markers = [];
let contentStart;
const step = async (key, fn) => {
  const s = Date.now();
  markers.push({ key, ms: s - contentStart });
  await fn();
  await page.waitForTimeout(
    Math.max(900, film.steps.find((v) => v.key === key).duration * 1000 + 950 - (Date.now() - s)),
  );
  await page.screenshot({ path: `public/stills/series-en/12-${key}.png` });
  console.log('Captured 12/' + key);
};
try {
  await page.goto('http://127.0.0.1:8096');
  await b('Create my workspace').waitFor();
  contentStart = Date.now();
  await step('setup', async () => {
    await fill(page.locator('input[name=workspace]'), 'Demo Team');
    await fill(page.locator('input[name=name]'), 'Alex Morgan');
    await fill(page.locator('input[name=email]'), 'admin@minutrel.test');
    await secret('password', password);
    await secret('setupToken', app.store.setupToken);
    await page.locator('input[name=timezone]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: 'public/stills/series-en/12-setup-form.png' });
    await click(b('Create my workspace'));
    await b('Projects').waitFor();
  });
  await step('team', async () => {
    await click(b('Team'));
    await page.waitForTimeout(1100);
    await click(b('Add a member'));
    await fill(page.locator('dialog input[name=name]'), 'Jordan Lee');
    await fill(page.locator('dialog input[name=email]'), 'jordan@minutrel.test');
    await secret('password', password);
    await click(page.locator('dialog').getByRole('button', { name: 'Save', exact: true }));
    await click(b('Projects'));
    await click(b('New project'));
    await fill(page.locator('dialog input[name=name]'), 'Atlas');
    await fill(page.locator('dialog textarea[name=description]'), 'First team project');
    await click(page.locator('dialog label.check-row').filter({ hasText: 'Alex Morgan' }));
    await click(page.locator('dialog label.check-row').filter({ hasText: 'Jordan Lee' }));
    await click(page.locator('dialog').getByRole('button', { name: 'Save', exact: true }));
    await click(b('Overview'));
    await fill(
      page.getByRole('textbox', { name: 'Work description', exact: true }),
      'Testing the team workspace',
    );
    await click(b('Start'));
    await page.waitForTimeout(1800);
    await click(b('Finish'));
    await click(b('Reports'));
    await page.waitForTimeout(1300);
  });
  const end = Date.now();
  await context.close();
  await rename(await recording.path(), output);
  await writeFile(
    output.replace('.webm', '.json'),
    JSON.stringify(
      {
        video: output,
        trimStartMs: contentStart - recordingStart,
        usableDurationMs: end - contentStart,
        viewport: { width: 1440, height: 900 },
        markers,
      },
      null,
      2,
    ),
  );
  console.log('Installation capture complete');
} catch (e) {
  await context.close();
  try {
    await rename(await recording.path(), output.replace('.webm', '-failed.webm'));
  } catch {}
  throw new Error(
    String(e.message)
      .replaceAll(password, '[redacted]')
      .replaceAll(app.store.setupToken ?? 'no-token', '[redacted]'),
  );
} finally {
  await browser.close();
  await app.close();
}
