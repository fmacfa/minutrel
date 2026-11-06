import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import staticFiles from '@fastify/static';
import { createApp } from '../../apps/api/src/app.ts';

const videoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(videoRoot, '..');
process.env.APP_DATA_DIR = resolve(root, '.cache/video-demo-2026-11-06');
const url = 'http://127.0.0.1:8086';
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
    workspaceName: 'Atelier Démo',
    name: 'Alex Martin',
    email: 'alex@minutrel.test',
    password,
    timezone: 'Europe/Paris',
    native: true,
  });
  const camille = await call(
    '/members',
    { name: 'Camille Moreau', email: 'camille@minutrel.test', password, role: 'manager' },
    admin.token,
  );
  const noa = await call(
    '/members',
    { name: 'Noa Bernard', email: 'noa@minutrel.test', password, role: 'contributor' },
    admin.token,
  );
  const members = [admin.member.id, camille.id, noa.id];
  const projects = [];
  for (const p of [
    {
      name: 'Projet Atlas',
      color: '#087f75',
      description: 'Une nouvelle identité, du premier croquis aux livrables.',
    },
    {
      name: 'Site Maison Nord',
      color: '#7f9241',
      description: 'Concevoir un site clair, accueillant et facile à parcourir.',
    },
    {
      name: 'Recherche & exploration',
      color: '#b3774c',
      description: 'Faire grandir les idées pour les prochains projets.',
    },
  ])
    projects.push(await call('/projects', { ...p, memberIds: members }, admin.token));
  await call(
    `/projects/${projects[0].id}/tasks`,
    { name: 'Design & direction artistique' },
    admin.token,
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  for (const [p, duration, description] of [
    [0, '2h30', 'Recherche de pistes et intentions graphiques'],
    [1, '1h45', 'Architecture des pages et parcours de navigation'],
    [0, '45 min', 'Échange avec l’équipe sur les propositions'],
    [2, '1h15', 'Exploration des composants et références'],
    [1, '2h', 'Maquettes de la page d’accueil'],
    [0, '30 min', 'Préparation des livrables de présentation'],
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
      description: 'Intégration de la navigation',
    },
    colleague.token,
  );
  await call(
    '/notes',
    {
      projectId: projects[0].id,
      workDate: today,
      text: 'Deux pistes graphiques sont prêtes. La palette et les usages du signe ont été précisés avec l’équipe.',
      shared: true,
    },
    admin.token,
  );
  const summary = await call(
    '/summaries',
    {
      month: today.slice(0, 7),
      text: 'Le projet Atlas a avancé avec deux pistes graphiques. Maison Nord prend forme avec une architecture validée et de premières maquettes. La recherche nourrit les prochaines étapes.',
    },
    admin.token,
  );
  app.store.run(
    "UPDATE summaries SET status='approved',approvedAt=? WHERE id=?",
    app.store.now(),
    summary.id,
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
  resolve(videoRoot, '.cache/session.json'),
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
    origins: [],
  }),
  { mode: 0o600 },
);
await app.listen({ host: '127.0.0.1', port: 8086 });
console.log(`Video demo ready: ${url} (fictional data only)`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
