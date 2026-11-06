import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const all = JSON.parse(await readFile('src/series/voices.json', 'utf8'));
const accessData = JSON.parse(
  await readFile('../.cache/video-series-en-2026-11-06/access.json', 'utf8'),
);
const cursorScript = () => {
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent =
      '*{cursor:none!important}input[type=password],textarea.code-input{visibility:hidden!important}input,textarea{caret-color:transparent!important}#__filmCursor{position:fixed;z-index:2147483647;pointer-events:none;width:24px;height:30px;left:30px;top:850px;filter:drop-shadow(0 1px 2px #142c38aa)}';
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = '__filmCursor';
    cursor.innerHTML =
      '<svg viewBox="0 0 24 30"><path d="M3 1 21 19 12 19 8 28Z" fill="white" stroke="#142c38" stroke-width="1.4"/></svg>';
    document.body.appendChild(cursor);
    addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
  });
};
await mkdir('public/captures/series-en', { recursive: true });
await mkdir('public/stills/series-en', { recursive: true });
await mkdir('.cache/series-downloads', { recursive: true });
const browser = await chromium.launch({ headless: true });
const selected = process.argv.slice(2).map(Number);
try {
  for (const id of selected.length ? selected : [5, 6, 7, 8, 11]) {
    const film = all.find((f) => f.id === id);
    if (!film) throw new Error(`Narration not ready: ${id}`);
    const output = `public/captures/series-en/${String(id).padStart(2, '0')}.webm`;
    try {
      await access(output);
      console.log('Existing capture kept', id);
      continue;
    } catch {}
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: '.cache/series-recordings', size: { width: 1440, height: 900 } },
      storageState: '.cache/session-series.json',
      locale: 'en-GB',
      timezoneId: 'Europe/Paris',
      reducedMotion: 'reduce',
    });
    await context.addInitScript(cursorScript);
    const recordingStart = Date.now(),
      page = await context.newPage(),
      recording = page.video();
    page.setDefaultTimeout(9000);
    let contentStart;
    const markers = [];
    page.on(
      'download',
      (d) => void d.saveAs(resolve('.cache/series-downloads', d.suggestedFilename())),
    );
    const b = (name) => page.getByRole('button', { name, exact: true });
    let mouse = { x: 40, y: 840 };
    const move = async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) throw new Error('Invisible capture target');
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      for (let i = 1; i <= 18; i++) {
        const p = 1 - (1 - i / 18) ** 3;
        await page.mouse.move(mouse.x + (x - mouse.x) * p, mouse.y + (y - mouse.y) * p);
        await page.waitForTimeout(18);
      }
      mouse = { x, y };
    };
    const click = async (locator) => {
      await move(locator);
      await locator.click();
      await page.waitForTimeout(380);
    };
    const fill = async (locator, text, delay = 24) => {
      await move(locator);
      await locator.fill('');
      await locator.pressSequentially(text, { delay });
    };
    const select = async (locator, label) => {
      await move(locator);
      await locator.selectOption({ label });
      await page.waitForTimeout(320);
    };
    const shot = async (key) => {
      const file = `public/stills/series-en/${String(id).padStart(2, '0')}-${key}.png`;
      await page.screenshot({ path: file });
      return file;
    };
    const step = async (key, fn) => {
      const voice = film.steps.find((s) => s.key === key);
      const start = Date.now();
      markers.push({ key, ms: start - contentStart });
      await fn();
      await page.waitForTimeout(Math.max(700, voice.duration * 1000 + 800 - (Date.now() - start)));
      await shot(key);
      console.log(`Captured ${id}/${key}`);
    };
    try {
      await page.goto('http://127.0.0.1:8088');
      await b('Start').waitFor();
      if (id === 7) {
        await click(b('Work journal'));
        const review = b('Review and approve').first();
        if (await review.count()) {
          await click(review);
          const check = page.locator('dialog input[name=approved]');
          await check.check();
          await click(b('Save my choice'));
          await page.waitForTimeout(600);
        }
      }
      contentStart = Date.now();
      if (id === 5) {
        await step('member', async () => {
          await click(b('Team'));
          await click(b('Add a member'));
          await fill(page.locator('dialog input[name=name]'), 'Jamie Rivera');
          await fill(page.locator('dialog input[name=email]'), 'jamie@minutrel.test');
          await page.locator('dialog input[name=password]').evaluate((el, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
              el,
              value,
            );
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, accessData.password);
          await page.waitForTimeout(900);
          await click(page.locator('dialog').getByRole('button', { name: 'Save', exact: true }));
        });
        await step('roles', async () => {
          const row = page.getByRole('row').filter({ hasText: 'Jamie Rivera' });
          await click(row.getByRole('button', { name: 'Edit', exact: true }));
          await select(page.locator('dialog select[name=role]'), 'Manager');
          await page.waitForTimeout(2400);
          await click(page.locator('dialog').getByRole('button', { name: 'Save', exact: true }));
        });
        await step('project', async () => {
          await click(b('Projects'));
          await click(b('Edit Atlas'));
          const member = page.locator('dialog label.check-row').filter({ hasText: 'Jamie Rivera' });
          if (!(await member.locator('input').isChecked())) await click(member);
          await page.waitForTimeout(1600);
          await click(page.locator('dialog').getByRole('button', { name: 'Save', exact: true }));
        });
      }
      if (id === 6) {
        await step('add', async () => {
          await click(b('Time entries'));
          await click(b('Add time'));
          await fill(page.locator('dialog input[name=duration]'), '45 min');
          await fill(
            page.locator('dialog textarea[name=description]'),
            'Client review preparation',
          );
        });
        await step('save', async () => {
          await click(b('Add this time entry'));
          await page.getByText('Client review preparation', { exact: true }).waitFor();
        });
        await step('edit', async () => {
          const row = page.getByRole('row').filter({ hasText: 'Client review preparation' });
          await click(row.getByRole('button').first());
          await fill(
            page.locator('dialog textarea[name=description]'),
            'Client review and preparation',
          );
          await fill(
            page.locator('dialog textarea[name=reason],dialog input[name=reason]'),
            'Clarify the work description',
          );
        });
        await step('audit', async () => {
          await click(b('Save correction'));
          await page.getByText('Client review and preparation', { exact: true }).waitFor();
        });
      }
      if (id === 7) {
        await step('period', async () => {
          await click(b('Reports'));
          await move(page.locator('main input[type=month]'));
        });
        await step('people', async () => {
          await click(page.locator('main .member-filter > summary'));
          await click(page.locator('.member-filter-menu label').filter({ hasText: 'Alex Morgan' }));
          await page.waitForTimeout(1800);
          await click(page.locator('main .member-filter > summary'));
        });
        await step('context', async () => {
          await page
            .getByRole('heading', { name: 'Work completed', exact: true })
            .scrollIntoViewIfNeeded();
          await page.mouse.wheel(0, 210);
          await page.waitForTimeout(700);
        });
        await step('export', async () => {
          await page.mouse.wheel(0, -1800);
          await page.waitForTimeout(800);
          await click(b('PDF'));
          await page.waitForTimeout(1400);
          await click(b('CSV'));
        });
      }
      if (id === 8) {
        const note = 'Atlas prototype approved. Next: prepare the handover together.';
        const summary =
          'Atlas moved from exploration to an approved prototype. The team clarified navigation and agreed the handover plan. Next month, we will finish the delivery package.';
        await step('note', async () => {
          await click(b('Work journal'));
          await click(b('Add a note'));
          await fill(page.locator('dialog textarea[name=text]'), note);
          await click(page.locator('dialog').getByRole('button', { name: 'Save', exact: true }));
        });
        await step('privacy', async () => {
          const article = page.locator('article').filter({ hasText: note }).last();
          await click(article.getByRole('button', { name: 'Review / share', exact: true }));
          await click(page.locator('dialog label.check-row'));
          await page.waitForTimeout(1700);
          await click(page.locator('dialog').getByRole('button', { name: 'Save', exact: true }));
        });
        await step('draft', async () => {
          await click(b('Write'));
          await fill(page.locator('dialog textarea[name=text]'), summary, 18);
          await click(b('Create draft'));
        });
        await step('approve', async () => {
          const card = page
            .locator('article.summary-card')
            .filter({ hasText: 'Atlas moved from exploration' });
          await click(card.getByRole('button', { name: 'Review and approve', exact: true }));
          await click(page.locator('dialog label.check-row'));
          await page.waitForTimeout(1600);
          await click(b('Save my choice'));
        });
      }
      if (id === 11) {
        await step('access', async () => {
          await click(b('Integrations'));
          await click(b('Create access token'));
          await fill(page.locator('dialog input[name=name]'), 'Studio assistant');
          await select(page.locator('dialog select[name=days]'), '30 days');
        });
        await step('scope', async () => {
          const timer = page.getByRole('checkbox', {
            name: 'Start, pause and stop my timer',
            exact: true,
          });
          if (await timer.isChecked()) throw new Error('Timer access must remain disabled');
          await move(timer);
          await page.waitForTimeout(2200);
          await click(
            page
              .locator('dialog')
              .getByRole('button', { name: 'Create access token', exact: true }),
          );
          await page.waitForTimeout(1200);
          await click(b('I have saved my token'));
        });
        await step('configure', async () => {
          await click(page.locator('details.configuration > summary'));
          await page.locator('pre.code-block').scrollIntoViewIfNeeded();
          await page.waitForTimeout(3000);
          await click(b('Claude Code'));
          await page.waitForTimeout(2500);
          await click(b('Codex'));
        });
        await step('revoke', async () => {
          await page.mouse.wheel(0, -900);
          await page.waitForTimeout(600);
          const row = page.locator('.integration-row').filter({ hasText: 'Studio assistant' });
          await click(row.getByRole('button', { name: 'Revoke', exact: true }));
          await page.waitForTimeout(1800);
          await click(page.locator('dialog').getByRole('button', { name: 'Revoke', exact: true }));
        });
        await step('engines', async () => {
          await click(b('Add'));
          await page.waitForTimeout(2200);
          await page
            .getByRole('dialog')
            .screenshot({ path: 'public/stills/series-en/11-provider-dialog.png' });
        });
      }
      await page.waitForTimeout(600);
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
      console.log('Capture complete', id);
    } catch (error) {
      await context.close();
      const failed = output.replace('.webm', '-failed.webm');
      try {
        await rename(await recording.path(), failed);
      } catch {}
      throw new Error(String(error.message ?? error).replaceAll(accessData.password, '[redacted]'));
    }
  }
} finally {
  await browser.close();
}
