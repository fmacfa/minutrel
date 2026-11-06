import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: '.cache/session.json',
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
try {
  await page.goto('http://127.0.0.1:8086');
  await page.getByRole('button', { name: 'Démarrer', exact: true }).waitFor();
  for (const name of ['Les projets', 'Le fil du travail', 'Les rapports', 'Les temps']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(650);
    console.log(name, await page.locator('main').innerText());
    await page.screenshot({ path: `.cache/${name.replaceAll(' ', '-')}.png` });
    if (name === 'Le fil du travail' || name === 'Les temps') {
      await page
        .getByRole('button', {
          name: name === 'Les temps' ? 'Ajouter un temps' : 'Ajouter une note',
          exact: true,
        })
        .click();
      console.log('DIALOG', await page.getByRole('dialog').innerText());
      console.log(
        'FIELDS',
        await page
          .getByRole('dialog')
          .locator('input,select,textarea')
          .evaluateAll((es) =>
            es.map((e) => ({
              tag: e.tagName,
              name: e.name,
              type: e.type,
              labels: [...(e.labels ?? [])].map((l) => l.innerText),
            })),
          ),
      );
      await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    }
  }
} finally {
  await context.close();
  await browser.close();
}
