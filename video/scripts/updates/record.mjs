import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { films, release } from './story.mjs';

const args = process.argv.slice(2);
const snapshotArg = args.indexOf('--snapshot');
if (snapshotArg < 0 || !args[snapshotArg + 1])
  throw new Error('Use --snapshot <built, isolated checkout>');
const snapshot = resolve(args[snapshotArg + 1]);
const record = args.includes('--record');
const force = args.includes('--force');
const ids = args.filter((arg, i) => i !== snapshotArg + 1 && /^1[3-6]$/.test(arg)).map(Number);
const selected = films.filter((film) => !ids.length || ids.includes(film.id));
const voices = record ? JSON.parse(await readFile('.cache/updates-voices.json', 'utf8')) : {};
const captures = 'public/captures/updates-en';
const preflight = 'out/updates-en/preflight';
await mkdir(captures, { recursive: true });
await mkdir(preflight, { recursive: true });
await mkdir('.cache/updates-recordings', { recursive: true });
await access(resolve(snapshot, 'apps/web/dist/index.html'));

// Auth and fixtures exist only in the in-memory loopback instance.
delete process.env.APP_PUBLIC_URL;
delete process.env.APP_COOKIE_SECURE;
const requireSnapshot = createRequire(pathToFileURL(resolve(snapshot, 'package.json')));
const { createApp } = await import(pathToFileURL(resolve(snapshot, 'apps/api/src/app.ts')).href);
const staticFiles = requireSnapshot('@fastify/static');
const timezone = 'Europe/Paris';
const toDay = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const today = toDay(new Date());
const day = (offset) =>
  new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
const weekStart = day(-weekday);
const category = 'Client review';
const actionTitle = 'Review identity concepts';
const described = 'Prepared three options for the client review';
const linkedDescription = 'Compared the two leading design concepts';
const projectName = 'Atlas';

async function workspace(film) {
  const app = createApp({
    path: ':memory:',
    setupToken: randomBytes(24).toString('base64url'),
    key: randomBytes(32),
    fetcher: async () => {
      throw new Error('External calls are disabled in the recording fixture');
    },
  });
  app.register(staticFiles, { root: resolve(snapshot, 'apps/web/dist') });
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  const password = `Demo-${randomBytes(21).toString('base64url')}`;
  const request = async (method, path, payload, token) => {
    const response = await app.inject({
      method,
      url: '/api/v1' + path,
      payload,
      headers: {
        'idempotency-key': randomUUID(),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`${method} ${path}: ${response.statusCode} ${response.json().message ?? ''}`);
    }
    return response;
  };
  const call = async (...args) => (await request(...args)).json();
  const email = {
    admin: 'alex@minutrel.test',
    manager: 'sam@minutrel.test',
    member: 'jordan@minutrel.test',
  };
  try {
    const admin = await call('POST', '/setup', {
      setupToken: app.store.setupToken,
      workspaceName: 'Demo Studio',
      name: 'Alex Morgan',
      email: email.admin,
      password,
      timezone,
      native: true,
    });
    const manager = await call(
      'POST',
      '/members',
      { name: 'Sam Taylor', email: email.manager, password, role: 'manager' },
      admin.token,
    );
    const member = await call(
      'POST',
      '/members',
      { name: 'Jordan Lee', email: email.member, password, role: 'contributor' },
      admin.token,
    );
    const memberIds = [admin.member.id, manager.id, member.id];
    const project = await call(
      'POST',
      '/projects',
      {
        name: projectName,
        description: 'A new visual identity, from early concepts to delivery.',
        color: '#087f75',
        memberIds,
      },
      admin.token,
    );
    const second = await call(
      'POST',
      '/projects',
      {
        name: 'North House',
        description: 'A clear website for a fictional design studio.',
        color: '#879b43',
        memberIds,
      },
      admin.token,
    );
    const task =
      film.id === 13
        ? null
        : await call('POST', `/projects/${project.id}/tasks`, { name: category }, admin.token);
    const log = (token, projectId, duration, description, taskId) =>
      call(
        'POST',
        '/time-entries',
        {
          projectId,
          kind: 'duration',
          workDate: today,
          duration,
          description,
          ...(taskId ? { taskId } : {}),
        },
        token,
      );
    if (film.id === 14)
      await log(admin.token, project.id, '5h', 'Research and visual direction', task.id);
    if (film.id === 15) {
      const create = (p, action) => call('POST', `/projects/${p.id}/actions`, action, admin.token);
      await create(project, {
        title: 'Review identity concepts',
        taskId: task.id,
        assigneeId: member.id,
        status: 'in_progress',
        startOn: day(0),
        dueOn: day(4),
        estimateSeconds: 12 * 3600,
      });
      await create(project, {
        title: 'Prepare design handover',
        assigneeId: manager.id,
        startOn: day(4),
        dueOn: day(9),
        estimateSeconds: 8 * 3600,
      });
      await create(second, {
        title: 'Prototype the homepage',
        assigneeId: member.id,
        startOn: day(5),
        dueOn: day(9),
        estimateSeconds: 8 * 3600,
      });
      await create(project, { title: 'Plan the next client review', assigneeId: manager.id });
    }
    if (film.id === 16) {
      const jordan = await call('POST', '/auth/login', {
        email: email.member,
        password,
        native: true,
      });
      await log(jordan.token, project.id, '2h30', 'Reviewed the identity concepts', task.id);
      await log(
        jordan.token,
        project.id,
        '1h30',
        'Prepared feedback for the design review',
        task.id,
      );
      await log(admin.token, second.id, '1h', 'Unreviewed planning check');
    }
    const login = async (role) => {
      const response = await request('POST', '/auth/login', {
        email: email[role],
        password,
        native: false,
      });
      const cookie = response.cookies.find((c) => c.name === 'minutrel');
      if (!cookie) throw new Error('Demo session cookie missing');
      return {
        name: cookie.name,
        value: cookie.value,
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      };
    };
    const verify = async () => {
      if (film.id === 13) {
        const row = app.store.get(
          'SELECT taskId,seconds,description FROM entries WHERE description=?',
          described,
        );
        if (
          row?.seconds !== 2700 ||
          !row.taskId ||
          app.store.get('SELECT name FROM tasks WHERE id=?', row.taskId)?.name !== category
        )
          throw new Error('Subcategory entry was not recorded');
      }
      if (film.id === 14) {
        const p = app.store.get('SELECT budgetSeconds,dueOn FROM projects WHERE id=?', project.id);
        const a = app.store.get(
          'SELECT id,assigneeId,estimateSeconds FROM project_actions WHERE title=?',
          actionTitle,
        );
        const e = app.store.get(
          'SELECT actionId FROM entries WHERE description=?',
          linkedDescription,
        );
        if (
          p?.budgetSeconds !== 144000 ||
          p.dueOn !== day(16) ||
          a?.assigneeId !== member.id ||
          a.estimateSeconds !== 21600 ||
          e?.actionId !== a.id
        )
          throw new Error('Budget, assignment, or action link did not persist');
      }
      if (film.id === 15) {
        const rate = app.store.get(
          'SELECT amountMinor,currency FROM member_rates WHERE memberId=?',
          member.id,
        );
        if (rate?.amountMinor !== 8500 || rate.currency !== 'EUR')
          throw new Error('The example hourly rate did not persist');
      }
      if (film.id === 16) {
        const detail = await call(
          'GET',
          `/timesheets/${member.id}?weekStart=${weekStart}`,
          undefined,
          admin.token,
        );
        const report = await call(
          'GET',
          `/reports/monthly?month=${today.slice(0, 7)}&approvedOnly=true`,
          undefined,
          admin.token,
        );
        if (detail.sheet.status !== 'approved' || report.totalSeconds !== 14400)
          throw new Error('Approved-only export does not match the approved week');
      }
    };
    return { app, origin, login, verify };
  } catch (error) {
    await app.close();
    throw error;
  }
}

const cursor = () =>
  addEventListener('DOMContentLoaded', () => {
    localStorage.setItem('minutrel-language', 'en');
    const style = document.createElement('style');
    style.textContent =
      '*{cursor:none!important}input[type=password]{visibility:hidden!important}input,textarea{caret-color:transparent!important}#film-pointer{position:fixed;left:30px;top:850px;width:25px;height:30px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 2px #142c38aa)}';
    document.head.append(style);
    const pointer = document.createElement('div');
    pointer.id = 'film-pointer';
    pointer.innerHTML =
      '<svg viewBox="0 0 24 30"><path d="M3 1 21 19 12 19 8 28Z" fill="white" stroke="#142c38" stroke-width="1.4"/></svg>';
    document.body.append(pointer);
    addEventListener('mousemove', (event) => {
      pointer.style.left = `${event.clientX}px`;
      pointer.style.top = `${event.clientY}px`;
    });
  });

function controls(page) {
  const b = (name, scope = page) => scope.getByRole('button', { name, exact: true });
  const text = (name, scope = page) => scope.getByText(name, { exact: true });
  const dialog = page.getByRole('dialog');
  const field = (name, scope = page) => scope.getByLabel(name, { exact: true });
  const combo = (name, scope = page) =>
    scope.getByRole('combobox', { name: new RegExp(`^${name}(?:\\s|$)`) });
  const hold = (ms = 240) => (record ? page.waitForTimeout(ms) : Promise.resolve());
  let previous = { x: 32, y: 850 };
  const move = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    if (!record) return;
    const box = await locator.boundingBox();
    if (!box) throw new Error('A recording target is not visible');
    const end = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (let i = 1; i <= 14; i++) {
      const f = 1 - (1 - i / 14) ** 2;
      await page.mouse.move(
        previous.x + (end.x - previous.x) * f,
        previous.y + (end.y - previous.y) * f,
      );
      await hold(23);
    }
    previous = end;
  };
  const click = async (locator) => {
    await move(locator);
    await locator.click();
    await hold();
  };
  const fill = async (locator, value) => {
    await move(locator);
    const type = await locator.getAttribute('type');
    if (record && type !== 'date' && type !== 'number' && type !== 'month') {
      await locator.fill('');
      await locator.pressSequentially(value, { delay: 14 });
    } else await locator.fill(value);
    await hold(190);
  };
  const select = async (locator, label) => {
    await move(locator);
    await locator.selectOption({ label });
    await hold(280);
  };
  const nav = (name) => b(name).first().click();
  const project = async () => {
    await nav('Projects');
    await b(projectName).click();
    await b('Project overview').waitFor();
  };
  const openTime = async () => {
    await nav('Time entries');
    await b('Add time').click();
    await dialog.waitFor();
  };
  const timesheets = async () => {
    await nav('Time entries');
    await b('Timesheets').click();
    await page.getByRole('heading', { name: 'Timesheets', exact: true }).waitFor();
  };
  const addFields = async (description, duration, withAction) => {
    await select(combo('Project', dialog), projectName);
    await select(combo('Optional subcategory', dialog), category);
    if (withAction) await select(field('Optional action', dialog), actionTitle);
    await fill(dialog.locator('input[name=duration]'), duration);
    await fill(dialog.locator('textarea[name=description]'), description);
    await hold(750);
    await click(b('Add this time entry', dialog));
    await text(description).waitFor();
  };
  return {
    b,
    text,
    dialog,
    field,
    hold,
    move,
    click,
    fill,
    select,
    nav,
    project,
    openTime,
    timesheets,
    addFields,
  };
}

async function plan(page, film, key) {
  const c = controls(page);
  const {
    b,
    text,
    dialog,
    field,
    hold,
    move,
    click,
    fill,
    select,
    nav,
    project,
    openTime,
    timesheets,
    addFields,
  } = c;
  if (film.id === 13 && key === 'create') {
    await project();
    return async () => {
      await click(b('Subcategories'));
      const input = field('Subcategory name', dialog);
      if ((await input.inputValue()) !== '') throw new Error('New subcategory field was not empty');
      await hold(1000);
      await fill(input, category);
      await click(b('Add', dialog));
      await dialog.waitFor({ state: 'hidden' });
      await click(b('Subcategories'));
      await text(category, dialog).waitFor();
    };
  }
  if (film.id === 13 && key === 'record') {
    await openTime();
    return () => addFields(described, '45 min', false);
  }
  if (film.id === 13 && key === 'review') {
    await nav('Time entries');
    const row = page.getByRole('row').filter({ hasText: described });
    await row.waitFor();
    return async () => {
      await move(row);
      if (!(await row.innerText()).includes(category))
        throw new Error('Time history lost its subcategory');
    };
  }
  if (film.id === 14 && key === 'budget') {
    await project();
    return async () => {
      await click(b('Edit project'));
      await fill(dialog.locator('input[name=budget]'), '40 h');
      await fill(dialog.locator('input[name=dueOn]'), day(16));
      await hold(500);
      await click(b('Save', dialog));
      await dialog.waitFor({ state: 'hidden' });
      await text('Remaining budget').waitFor();
    };
  }
  if (film.id === 14 && key === 'action') {
    await project();
    await b('Actions').click();
    await b('New action').waitFor();
    return async () => {
      await click(b('New action'));
      await fill(dialog.locator('input[name=title]'), actionTitle);
      await select(dialog.locator('select[name=taskId]'), category);
      await select(dialog.locator('select[name=assigneeId]'), 'Jordan Lee');
      await fill(dialog.locator('input[name=startOn]'), day(1));
      await fill(dialog.locator('input[name=dueOn]'), day(7));
      await fill(dialog.locator('input[name=estimate]'), '6 h');
      await hold(650);
      await click(b('Save', dialog));
      await dialog.waitFor({ state: 'hidden' });
      await text(actionTitle).waitFor();
    };
  }
  if (film.id === 14 && key === 'link') {
    await openTime();
    return () => addFields(linkedDescription, '30 min', true);
  }
  if (film.id === 15 && key === 'period') {
    await project();
    await b('Gantt').click();
    await page.getByRole('region', { name: 'Gantt chart', exact: true }).waitFor();
    return async () => {
      await select(page.locator('.schedule-window select'), '3 months');
      await hold(1000);
      await select(page.locator('.schedule-window select'), 'Custom dates');
      await fill(field('Through'), day(20));
      await text('Review identity concepts').waitFor();
    };
  }
  if (film.id === 15 && (key === 'capacity' || key === 'estimate')) {
    await nav('Projects');
    await b('Workload').click();
    const table = page.getByRole('region', { name: 'Workload by person', exact: true });
    await table.waitFor();
    return async () => {
      if (key === 'capacity') {
        await fill(page.locator('.capacity-input'), '4');
        await text('Over capacity', table).first().waitFor();
      } else {
        const jordan = table.getByRole('row').filter({ hasText: 'Jordan Lee' });
        const amount = jordan.locator('td small[title="Estimated amount"]').first();
        await amount.waitFor();
        await move(amount);
      }
    };
  }
  if (film.id === 15 && key === 'rate') {
    await nav('Team');
    const rate = b('Edit hourly rate for Jordan Lee');
    await rate.waitFor();
    return async () => {
      await click(rate);
      await fill(dialog.locator('input[name=rate]'), '85');
      await select(dialog.locator('select[name=currency]'), 'EUR');
      await hold(800);
      await click(b('Save', dialog));
      await dialog.waitFor({ state: 'hidden' });
      await text('Hourly rate saved.').waitFor();
    };
  }
  if (film.id === 16 && key === 'submit') {
    await timesheets();
    await b('Submit timesheet').waitFor();
    return async () => {
      await move(b('Submit timesheet'));
      await hold(1300);
      await click(b('Submit timesheet'));
      await text('Timesheet submitted.').waitFor();
    };
  }
  if (film.id === 16 && key === 'approve') {
    await timesheets();
    await b('Jordan Lee').waitFor();
    return async () => {
      await click(b('Jordan Lee'));
      await b('Approve timesheet').waitFor();
      await text('Reviewed the identity concepts').waitFor();
      await move(b('Return for correction'));
      await hold(950);
      await click(b('Approve timesheet'));
      await text('Timesheet approved.').waitFor();
    };
  }
  if (film.id === 16 && key === 'export') {
    await nav('Reports');
    const toggle = page.getByRole('checkbox', { name: 'Approved time only', exact: true });
    await toggle.waitFor();
    return async () => {
      await click(toggle);
      await text('Approved time').waitFor();
      const downloaded = page.waitForEvent('download');
      const [csv] = await Promise.all([downloaded, click(b('CSV'))]);
      const content = await readFile(await csv.path(), 'utf8');
      if (
        !content.includes('Reviewed the identity concepts') ||
        content.includes('Unreviewed planning check')
      )
        throw new Error('Approved CSV contains the wrong entries');
    };
  }
  throw new Error(`No capture plan for ${film.id}/${key}`);
}

const layout = { record: 'fit', budget: 'fit', action: 'fit', link: 'fit', rate: 'fit' };
const browser = await chromium.launch({ headless: true });
try {
  for (const film of selected) {
    const timingPath = `${captures}/${film.id}.json`;
    if (
      record &&
      !force &&
      (await access(timingPath).then(
        () => true,
        () => false,
      ))
    ) {
      console.log(`Existing capture kept: ${film.id}`);
      continue;
    }
    const demo = await workspace(film);
    const markers = [];
    try {
      for (const step of film.steps) {
        const role =
          step.key === 'submit' ? 'member' : step.key === 'approve' ? 'manager' : 'admin';
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          ...(record
            ? {
                recordVideo: {
                  dir: '.cache/updates-recordings',
                  size: { width: 1440, height: 900 },
                },
              }
            : {}),
          locale: 'en-GB',
          timezoneId: timezone,
          reducedMotion: 'reduce',
          acceptDownloads: true,
          storageState: {
            cookies: [],
            origins: [
              { origin: demo.origin, localStorage: [{ name: 'minutrel-language', value: 'en' }] },
            ],
          },
        });
        await context.route(/^https?:/, (route) =>
          new URL(route.request().url()).origin === demo.origin ? route.continue() : route.abort(),
        );
        await context.addCookies([await demo.login(role)]);
        await context.addInitScript(cursor);
        const startRecording = performance.now();
        const page = await context.newPage();
        const video = page.video();
        page.setDefaultTimeout(8500);
        try {
          await page.goto(demo.origin);
          await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
          const action = await plan(page, film, step.key);
          await page.evaluate(() => document.fonts.ready.then(() => undefined));
          if (record) await page.waitForTimeout(450);
          const start = performance.now();
          await action();
          if (record) {
            const voiceSeconds = step.cues.reduce(
              (sum, _, i) => sum + voices[`${film.id}-${step.key}-${i + 1}`].duration,
              0,
            );
            const min = (voiceSeconds + 0.24 * (step.cues.length - 1) + 1.15) * 1000;
            await page.waitForTimeout(Math.max(680, min - (performance.now() - start)));
          }
          const end = performance.now();
          await page.screenshot({ path: `${preflight}/${film.id}-${step.key}.png` });
          if (record) {
            const path = `${captures}/${film.id}-${step.key}.webm`;
            await context.close();
            await video.saveAs(path);
            await video.delete();
            markers.push({
              key: step.key,
              file: path.slice('public/'.length),
              trim: Math.max(0, (start - startRecording - 110) / 1000),
              length: (end - start) / 1000,
              layout: layout[step.key] ?? 'wide',
            });
          }
          console.log(`${record ? 'Recorded' : 'Validated'} ${film.id}/${step.key}`);
        } catch (error) {
          console.error(`Capture failed at ${film.id}/${step.key}`);
          console.error(
            (
              await page
                .locator('body')
                .ariaSnapshot()
                .catch(() => '')
            ).slice(-4000),
          );
          throw error;
        } finally {
          await context.close();
        }
      }
      await demo.verify();
      if (record)
        await writeFile(
          timingPath,
          JSON.stringify({ release, viewport: [1440, 900], markers }, null, 2) + '\n',
        );
      console.log(`Verified real app state and outputs: ${film.id}`);
    } finally {
      await demo.app.close();
    }
  }
} finally {
  await browser.close();
}
