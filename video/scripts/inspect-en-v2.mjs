import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: '.cache/session-en-v2.json',
  locale: 'en-GB',
  timezoneId: 'Europe/Paris',
});
const page = await context.newPage();
page.setDefaultTimeout(7000);
try {
  await page.goto('http://127.0.0.1:8086');
  await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
  console.log('LANGUAGE', await page.locator('html').getAttribute('lang'));
  console.log('BUTTONS', await page.getByRole('button').allTextContents());
  console.log('PROJECTS', await page.locator('#timer-project').locator('option').allTextContents());
  await page.getByRole('button', { name: 'Work journal', exact: true }).click();
  await page.getByRole('button', { name: 'Add a note', exact: true }).click();
  console.log('NOTE DIALOG', await page.getByRole('dialog').innerText());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.waitForTimeout(500);
  console.log('REPORT HEAD', await page.locator('main').innerText());
  await page.screenshot({ path: '.cache/english-report-verified.png' });
} finally {
  await context.close();
  await browser.close();
}
