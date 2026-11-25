// SPDX-License-Identifier: AGPL-3.0-or-later
// Run on a clean Windows test machine with a fresh Minutrel installation.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../apps/api/src/app.ts';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.MINUTREL_TEST_PLAYWRIGHT || '../video/node_modules/playwright',
);
const executable = process.argv[2];
if (process.platform !== 'win32' || !executable)
  throw new Error('Pass the installed Windows executable');
const password = randomBytes(20).toString('hex');
const setupToken = randomBytes(24).toString('hex');
const email = 'installation@minutrel.test';
const api = createApp({ path: ':memory:', key: randomBytes(32), setupToken });
let loginAttempts = 0;
api.addHook('onRequest', async (req) => {
  if (req.method === 'POST' && req.url === '/api/v1/auth/login') loginAttempts++;
});
const origin = await api.listen({ port: 0, host: '127.0.0.1' });
const setup = await api.inject({
  method: 'POST',
  url: '/api/v1/setup',
  payload: {
    setupToken,
    email,
    password,
    workspaceName: 'Installation QA',
    name: 'QA',
    timezone: 'Europe/Paris',
    native: true,
  },
});
assert.ok(setup.statusCode === 200 || setup.statusCode === 201, 'Create a disposable team account');

let wrongPosts = 0;
const website = createServer((req, res) => {
  if (req.method === 'POST') wrongPosts++;
  res
    .writeHead(200, { 'Content-Type': 'text/html' })
    .end('<!doctype html><title>Download site</title>');
});
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once('error', reject).listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
const wrongPort = await listen(website);
const portSelector = createServer();
const port = await listen(portSelector);
await new Promise((resolve) => portSelector.close(resolve));
const app = spawn(executable, [], {
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-address=127.0.0.1 --remote-debugging-port=${port}`,
  },
  stdio: 'ignore',
});
let browser;
try {
  const endpoint = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80 && !browser; i++) {
    if (app.exitCode !== null) throw new Error('Minutrel exited during startup');
    try {
      if ((await fetch(endpoint + '/json/version')).ok)
        browser = await chromium.connectOverCDP(endpoint, { timeout: 2500 });
    } catch {}
    if (!browser) await delay(450);
  }
  assert.ok(browser, 'Connect to the test WebView2 instance');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || (await context.waitForEvent('page', { timeout: 15000 }));
  const server = page.locator('input[inputmode="url"]');
  const emailField = page.locator('input[name=email]');
  const passwordField = page.locator('input[name=password]');
  const submit = page.locator('form.stack-form button[type=submit]');
  await emailField.waitFor({ state: 'visible', timeout: 25000 });
  assert.ok(
    await passwordField.isVisible(),
    'Credentials remain visible when the default server is unavailable',
  );
  await server.fill(`http://127.0.0.1:${wrongPort}/downloads`);
  await emailField.fill(email);
  await passwordField.fill(password);
  await submit.click();
  await page
    .getByRole('alert')
    .filter({ hasText: /Minutrel/ })
    .first()
    .waitFor({ timeout: 15000 });
  assert.equal(wrongPosts, 0, 'Never send credentials to a download website');
  assert.equal(await emailField.inputValue(), email, 'Keep the form after an address error');
  await server.fill(origin + '/projects?view=team#times');
  await submit.click();
  await page.locator('aside.sidebar').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(loginAttempts, 1, 'Authenticate once on the selected team server');
  assert.equal(wrongPosts, 0);
  console.log(
    'PASS: installed desktop shows both fields offline, rejects a website before login and signs into the selected team with a pasted URL.',
  );
} finally {
  await browser?.close();
  app.kill();
  website.closeAllConnections();
  await new Promise((resolve) => website.close(resolve));
  await api.close();
}
