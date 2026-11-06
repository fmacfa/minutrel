#!/usr/bin/env node

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const usage = `Usage:
  node capture-site.mjs --config <capture.config.json>
  node capture-site.mjs --config <capture.config.json> --validate

The script resolves Playwright from the current working directory and refuses
to overwrite an existing video or sidecar.`;

const fail = (message) => {
  throw new Error(message);
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const assertNumber = (value, label, { integer = false, min = 0 } = {}) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    fail(`${label} must be a finite number >= ${min}`);
  }
  if (integer && !Number.isInteger(value)) {
    fail(`${label} must be an integer`);
  }
};

const assertString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
};

const assertSupportedUrl = (value, label) => {
  assertString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} must be a valid absolute URL`);
  }
  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
    fail(`${label} must use http, https, or file`);
  }
};

const assertDestinationAbsent = async (destination) => {
  try {
    await fs.access(destination);
    fail(`Refusing to overwrite existing file: ${destination}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let configPath;
  let validateOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') {
      configPath = args[index + 1];
      index += 1;
    } else if (arg === '--validate') {
      validateOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${usage}\n`);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}\n\n${usage}`);
    }
  }

  if (!configPath) {
    fail(`Missing --config.\n\n${usage}`);
  }

  return { configPath: path.resolve(process.cwd(), configPath), validateOnly };
};

const validateTarget = (target, label) => {
  if (!isObject(target)) {
    fail(`${label} must be an object`);
  }

  const strategies = ['selector', 'testId', 'role', 'text'].filter(
    (key) => typeof target[key] === 'string' && target[key].trim() !== '',
  );
  if (strategies.length !== 1) {
    fail(`${label} must specify exactly one of selector, testId, role, or text`);
  }
  if (target.name !== undefined && target.role === undefined) {
    fail(`${label}.name may only be used with role`);
  }
  if (target.index !== undefined) {
    assertNumber(target.index, `${label}.index`, { integer: true, min: 0 });
  }
  if (target.exact !== undefined && typeof target.exact !== 'boolean') {
    fail(`${label}.exact must be a boolean`);
  }
};

const validateAction = (action, index) => {
  const label = `actions[${index}]`;
  if (!isObject(action)) {
    fail(`${label} must be an object`);
  }
  assertString(action.type, `${label}.type`);

  const targetActions = new Set(['click', 'hover', 'fill', 'type', 'select', 'waitFor']);
  if (targetActions.has(action.type)) {
    validateTarget(action.target, `${label}.target`);
  }
  if (action.type === 'press' && action.target !== undefined) {
    validateTarget(action.target, `${label}.target`);
  }

  switch (action.type) {
    case 'wait':
      assertNumber(action.ms, `${label}.ms`, { integer: true });
      break;
    case 'click':
    case 'hover':
      break;
    case 'fill':
    case 'type':
      if (typeof action.value !== 'string') fail(`${label}.value must be a string`);
      break;
    case 'select':
      assertString(action.optionLabel, `${label}.optionLabel`);
      break;
    case 'press':
      assertString(action.key, `${label}.key`);
      break;
    case 'scroll':
      assertNumber(action.x ?? 0, `${label}.x`, { min: Number.NEGATIVE_INFINITY });
      assertNumber(action.y ?? 0, `${label}.y`, { min: Number.NEGATIVE_INFINITY });
      break;
    case 'move':
      assertNumber(action.x, `${label}.x`);
      assertNumber(action.y, `${label}.y`);
      break;
    case 'waitFor':
      if (
        action.state !== undefined &&
        !['attached', 'detached', 'visible', 'hidden'].includes(action.state)
      ) {
        fail(`${label}.state is invalid`);
      }
      break;
    case 'goto':
      assertSupportedUrl(action.url, `${label}.url`);
      if (
        action.waitUntil !== undefined &&
        !['load', 'domcontentloaded', 'networkidle', 'commit'].includes(action.waitUntil)
      ) {
        fail(`${label}.waitUntil is invalid`);
      }
      break;
    case 'screenshot':
      assertString(action.path, `${label}.path`);
      if (action.fullPage !== undefined && typeof action.fullPage !== 'boolean') {
        fail(`${label}.fullPage must be a boolean`);
      }
      break;
    default:
      fail(`${label}.type is unsupported: ${action.type}`);
  }

  for (const key of ['afterMs', 'durationMs', 'moveDurationMs', 'timeoutMs']) {
    if (action[key] !== undefined) assertNumber(action[key], `${label}.${key}`, { integer: true });
  }
  if (action.steps !== undefined)
    assertNumber(action.steps, `${label}.steps`, { integer: true, min: 1 });
  if (action.label !== undefined) assertString(action.label, `${label}.label`);
};

const validateConfig = (config) => {
  if (!isObject(config)) fail('Configuration root must be an object');
  assertSupportedUrl(config.url, 'url');
  assertString(config.output, 'output');
  if (!config.output.toLowerCase().endsWith('.webm')) {
    fail('output must end in .webm');
  }

  for (const field of ['viewport', 'videoSize']) {
    if (config[field] !== undefined) {
      if (!isObject(config[field])) fail(`${field} must be an object`);
      assertNumber(config[field].width, `${field}.width`, { integer: true, min: 1 });
      assertNumber(config[field].height, `${field}.height`, { integer: true, min: 1 });
    }
  }

  if (
    config.waitUntil !== undefined &&
    !['load', 'domcontentloaded', 'networkidle', 'commit'].includes(config.waitUntil)
  ) {
    fail('waitUntil is invalid');
  }
  if (
    config.colorScheme !== undefined &&
    !['light', 'dark', 'no-preference'].includes(config.colorScheme)
  ) {
    fail('colorScheme is invalid');
  }
  if (
    config.reducedMotion !== undefined &&
    !['reduce', 'no-preference'].includes(config.reducedMotion)
  ) {
    fail('reducedMotion is invalid');
  }
  if (config.readyTarget !== undefined) validateTarget(config.readyTarget, 'readyTarget');
  if (config.storageState !== undefined) assertString(config.storageState, 'storageState');
  if (config.locale !== undefined) assertString(config.locale, 'locale');
  if (config.timezoneId !== undefined) assertString(config.timezoneId, 'timezoneId');
  if (config.cursor !== undefined && typeof config.cursor !== 'boolean')
    fail('cursor must be a boolean');
  if (config.hideSelectors !== undefined) {
    if (
      !Array.isArray(config.hideSelectors) ||
      config.hideSelectors.some((item) => typeof item !== 'string')
    ) {
      fail('hideSelectors must be an array of strings');
    }
  }

  for (const key of ['initialWaitMs', 'finalWaitMs', 'timeoutMs']) {
    if (config[key] !== undefined) assertNumber(config[key], key, { integer: true });
  }
  if (config.actions !== undefined && !Array.isArray(config.actions))
    fail('actions must be an array');
  (config.actions ?? []).forEach(validateAction);

  return config;
};

const readConfig = async (configPath) => {
  const source = await fs.readFile(configPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    fail(`Invalid JSON in ${configPath}: ${error.message}`);
  }
  return validateConfig(parsed);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveLocator = (page, target) => {
  let locator;
  if (target.selector !== undefined) locator = page.locator(target.selector);
  if (target.testId !== undefined) locator = page.getByTestId(target.testId);
  if (target.role !== undefined) {
    locator = page.getByRole(target.role, {
      name: target.name,
      exact: target.exact ?? false,
    });
  }
  if (target.text !== undefined) {
    locator = page.getByText(target.text, { exact: target.exact ?? false });
  }
  return target.index === undefined ? locator : locator.nth(target.index);
};

const cursorInitScript = `(() => {
  const install = () => {
    if (document.getElementById('__codex_demo_cursor')) return;
    const style = document.createElement('style');
    style.id = '__codex_demo_cursor_style';
    style.textContent = [
      'html.__codex_demo_cursor_enabled, html.__codex_demo_cursor_enabled * { cursor: none !important; }',
      '#__codex_demo_cursor { position: fixed; width: 22px; height: 22px; left: 0; top: 0; pointer-events: none; z-index: 2147483647; transform: translate(-3px, -2px); filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }',
      '#__codex_demo_cursor::before { content: ""; display: block; width: 0; height: 0; border-top: 20px solid white; border-right: 13px solid transparent; transform: rotate(-15deg); filter: drop-shadow(0 0 1px #111); }',
      '.__codex_demo_ripple { position: fixed; width: 18px; height: 18px; margin: -9px 0 0 -9px; border: 3px solid rgba(109,93,252,.9); border-radius: 999px; pointer-events: none; z-index: 2147483646; animation: __codex_demo_ripple .42s ease-out forwards; }',
      '@keyframes __codex_demo_ripple { from { opacity: 1; transform: scale(.4); } to { opacity: 0; transform: scale(2.6); } }'
    ].join('');
    document.documentElement.classList.add('__codex_demo_cursor_enabled');
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = '__codex_demo_cursor';
    document.documentElement.appendChild(cursor);
    window.addEventListener('mousemove', (event) => {
      cursor.style.left = event.clientX + 'px';
      cursor.style.top = event.clientY + 'px';
    }, {passive: true});
    window.addEventListener('mousedown', (event) => {
      const ripple = document.createElement('div');
      ripple.className = '__codex_demo_ripple';
      ripple.style.left = event.clientX + 'px';
      ripple.style.top = event.clientY + 'px';
      document.documentElement.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    }, {passive: true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once: true});
  else install();
})();`;

const presentationStyle = (hideSelectors) => {
  const rules = [
    'input, textarea, [contenteditable="true"] { caret-color: transparent !important; }',
  ];
  for (const selector of hideSelectors) {
    rules.push(`${selector} { visibility: hidden !important; }`);
  }
  return rules.join('\n');
};

const moveMouse = async (page, cursor, x, y, durationMs = 450, steps = 24) => {
  const safeSteps = Math.max(1, Math.round(steps));
  const start = { ...cursor };
  for (let step = 1; step <= safeSteps; step += 1) {
    const progress = step / safeSteps;
    const eased = 1 - Math.pow(1 - progress, 3);
    const nextX = start.x + (x - start.x) * eased;
    const nextY = start.y + (y - start.y) * eased;
    await page.mouse.move(nextX, nextY);
    if (durationMs > 0) await delay(durationMs / safeSteps);
  }
  cursor.x = x;
  cursor.y = y;
};

const moveToLocator = async (page, cursor, locator, action) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) fail(`Target for ${action.type} has no visible bounding box`);
  await moveMouse(
    page,
    cursor,
    box.x + box.width / 2,
    box.y + box.height / 2,
    action.moveDurationMs ?? 450,
    action.steps ?? 24,
  );
};

const addMarker = (markers, label, contentStartedAt) => {
  if (!label) return;
  markers.push({ label, ms: Math.max(0, Date.now() - contentStartedAt) });
};

const applyPageStyle = async (page, config) => {
  const css = presentationStyle(config.hideSelectors ?? []);
  await page.addStyleTag({ content: css });
};

const executeAction = async ({ page, action, cursor, config, markers, contentStartedAt }) => {
  addMarker(markers, action.label, contentStartedAt);

  switch (action.type) {
    case 'wait':
      await delay(action.ms);
      break;
    case 'click': {
      const locator = resolveLocator(page, action.target);
      await moveToLocator(page, cursor, locator, action);
      await delay(120);
      await page.mouse.click(cursor.x, cursor.y);
      break;
    }
    case 'hover': {
      const locator = resolveLocator(page, action.target);
      await moveToLocator(page, cursor, locator, action);
      break;
    }
    case 'fill': {
      const locator = resolveLocator(page, action.target);
      await moveToLocator(page, cursor, locator, action);
      await page.mouse.click(cursor.x, cursor.y);
      await locator.fill(action.value);
      break;
    }
    case 'type': {
      const locator = resolveLocator(page, action.target);
      await moveToLocator(page, cursor, locator, action);
      await locator.fill('');
      await locator.pressSequentially(action.value, {delay: action.typeDelayMs ?? 28});
      break;
    }
    case 'select': {
      const locator = resolveLocator(page, action.target);
      await moveToLocator(page, cursor, locator, action);
      await locator.selectOption({label: action.optionLabel});
      break;
    }
    case 'press': {
      if (action.target) await resolveLocator(page, action.target).press(action.key);
      else await page.keyboard.press(action.key);
      break;
    }
    case 'scroll': {
      const steps = action.steps ?? 30;
      const durationMs = action.durationMs ?? 900;
      const xPerStep = (action.x ?? 0) / steps;
      const yPerStep = (action.y ?? 0) / steps;
      for (let step = 0; step < steps; step += 1) {
        await page.mouse.wheel(xPerStep, yPerStep);
        if (durationMs > 0) await delay(durationMs / steps);
      }
      break;
    }
    case 'move':
      await moveMouse(
        page,
        cursor,
        action.x,
        action.y,
        action.durationMs ?? 450,
        action.steps ?? 24,
      );
      break;
    case 'waitFor':
      await resolveLocator(page, action.target).waitFor({
        state: action.state ?? 'visible',
        timeout: action.timeoutMs ?? config.timeoutMs ?? 30000,
      });
      break;
    case 'goto': {
      const response = await page.goto(action.url, {
        waitUntil: action.waitUntil ?? config.waitUntil ?? 'domcontentloaded',
        timeout: action.timeoutMs ?? config.timeoutMs ?? 30000,
      });
      if (response && response.status() >= 400)
        fail(`Navigation returned HTTP ${response.status()}: ${action.url}`);
      await applyPageStyle(page, config);
      break;
    }
    case 'screenshot': {
      const screenshotPath = path.resolve(process.cwd(), action.path);
      await assertDestinationAbsent(screenshotPath);
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: action.fullPage ?? false });
      break;
    }
  }

  if (action.afterMs) await delay(action.afterMs);
};

const moveFile = async (source, destination) => {
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(source, destination);
    await fs.unlink(source);
  }
};

const main = async () => {
  const { configPath, validateOnly } = parseArgs();
  const config = await readConfig(configPath);
  if (validateOnly) {
    process.stdout.write(`Valid capture configuration: ${configPath}\n`);
    return;
  }

  const outputPath = path.resolve(process.cwd(), config.output);
  const sidecarPath = outputPath.replace(/\.webm$/i, '.json');
  for (const destination of [outputPath, sidecarPath]) {
    await assertDestinationAbsent(destination);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-site-capture-'));
  const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'));

  let playwright;
  try {
    playwright = requireFromProject('playwright');
  } catch {
    fail(
      'Playwright is not installed in the current project. Run: npm install --save-dev playwright',
    );
  }

  const viewport = config.viewport ?? { width: 1440, height: 900 };
  const videoSize = config.videoSize ?? viewport;
  const storageState = config.storageState
    ? path.resolve(path.dirname(configPath), config.storageState)
    : undefined;
  const contextOptions = {
    viewport,
    recordVideo: { dir: temporaryDirectory, size: videoSize },
    locale: config.locale ?? 'en-US',
    colorScheme: config.colorScheme ?? 'light',
    reducedMotion: config.reducedMotion ?? 'no-preference',
    storageState,
  };
  if (config.timezoneId) contextOptions.timezoneId = config.timezoneId;

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const recordedVideo = page.video();
  const timeoutMs = config.timeoutMs ?? 30000;
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);

  if (config.cursor !== false) await page.addInitScript({ content: cursorInitScript });

  const recordingStartedAt = Date.now();
  let contentStartedAt;
  let trimEndMs;
  const markers = [];
  const cursor = { x: 48, y: viewport.height - 48 };

  try {
    const response = await page.goto(config.url, {
      waitUntil: config.waitUntil ?? 'domcontentloaded',
      timeout: timeoutMs,
    });
    if (response && response.status() >= 400)
      fail(`Navigation returned HTTP ${response.status()}: ${config.url}`);
    await applyPageStyle(page, config);

    if (config.readyTarget) {
      await resolveLocator(page, config.readyTarget).waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
    }
    await delay(config.initialWaitMs ?? 800);
    contentStartedAt = Date.now();
    await page.mouse.move(cursor.x, cursor.y);

    for (const action of config.actions ?? []) {
      await executeAction({ page, action, cursor, config, markers, contentStartedAt });
    }

    await delay(config.finalWaitMs ?? 800);
    trimEndMs = Date.now() - recordingStartedAt;
    await context.close();

    const recordedPath = await recordedVideo.path();
    await moveFile(recordedPath, outputPath);

    const metadata = {
      sourceUrl: config.url,
      video: path.basename(outputPath),
      viewport,
      videoSize,
      trimStartMs: contentStartedAt - recordingStartedAt,
      trimEndMs,
      usableDurationMs: trimEndMs - (contentStartedAt - recordingStartedAt),
      markers,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(sidecarPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    process.stdout.write(`Captured video: ${outputPath}\nTiming sidecar: ${sidecarPath}\n`);
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
