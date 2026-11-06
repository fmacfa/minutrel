// SPDX-License-Identifier: AGPL-3.0-or-later
// Données fictives, exclusivement dans .cache/demo. Aucun appel à un fournisseur IA.
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createApp } from '../apps/api/src/app.ts';

process.env.APP_DATA_DIR = resolve('.cache/demo');
await mkdir(process.env.APP_DATA_DIR, { recursive: true, mode: 0o700 });
const app = createApp();
if (!app.store.get('SELECT 1 FROM workspace')) {
  const password = `Demo-${randomBytes(18).toString('base64url')}`;
  const call = async (url, payload, token) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1${url}`,
      payload,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'idempotency-key': randomUUID(),
      },
    });
    if (response.statusCode !== 200) throw new Error(response.body);
    return response.json();
  };
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
  const all = [admin.member.id, camille.id, noa.id];
  const projectData = [
    {
      name: 'Identité Atelier',
      description: 'Une identité claire pour un studio qui prend son envol.',
      color: '#087f75',
    },
    {
      name: 'Site Maison Nord',
      description: 'Imaginer et construire la nouvelle vitrine de Maison Nord.',
      color: '#7f9241',
    },
    {
      name: 'Recherche & exploration',
      description: 'Les idées qui feront avancer les prochains projets.',
      color: '#b3774c',
    },
  ];
  const projects = [];
  for (const p of projectData)
    projects.push(await call('/projects', { ...p, memberIds: all }, admin.token));
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
  for (const [index, duration, description] of [
    [0, '2h30', 'Recherche de pistes et premières intentions graphiques'],
    [1, '1h45', 'Architecture des pages et parcours de navigation'],
    [0, '45 min', 'Échange avec l’équipe sur les propositions'],
    [2, '1h15', 'Exploration des composants et références visuelles'],
    [1, '2h', 'Maquettes de la page d’accueil'],
    [0, '30 min', 'Préparation des livrables et notes de présentation'],
  ]) {
    await call(
      '/time-entries',
      { projectId: projects[index].id, kind: 'duration', workDate: today, duration, description },
      admin.token,
    );
  }
  const login = await call('/auth/login', {
    email: 'camille@minutrel.test',
    password,
    native: true,
  });
  await call(
    '/time-entries',
    {
      projectId: projects[1].id,
      kind: 'duration',
      workDate: today,
      duration: '3h15',
      description: 'Intégration des composants de navigation',
    },
    login.token,
  );
  await call(
    '/notes',
    {
      projectId: projects[0].id,
      workDate: today,
      text: 'Deux pistes graphiques sont prêtes à être présentées. Les retours de l’équipe ont permis de préciser la palette et les usages du signe.',
      shared: true,
    },
    admin.token,
  );
  await call(
    '/notes',
    {
      projectId: projects[1].id,
      workDate: today,
      text: 'La page d’accueil prend forme. Prochaine étape : vérifier le parcours sur petit écran avec l’équipe.',
      shared: false,
    },
    admin.token,
  );
  const summary = await call(
    '/summaries',
    {
      month: today.slice(0, 7),
      text: 'L’identité du studio a avancé avec deux pistes graphiques préparées pour présentation. Le travail sur Maison Nord porte sur l’architecture des pages et les premières maquettes. Une exploration de composants complète ces livrables.',
    },
    admin.token,
  );
  app.store.run(
    "UPDATE summaries SET status='approved',approvedAt=? WHERE id=?",
    app.store.now(),
    summary.id,
  );
  await writeFile(
    resolve(process.env.APP_DATA_DIR, 'access.json'),
    `${JSON.stringify({ email: 'alex@minutrel.test', password, note: 'Accès à la démonstration locale, données entièrement fictives.' }, null, 2)}\n`,
    { mode: 0o600 },
  );
}
await app.close();
console.log('Démonstration locale : http://127.0.0.1:8080');
console.log('Accès de démonstration : .cache/demo/access.json');
const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, APP_PORT: '8080' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
