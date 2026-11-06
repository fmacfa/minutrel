import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: '.cache/session.json',
  locale: 'fr-FR',
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
try {
  await page.goto('http://127.0.0.1:8086');
  await page.getByRole('button', { name: 'Démarrer', exact: true }).waitFor();
  await page
    .getByRole('textbox', { name: 'Description du travail', exact: true })
    .fill('Préparer les maquettes du projet Atlas');
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  const popup = context.waitForEvent('page', { timeout: 10000 });
  await page.getByRole('button', { name: 'Mini chrono', exact: true }).click();
  const widget = await popup;
  await widget.setViewportSize({ width: 420, height: 330 });
  await widget.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  await widget.waitForTimeout(3200);
  await widget.getByRole('button', { name: 'Pause', exact: true }).click();
  await widget.getByRole('button', { name: 'Reprendre', exact: true }).waitFor();
  await widget.screenshot({ path: 'public/stills/widget.png' });
  console.log(
    'Actual compact window captured',
    await widget.title(),
    await widget.locator('body').innerText(),
  );
  await widget.getByRole('button', { name: 'Arrêter et enregistrer', exact: true }).click();
  await page.getByRole('button', { name: 'Démarrer', exact: true }).waitFor();
} finally {
  await context.close();
  await browser.close();
}
