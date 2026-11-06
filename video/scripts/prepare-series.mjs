import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import staticFiles from '@fastify/static';
import { createApp } from '../../apps/api/src/app.ts';

const videoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(videoRoot, '..');
process.env.APP_DATA_DIR = resolve(root, '.cache/video-series-en-2026-11-06');
const url = 'http://127.0.0.1:8088';
await mkdir(process.env.APP_DATA_DIR, { recursive: true, mode: 0o700 });
await mkdir(resolve(videoRoot, '.cache'), { recursive: true, mode: 0o700 });
for (const sub of ['brand', 'fonts', 'captures', 'stills']) {
  await mkdir(resolve(videoRoot, 'public', sub), { recursive: true });
}
for (const name of ['minutrel-primary.svg', 'minutrel-reverse.svg', 'minutrel-symbol.svg']) {
  await copyFile(
    resolve(root, 'brand/assets/logos', name),
    resolve(videoRoot, 'public/brand', name),
  );
}
for (const name of [
  'Manrope-Regular.ttf',
  'Manrope-SemiBold.ttf',
  'Manrope-ExtraBold.ttf',
  'OFL.txt',
]) {
  await copyFile(resolve(root, 'brand/fonts', name), resolve(videoRoot, 'public/fonts', name));
}

const app = createApp();
await copyFile(
  resolve(root, 'brand/assets/icons/app-1024.png'),
  resolve(videoRoot, 'public/brand/minutrel-app.png'),
);
app.register(staticFiles, { root: resolve(root, 'apps/web/dist') });
const call = async (path, payload, token) => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1${path}`,
    payload,
    headers: {
      'idempotency-key': randomUUID(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.statusCode !== 200)
    throw new Error(`Demo preparation failed (${path}, ${response.statusCode})`);
  return response.json();
};
const accessPath = resolve(process.env.APP_DATA_DIR, 'access.json');
if (!app.store.get('SELECT 1 FROM workspace')) {
  const password = `Demo-${randomBytes(24).toString('base64url')}`;
  const admin = await call('/setup', {
    setupToken: app.store.setupToken,
    workspaceName: 'Demo Studio',
    name: 'Alex Morgan',
    email: 'alex@minutrel.test',
    password,
    timezone: 'Europe/Paris',
    native: true,
  });
  const camille = await call(
    '/members',
    { name: 'Sam Taylor', email: 'camille@minutrel.test', password, role: 'manager' },
    admin.token,
  );
  const noa = await call(
    '/members',
    { name: 'Jordan Lee', email: 'noa@minutrel.test', password, role: 'contributor' },
    admin.token,
  );
  const members = [admin.member.id, camille.id, noa.id];
  const projects = [];
  for (const p of [
    {
      name: 'Atlas',
      color: '#087f75',
      description: 'A new identity, from first sketches to finished work.',
    },
    {
      name: 'North House website',
      color: '#7f9241',
      description: 'Design a clear, welcoming website that is easy to explore.',
    },
    {
      name: 'Research & exploration',
      color: '#b3774c',
      description: 'Develop ideas for the projects ahead.',
    },
  ])
    projects.push(await call('/projects', { ...p, memberIds: members }, admin.token));
  await call(`/projects/${projects[0].id}/tasks`, { name: 'Design & art direction' }, admin.token);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  for (const [p, duration, description] of [
    [0, '2h30', 'Visual research and creative directions'],
    [1, '1h45', 'Page structure and navigation flows'],
    [0, '45 min', 'Team review of the design proposals'],
    [2, '1h15', 'Component research and visual references'],
    [1, '2h', 'Homepage mockups'],
    [0, '30 min', 'Preparing the presentation files'],
  ])
    await call(
      '/time-entries',
      { projectId: projects[p].id, kind: 'duration', workDate: today, duration, description },
      admin.token,
    );
  const colleague = await call('/auth/login', { email: camille.email, password, native: true });
  await call(
    '/time-entries',
    {
      projectId: projects[1].id,
      kind: 'duration',
      workDate: today,
      duration: '3h15',
      description: 'Building the navigation',
    },
    colleague.token,
  );
  await call(
    '/notes',
    {
      projectId: projects[0].id,
      workDate: today,
      text: 'Two design directions are ready. The team has refined the palette and how the identity will be used.',
      shared: true,
    },
    admin.token,
  );
  const summary = await call(
    '/summaries',
    {
      month: today.slice(0, 7),
      text: 'Atlas has progressed with two creative directions. North House has a clear page structure and its first mockups. Research is shaping the next steps.',
    },
    admin.token,
  );

  await writeFile(accessPath, JSON.stringify({ email: 'alex@minutrel.test', password }), {
    mode: 0o600,
  });
}
const access = JSON.parse(await readFile(accessPath, 'utf8'));
const response = await app.inject({
  method: 'POST',
  url: '/api/v1/auth/login',
  payload: { ...access, native: false },
});
if (response.statusCode !== 200) throw new Error('Demo login failed');
const cookie = response.cookies.find((c) => c.name === 'minutrel');
await writeFile(
  resolve(videoRoot, '.cache/session-series.json'),
  JSON.stringify({
    cookies: [
      {
        name: 'minutrel',
        value: cookie.value,
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [{ origin: url, localStorage: [{ name: 'minutrel-language', value: 'en' }] }],
  }),
  { mode: 0o600 },
);
await app.listen({ host: '127.0.0.1', port: 8089 });
const { createServer, request: proxyRequest } = await import('node:http');
const proxy = createServer((req, res) => {
  const upstream = proxyRequest(
    { host: '127.0.0.1', port: 8089, path: req.url, method: req.method, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
  res.on('close', () => upstream.destroy());
});
let online = true;
await new Promise((resolve) => proxy.listen(8088, '127.0.0.1', resolve));
await writeFile(resolve(videoRoot, '.cache/series-network'), 'online');
const switcher = setInterval(async () => {
  const desired =
    (await readFile(resolve(videoRoot, '.cache/series-network'), 'utf8')).trim() === 'online';
  if (desired === online) return;
  online = desired;
  if (!online) {
    proxy.closeAllConnections();
    proxy.close();
    console.log('Demo network offline');
  } else {
    proxy.listen(8088, '127.0.0.1', () => console.log('Demo network online'));
  }
}, 150);
switcher.unref();
await writeFile(resolve(videoRoot, '.cache/series-demo.pid'), String(process.pid));
console.log(`Video demo ready: ${url} (fictional data only)`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    proxy.closeAllConnections();
    proxy.close();
    void app.close().then(() => process.exit(0));
  });
