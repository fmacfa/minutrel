import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: '.cache/session-series.json',
    locale: 'en-GB',
  }),
  page = await context.newPage();
page.setDefaultTimeout(7000);
const fields = () =>
  page
    .getByRole('dialog')
    .locator('input,textarea,select,button')
    .evaluateAll((es) =>
      es.map((e) => ({
        tag: e.tagName,
        name: e.name,
        type: e.type,
        text: e.tagName === 'BUTTON' ? e.textContent.trim() : '',
        labels: [...(e.labels ?? [])].map((x) => x.innerText),
      })),
    );
try {
  await page.goto('http://127.0.0.1:8088');
  await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
  for (const name of ['Team', 'Time entries', 'Work journal', 'Integrations']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(350);
    console.log(name, await page.locator('main').innerText());
    const action = {
      Team: 'Add a member',
      'Time entries': 'Add time',
      'Work journal': 'Write',
      Integrations: 'Create access token',
    }[name];
    await page.getByRole('button', { name: action, exact: true }).click();
    console.log('FIELDS', JSON.stringify(await fields()));
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
} finally {
  await context.close();
  await browser.close();
}
