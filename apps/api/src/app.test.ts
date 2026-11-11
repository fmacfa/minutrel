// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from './app.ts';
import { unzipSync, strFromU8 } from 'fflate';
import type {
  Member,
  Project,
  ProjectAction,
  ProjectOverview,
  TimeEntry,
  TimesheetDetail,
} from '@minutrel/contracts';

const initialTime = Math.floor(Date.parse('2026-11-05T15:00:00Z') / 1000);
let now = initialTime;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let sequence = 0;
const body = <T = Record<string, unknown>>(response: { body: string }): T =>
  JSON.parse(response.body) as T;
const req = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  token = adminToken,
  extra: Record<string, string> = {},
) =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    payload,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'idempotency-key': `test-request-${++sequence}`,
      ...extra,
    },
  });
async function addMember(role = 'contributor') {
  const email = `membre${++sequence}@exemple.test`;
  const res = await req('POST', '/members', {
    name: `Membre ${sequence}`,
    email,
    password: 'Un mot de passe solide 42',
    role,
  });
  expect(res.statusCode).toBe(200);
  const member = body<Member>(res);
  const login = await req(
    'POST',
    '/auth/login',
    { email, password: 'Un mot de passe solide 42', native: true },
    '',
  );
  expect(login.statusCode).toBe(200);
  return { member, token: body<{ token: string }>(login).token };
}
async function addProject(memberIds: string[] = []) {
  const res = await req('POST', '/projects', { name: 'Site vitrine', memberIds });
  expect(res.statusCode).toBe(200);
  return body<Project>(res);
}
async function manual(
  projectId: string,
  token = adminToken,
  overrides: Record<string, unknown> = {},
) {
  const res = await req(
    'POST',
    '/time-entries',
    {
      projectId,
      description: 'Conception des interfaces',
      kind: 'duration',
      workDate: '2026-11-04',
      duration: '1h30',
      ...overrides,
    },
    token,
  );
  expect(res.statusCode, res.body).toBe(200);
  return body<TimeEntry>(res);
}
beforeEach(async () => {
  now = initialTime;
  app = createApp({ path: ':memory:', setupToken: 'secret-installation-local', now: () => now });
  const res = await req(
    'POST',
    '/setup',
    {
      setupToken: 'secret-installation-local',
      workspaceName: 'Atelier',
      timezone: 'Europe/Paris',
      name: 'Alex',
      email: 'alex@exemple.test',
      password: 'Un mot de passe solide 42',
      native: true,
    },
    '',
  );
  expect(res.statusCode, res.body).toBe(200);
  adminToken = body<{ token: string }>(res).token;
});
afterEach(async () => {
  await app.close();
});

describe('Planification et feuilles de temps', () => {
  it('réserve les taux à l’administrateur et distingue un taux zéro d’un taux retiré', async () => {
    const employee = await addMember();
    const manager = await addMember('manager');
    const path = `/members/${employee.member.id}/hourly-rate`;
    const hourlyRate = { amountMinor: 5525, currency: 'CHF' };
    const list = async (token = adminToken) =>
      body<Member[]>(await req('GET', '/members', undefined, token)).find(
        (m) => m.id === employee.member.id,
      );
    expect((await list())?.hourlyRate).toBeNull();
    expect((await req('PATCH', path, { hourlyRate }, manager.token)).statusCode).toBe(403);
    expect((await req('PATCH', path, { hourlyRate }, employee.token)).statusCode).toBe(403);
    expect(
      (await req('PATCH', path, { hourlyRate: { ...hourlyRate, amountMinor: -1 } })).statusCode,
    ).toBe(400);
    expect(
      (await req('PATCH', path, { hourlyRate: { ...hourlyRate, currency: 'XYZ' } })).statusCode,
    ).toBe(400);
    expect(
      (await req('PATCH', `/members/${crypto.randomUUID()}/hourly-rate`, { hourlyRate }))
        .statusCode,
    ).toBe(404);
    expect(body(await req('PATCH', path, { hourlyRate }))).toEqual({ hourlyRate });
    expect((await list())?.hourlyRate).toEqual(hourlyRate);
    expect(await list(manager.token)).not.toHaveProperty('hourlyRate');
    expect(body(await req('GET', '/me', undefined, employee.token)).member).not.toHaveProperty(
      'hourlyRate',
    );
    expect((await req('GET', '/reports/monthly?month=2026-11')).body).not.toContain('hourlyRate');
    expect((await req('GET', '/workspace/export')).body).not.toContain('hourlyRate');
    const free = { amountMinor: 0, currency: 'EUR' };
    expect((await req('PATCH', path, { hourlyRate: free })).statusCode).toBe(200);
    expect((await list())?.hourlyRate).toEqual(free);
    expect((await req('PATCH', path, { hourlyRate: null })).statusCode).toBe(200);
    expect((await list())?.hourlyRate).toBeNull();
  });

  it('garde le budget et le lien d’action, avec des droits distincts sur les temps et la planification', async () => {
    const assigned = await addMember();
    const outside = await addMember();
    const p = await addProject([assigned.member.id]);
    const projectForm = { name: p.name, memberIds: p.memberIds, archived: false };
    const updated = await req('PATCH', `/projects/${p.id}`, {
      ...projectForm,
      version: p.version,
      budgetSeconds: 36000,
      dueOn: '2026-11-30',
    });
    expect(updated.statusCode, updated.body).toBe(200);
    const v = body<Project>(updated).version;
    expect(
      body(
        await req('PATCH', `/projects/${p.id}`, { ...projectForm, version: v, name: 'Refonte' }),
      ),
    ).toMatchObject({ budgetSeconds: 36000, dueOn: '2026-11-30' });
    const category = body<{ id: string }>(
      await req('POST', `/projects/${p.id}/tasks`, { name: 'Recette' }),
    );
    const url = `/projects/${p.id}/actions`;
    const input = {
      title: 'Vérifier les parcours',
      taskId: category.id,
      assigneeId: assigned.member.id,
      startOn: '2026-11-02',
      dueOn: '2026-11-06',
      estimateSeconds: 18000,
    };
    expect((await req('POST', url, { ...input, dueOn: '2026-11-01' })).statusCode).toBe(400);
    expect((await req('POST', url, { ...input, assigneeId: outside.member.id })).statusCode).toBe(
      400,
    );
    expect((await req('POST', url, input, assigned.token)).statusCode).toBe(403);
    const created = await req('POST', url, input);
    expect(created.statusCode, created.body).toBe(200);
    const action = body<ProjectAction>(created);
    const path = `/project-actions/${action.id}`;
    expect(action).toMatchObject({ ...input, version: 1, status: 'todo' });
    expect(
      body(await req('GET', `/project-actions?projectId=${p.id}`, undefined, assigned.token)),
    ).toEqual([action]);
    expect(body(await req('GET', '/project-actions', undefined, outside.token))).toEqual([]);
    expect(
      (await req('GET', `/projects/${p.id}/overview`, undefined, outside.token)).statusCode,
    ).toBe(403);
    expect(
      (await req('PATCH', path, { version: 1, title: 'Changement interdit' }, assigned.token))
        .statusCode,
    ).toBe(403);
    expect(
      body(await req('PATCH', path, { version: 1, status: 'in_progress' }, assigned.token)),
    ).toMatchObject({ status: 'in_progress', version: 2 });
    expect(
      (await req('PATCH', path, { version: 1, status: 'done' }, assigned.token)).statusCode,
    ).toBe(409);
    expect(
      (await req('POST', '/timer/start', { projectId: p.id, actionId: action.id }, assigned.token))
        .statusCode,
    ).toBe(400);
    const linked = await manual(p.id, assigned.token, { taskId: category.id, actionId: action.id });
    const timer = await req(
      'POST',
      '/timer/start',
      { projectId: p.id, taskId: category.id, actionId: action.id },
      assigned.token,
    );
    expect(body(timer)).toMatchObject({ actionId: action.id });
    now += 90;
    expect(body(await req('POST', '/timer/stop', { version: 1 }, assigned.token))).toMatchObject({
      seconds: 90,
      actionName: input.title,
    });
    await manual(p.id);
    expect((await req('PATCH', path, { version: 2, taskId: null })).statusCode).toBe(409);
    const corrected = await req(
      'PATCH',
      `/time-entries/${linked.id}`,
      {
        projectId: p.id,
        taskId: category.id,
        workDate: '2026-11-04',
        kind: 'duration',
        duration: '1h30',
        description: 'Contrôle des liens',
        version: linked.version,
        reason: 'Précision du contenu',
      },
      assigned.token,
    );
    expect(body(corrected)).toMatchObject({
      actionId: action.id,
      description: 'Contrôle des liens',
    });
    const overview = `/projects/${p.id}/overview`;
    const team = body<ProjectOverview>(
      await req('GET', `${overview}?month=2026-11&taskId=${category.id}`),
    );
    expect(team).toMatchObject({
      scope: 'team',
      totalSeconds: 10890,
      filteredSeconds: 5490,
      entryCount: 2,
      categories: expect.arrayContaining([
        { taskId: category.id, seconds: 5490 },
        { taskId: null, seconds: 5400 },
      ]),
    });
    expect(
      team.entries.some(
        (e) => e.id === linked.id && e.actionName === input.title && e.reportSeconds === 5400,
      ),
    ).toBe(true);
    expect(body(await req('GET', overview, undefined, assigned.token))).toMatchObject({
      scope: 'personal',
      totalSeconds: 5490,
    });
    expect(
      (await req('GET', `${overview}?memberId=${outside.member.id}`, undefined, assigned.token))
        .statusCode,
    ).toBe(403);
    expect(body(await req('GET', '/workspace/export'))).toMatchObject({
      project_actions: [{ id: action.id }],
      time_entries: expect.arrayContaining([
        expect.objectContaining({ id: linked.id, action_id: action.id }),
      ]),
    });
  });

  it('verrouille la feuille, découpe les exports approuvés par mois et autorise la correction après retour', async () => {
    const employee = await addMember();
    const manager = await addMember('manager');
    const p = await addProject([employee.member.id]);
    const sheet = `/timesheets/${employee.member.id}`;
    const weekStart = '2026-10-26';
    const next = '2026-11-02';
    const october = await manual(p.id, employee.token, {
      workDate: '2026-10-30',
      duration: '20 min',
      description: 'Bilan octobre',
    });
    await manual(p.id, employee.token, {
      kind: 'interval',
      startedAt: '2026-10-31T23:30:00+01:00',
      endedAt: '2026-11-01T00:30:00+01:00',
      description: 'À cheval sur deux mois',
    });
    await manual(p.id, employee.token, {
      kind: 'interval',
      startedAt: '2026-11-01T23:30:00+01:00',
      endedAt: '2026-11-02T00:30:00+01:00',
      description: 'À cheval sur deux semaines',
    });
    await manual(p.id, employee.token, { description: 'Temps de novembre à valider' });
    expect((await req('GET', '/timesheets?weekStart=2026-10-27')).statusCode).toBe(400);
    expect(
      body(await req('GET', `/timesheets?weekStart=${weekStart}`, undefined, employee.token)),
    ).toMatchObject([{ memberId: employee.member.id, status: 'draft', seconds: 6600 }]);
    expect(
      (
        await req(
          'GET',
          `/timesheets/${manager.member.id}?weekStart=${weekStart}`,
          undefined,
          employee.token,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await req('PATCH', sheet, { weekStart, version: 0, status: 'submitted' }, manager.token))
        .statusCode,
    ).toBe(403);
    const active = await req('POST', '/timer/start', { projectId: p.id }, employee.token);
    expect(active.statusCode).toBe(200);
    expect(
      (
        await req(
          'PATCH',
          sheet,
          { weekStart: next, version: 0, status: 'submitted' },
          employee.token,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      body(
        await req('PATCH', sheet, { weekStart, version: 0, status: 'submitted' }, employee.token),
      ),
    ).toMatchObject({ status: 'submitted', version: 1 });
    expect(
      (await req('PATCH', sheet, { weekStart, version: 1, status: 'approved' }, employee.token))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await req(
          'PATCH',
          `/time-entries/${october.id}/description`,
          { version: 1, description: 'Changement', reason: 'Raison valide' },
          employee.token,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await req(
          'POST',
          '/sync/import',
          {
            localId: crypto.randomUUID(),
            input: {
              projectId: p.id,
              kind: 'duration',
              workDate: '2026-10-29',
              duration: '45 min',
              description: 'Saisie hors ligne',
            },
          },
          employee.token,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      body(await req('GET', '/reports/monthly?month=2026-11&approvedOnly=true')),
    ).toMatchObject({ approvedOnly: true, totalSeconds: 0 });
    expect(
      body(await req('PATCH', sheet, { weekStart, version: 1, status: 'approved' }, manager.token)),
    ).toMatchObject({ status: 'approved', version: 2, reviewerName: manager.member.name });
    const review = body<TimesheetDetail>(await req('GET', `${sheet}?weekStart=${weekStart}`));
    expect(review.entries.reduce((total, e) => total + e.reportSeconds, 0)).toBe(6600);
    expect(
      body(await req('GET', '/reports/monthly?month=2026-10&approvedOnly=true')),
    ).toMatchObject({ totalSeconds: 3000 });
    expect(
      body(await req('GET', '/reports/monthly?month=2026-11&approvedOnly=true')),
    ).toMatchObject({ totalSeconds: 3600, entryCount: 2, activeTimers: 0 });
    const delayedStart = Date.parse('2026-10-27T09:00:00+01:00') / 1000;
    const delayed = await req(
      'POST',
      '/sync/time-entry',
      {
        mutationId: crypto.randomUUID(),
        baseVersion: null,
        entry: {
          id: crypto.randomUUID(),
          projectId: p.id,
          taskId: null,
          description: 'Temps différé',
          state: 'finished',
          segments: [{ startedAt: delayedStart, endedAt: delayedStart + 600 }],
        },
      },
      employee.token,
    );
    expect(delayed.statusCode, delayed.body).toBe(409);
    expect(delayed.body).toContain('Demandez sa réouverture');
    expect(body(await req('GET', '/reports/monthly?month=2026-11'))).toMatchObject({
      totalSeconds: 10800,
      activeTimers: 1,
    });
    expect(
      (
        await req(
          'POST',
          '/exports',
          { month: '2026-11', format: 'csv', approvedOnly: true },
          manager.token,
        )
      ).statusCode,
    ).toBe(403);
    const exported = body<{ url: string; filename: string }>(
      await req('POST', '/exports', {
        month: '2026-11',
        format: 'csv',
        language: 'en',
        approvedOnly: true,
      }),
    );
    expect(exported.filename).toBe('minutrel-2026-11-approved.csv');
    expect(
      (await req('PATCH', sheet, { weekStart, version: 2, status: 'returned' }, manager.token))
        .statusCode,
    ).toBe(400);
    expect(
      body(
        await req(
          'PATCH',
          sheet,
          { weekStart, version: 2, status: 'returned', reason: 'Préciser le bilan' },
          manager.token,
        ),
      ),
    ).toMatchObject({ status: 'returned', reason: 'Préciser le bilan', version: 3 });
    expect(
      body(await req('GET', '/reports/monthly?month=2026-11&approvedOnly=true')),
    ).toMatchObject({ totalSeconds: 0 });
    const csv = await req('GET', exported.url.replace('/api/v1', ''));
    expect(csv.headers['content-disposition']).toContain(exported.filename);
    expect(csv.body).toContain('À cheval sur deux mois');
    expect(csv.body).not.toContain('Temps de novembre à valider');
    const edited = await req(
      'PATCH',
      `/time-entries/${october.id}/description`,
      { version: 1, description: 'Bilan détaillé', reason: 'Préciser le bilan' },
      employee.token,
    );
    expect(edited.statusCode, edited.body).toBe(200);
    now += 60;
    expect((await req('POST', '/timer/stop', { version: 1 }, employee.token)).statusCode).toBe(200);
    expect(body(await req('GET', '/workspace/export'))).toMatchObject({
      timesheets: [
        { member_id: employee.member.id, status: 'returned', reason: 'Préciser le bilan' },
      ],
    });
    expect(
      body(
        await req('PATCH', sheet, { weekStart, version: 3, status: 'submitted' }, employee.token),
      ),
    ).toMatchObject({ status: 'submitted', reason: '', version: 4 });
  });
});

describe('Installation, sessions et équipe', () => {
  it('annonce la version et protège les données sans session', async () => {
    expect(body(await req('GET', '/instance', undefined, ''))).toMatchObject({
      name: 'Minutrel',
      version: '0.1.0',
    });
    expect((await req('GET', '/members', undefined, '')).statusCode).toBe(401);
    expect(
      (
        await req(
          'POST',
          '/setup',
          {
            setupToken: 'faux',
            workspaceName: 'Autre',
            name: 'Inconnu',
            email: 'a@b.test',
            password: 'Un autre mot de passe',
          },
          '',
        )
      ).statusCode,
    ).toBe(409);
    expect(body(await req('GET', '/health/ready', undefined, ''))).toEqual({ status: 'ok' });
  });
  it('utilise un cookie HttpOnly, un jeton CSRF et refuse une origine tierce', async () => {
    const login = await req(
      'POST',
      '/auth/login',
      { email: 'alex@exemple.test', password: 'Un mot de passe solide 42' },
      '',
    );
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.body).not.toContain('"token"');
    const cookie = `minutrel=${login.cookies[0]!.value}`;
    const csrf = body<{ csrf: string }>(login).csrf;
    expect((await req('POST', '/projects', { name: 'Essai' }, '', { cookie })).statusCode).toBe(
      403,
    );
    expect(
      (await req('POST', '/projects', { name: 'Essai' }, '', { cookie, 'x-csrf-token': csrf }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await req('POST', '/projects', { name: 'Essai' }, '', {
          cookie,
          'x-csrf-token': csrf,
          origin: 'https://malveillant.test',
        })
      ).statusCode,
    ).toBe(403);
  });
  it('refuse un mauvais mot de passe et révoque réellement les sessions', async () => {
    expect(
      (
        await req(
          'POST',
          '/auth/login',
          { email: 'absent@exemple.test', password: 'incorrect' },
          '',
        )
      ).statusCode,
    ).toBe(401);
    const user = await addMember();
    expect((await req('POST', '/projects', { name: 'Interdit' }, user.token)).statusCode).toBe(403);
    expect((await req('GET', '/members', undefined, user.token)).statusCode).toBe(403);
    expect(
      (
        await req('PATCH', `/members/${user.member.id}`, {
          ...user.member,
          createdAt: undefined,
          id: undefined,
          enabled: false,
        })
      ).statusCode,
    ).toBe(200);
    expect((await req('GET', '/me', undefined, user.token)).statusCode).toBe(401);
    const me = body<{ member: Member }>(await req('GET', '/me')).member;
    expect(
      (
        await req('PATCH', `/members/${me.id}`, {
          name: me.name,
          email: me.email,
          role: 'contributor',
          enabled: true,
        })
      ).statusCode,
    ).toBe(400);
  });
  it('change le mot de passe sans exposer les secrets', async () => {
    const user = await addMember();
    expect(
      (
        await req(
          'POST',
          '/me/password',
          { currentPassword: 'incorrect', password: 'Un nouveau mot de passe' },
          user.token,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req(
          'POST',
          '/me/password',
          { currentPassword: 'Un mot de passe solide 42', password: 'Un nouveau mot de passe' },
          user.token,
        )
      ).statusCode,
    ).toBe(200);
    expect((await req('GET', '/me', undefined, user.token)).statusCode).toBe(401);
    expect(
      (
        await req(
          'POST',
          '/auth/login',
          { email: user.member.email, password: 'Un nouveau mot de passe', native: true },
          '',
        )
      ).statusCode,
    ).toBe(200);
    expect((await req('GET', '/members')).body).not.toContain('password');
  });
});
describe('Projets et chronomètres partagés', () => {
  it('utilise des sous-catégories nommées librement et les conserve avec le travail exporté', async () => {
    const user = await addMember();
    const project = await addProject([user.member.id]);
    expect(project.tasks).toEqual([]);
    expect((await req('POST', `/projects/${project.id}/tasks`, { name: '   ' })).statusCode).toBe(
      400,
    );
    expect(
      (await req('POST', `/projects/${project.id}/tasks`, { name: 'Libre' }, user.token))
        .statusCode,
    ).toBe(403);
    const category = body<{ id: string; name: string }>(
      await req('POST', `/projects/${project.id}/tasks`, { name: 'Accompagnement clientèle' }),
    );
    const other = await addProject([user.member.id]);
    expect(
      (await req('POST', '/timer/start', { projectId: other.id, taskId: category.id }, user.token))
        .statusCode,
    ).toBe(400);
    const description = 'Préparation de la proposition pour le client';
    const entry = await manual(project.id, user.token, { taskId: category.id, description });
    expect(entry.taskName).toBe(category.name);
    expect(entry.description).toBe(description);
    expect(
      (await req('PATCH', `/tasks/${category.id}`, { name: category.name, archived: true }))
        .statusCode,
    ).toBe(200);
    const prepared = body<{ url: string }>(
      await req('POST', '/exports', { month: '2026-11', format: 'csv', language: 'en' }),
    );
    const csv = await req('GET', prepared.url.replace('/api/v1', ''));
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('"Subcategory"');
    expect(csv.body).toContain(category.name);
    expect(csv.body).toContain(description);
  });
  it('respecte les affectations et les tâches du projet', async () => {
    const a = await addMember();
    const b = await addMember();
    const p = await addProject([a.member.id]);
    expect(body<Project[]>(await req('GET', '/projects', undefined, b.token))).toEqual([]);
    expect((await req('POST', '/timer/start', { projectId: p.id }, b.token)).statusCode).toBe(403);
    const task = body<{ id: string }>(
      await req('POST', `/projects/${p.id}/tasks`, { name: 'Design' }),
    );
    const started = body<TimeEntry>(
      await req('POST', '/timer/start', { projectId: p.id, taskId: task.id }, a.token),
    );
    expect(started.taskName).toBe('Design');
    expect(
      (await req('PATCH', `/tasks/${task.id}`, { name: 'Design', archived: true })).statusCode,
    ).toBe(409);
    expect(
      (
        await req('PATCH', `/projects/${p.id}`, {
          name: p.name,
          description: '',
          color: p.color,
          memberIds: [],
          archived: false,
          version: p.version,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await req('PATCH', `/members/${a.member.id}`, {
          name: a.member.name,
          email: a.member.email,
          role: a.member.role,
          enabled: false,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('compte exactement les segments, exclut les pauses et résiste aux doubles clics', async () => {
    const p = await addProject();
    const key = 'start-identique-123';
    const first = await req('POST', '/timer/start', { projectId: p.id }, adminToken, {
      'idempotency-key': key,
    });
    const retry = await req('POST', '/timer/start', { projectId: p.id }, adminToken, {
      'idempotency-key': key,
    });
    expect(body(retry)).toEqual(body(first));
    expect(
      (
        await req(
          'POST',
          '/timer/start',
          { projectId: p.id, description: 'différent' },
          adminToken,
          { 'idempotency-key': key },
        )
      ).statusCode,
    ).toBe(409);
    expect((await req('POST', '/timer/start', { projectId: p.id })).statusCode).toBe(409);
    now += 90;
    const paused = body<TimeEntry>(await req('POST', '/timer/pause', { version: 1 }));
    expect(paused.seconds).toBe(90);
    expect((await req('POST', '/timer/stop', { version: 1 })).statusCode).toBe(409);
    now += 600;
    expect((await req('POST', '/timer/resume', { version: 2 })).statusCode).toBe(200);
    now += 30;
    const stopped = body<TimeEntry>(await req('POST', '/timer/stop', { version: 3 }));
    expect(stopped.seconds).toBe(120);
    expect(stopped.segments).toHaveLength(2);
    expect(stopped.state).toBe('finished');
    expect(body<{ timer: unknown }>(await req('GET', '/timer')).timer).toBeNull();
    const report = body<{ totalSeconds: number }>(
      await req('GET', '/reports/monthly?month=2026-11'),
    );
    expect(report.totalSeconds).toBe(120);
  });
  it('gère deux clients simultanés et jette un temps vide sans inventer de durée', async () => {
    const p = await addProject();
    const outcomes = await Promise.all([
      req('POST', '/timer/start', { projectId: p.id }),
      req('POST', '/timer/start', { projectId: p.id }),
    ]);
    expect(outcomes.map((o) => o.statusCode).sort()).toEqual([200, 409]);
    expect(body<TimeEntry>(await req('POST', '/timer/stop', { version: 1 })).state).toBe('deleted');
    expect(body<{ total: number }>(await req('GET', '/time-entries')).total).toBe(0);
  });
  it('impose des versions sur les projets et permet l’archivage après arrêt', async () => {
    const p = await addProject();
    const input = {
      name: 'Nouveau nom',
      description: '',
      color: p.color,
      memberIds: [],
      archived: true,
      version: p.version,
    };
    expect((await req('PATCH', `/projects/${p.id}`, input)).statusCode).toBe(200);
    expect((await req('PATCH', `/projects/${p.id}`, input)).statusCode).toBe(409);
    expect((await req('POST', '/timer/start', { projectId: p.id })).statusCode).toBe(400);
  });
});
describe('Saisies et rapports', () => {
  it('protège les temps d’autrui et audite les corrections avec motif', async () => {
    const a = await addMember();
    const b = await addMember();
    const p = await addProject([a.member.id, b.member.id]);
    const e = await manual(p.id, a.token);
    expect(
      body<{ total: number }>(await req('GET', '/time-entries', undefined, b.token)).total,
    ).toBe(0);
    expect(
      (await req('GET', `/time-entries?memberId=${a.member.id}`, undefined, b.token)).statusCode,
    ).toBe(403);
    const change = {
      projectId: p.id,
      kind: 'duration',
      duration: '2h',
      workDate: '2026-11-04',
      description: 'Correction',
      version: e.version,
      reason: 'Erreur de saisie',
    };
    expect((await req('PATCH', `/time-entries/${e.id}`, change, b.token)).statusCode).toBe(403);
    expect(
      (await req('PATCH', `/time-entries/${e.id}`, { ...change, reason: '' })).statusCode,
    ).toBe(400);
    const edited = body<TimeEntry>(await req('PATCH', `/time-entries/${e.id}`, change));
    expect(edited.seconds).toBe(7200);
    expect((await req('PATCH', `/time-entries/${e.id}`, change)).statusCode).toBe(409);
    expect((await req('GET', '/audit')).body).toContain('Erreur de saisie');
    expect(
      (await req('DELETE', `/time-entries/${e.id}`, { version: 2, reason: 'Doublon confirmé' }))
        .statusCode,
    ).toBe(200);
    expect(
      body<{ total: number }>(await req('GET', '/time-entries', undefined, a.token)).total,
    ).toBe(0);
  });
  it('détecte les chevauchements et interdit les intervalles futurs', async () => {
    const p = await addProject();
    const interval = {
      kind: 'interval',
      startedAt: '2026-11-04T10:00:00Z',
      endedAt: '2026-11-04T11:00:00Z',
    };
    await manual(p.id, adminToken, interval);
    const input = { projectId: p.id, description: '', ...interval };
    expect((await req('POST', '/time-entries', input)).statusCode).toBe(409);
    expect((await req('POST', '/time-entries', { ...input, allowOverlap: true })).statusCode).toBe(
      200,
    );
    expect(
      (await req('POST', '/time-entries', { ...input, endedAt: '2027-01-01T11:00:00Z' }))
        .statusCode,
    ).toBe(400);
  });
  it('produit CSV/PDF/ZIP depuis le même instantané, sans les brouillons privés', async () => {
    const user = await addMember();
    const p = await addProject([user.member.id]);
    await manual(p.id, user.token, { description: '=FORMULE()' });
    const shared = await req(
      'POST',
      '/notes',
      { projectId: p.id, workDate: '2026-11-04', text: 'Livrable remis', shared: true },
      user.token,
    );
    expect(shared.statusCode, shared.body).toBe(200);
    await req(
      'POST',
      '/notes',
      { projectId: p.id, workDate: '2026-11-04', text: 'Brouillon privé', shared: false },
      user.token,
    );
    const summary = body<{ id: string }>(
      await req(
        'POST',
        '/summaries',
        { month: '2026-11', text: 'Interface validée avec le client.' },
        user.token,
      ),
    );
    expect(
      (
        await req(
          'PATCH',
          `/summaries/${summary.id}`,
          { text: 'Interface validée avec le client.', status: 'approved' },
          user.token,
        )
      ).statusCode,
    ).toBe(200);
    const created = body<{ url: string }>(
      await req('POST', '/exports', {
        month: '2026-11',
        format: 'csv',
        memberIds: [user.member.id],
      }),
    );
    await manual(p.id, user.token, { duration: '30 min' });
    const csv = await app.inject({
      url: created.url,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(csv.body).toContain('5400');
    expect(csv.body).not.toContain('7200');
    expect(csv.body).toContain("'=FORMULE()");
    expect(csv.body).toContain('Interface validée');
    expect(csv.body).not.toContain('Brouillon privé');
    for (const format of ['pdf', 'zip'] as const) {
      const item = body<{ url: string }>(
        await req('POST', '/exports', { month: '2026-11', format, memberIds: [user.member.id] }),
      );
      const output = await app.inject({
        url: item.url,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(output.statusCode, output.body.slice(0, 100)).toBe(200);
      if (format === 'pdf') expect(output.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
      else {
        const files = unzipSync(output.rawPayload);
        expect(Object.keys(files)).toContain(`membres/${user.member.id}.pdf`);
        expect(strFromU8(files['temps.csv']!)).toContain('7200');
      }
    }
    expect(
      (await req('POST', '/exports', { month: '2026-11', format: 'pdf' }, user.token)).statusCode,
    ).toBe(403);
    now += 86401;
    expect(
      (await app.inject({ url: created.url, headers: { authorization: `Bearer ${adminToken}` } }))
        .statusCode,
    ).toBe(404);
  });
  it('révoque les jetons MCP et ne les retourne qu’à leur création', async () => {
    const res = await req('POST', '/mcp-tokens', {
      name: 'Codex',
      scopes: ['projects.read', 'work.draft_own'],
    });
    expect(res.statusCode, res.body).toBe(200);
    const created = body<{ id: string; token: string }>(res);
    expect(created.token).toMatch(/^mcp_/);
    expect((await req('GET', '/mcp-tokens')).body).not.toContain(created.token);
    expect((await req('DELETE', `/mcp-tokens/${created.id}`)).statusCode).toBe(200);
    expect(body(await req('GET', '/mcp-tokens'))).toEqual([]);
  });
});

describe('Synchronisation et limites HTTP', () => {
  it('identifie le client derrière un proxy de confiance configuré', async () => {
    const { vi } = await import('vitest');
    vi.stubEnv('APP_TRUSTED_PROXIES', '192.0.2.1');
    const proxied = createApp({ path: ':memory:' });
    try {
      const ips: string[] = [];
      proxied.addHook('onRequest', async (request) => {
        ips.push(request.ip);
      });
      const first = await proxied.inject({
        url: '/api/v1/health/live',
        remoteAddress: '192.0.2.1',
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });
      const second = await proxied.inject({
        url: '/api/v1/health/live',
        remoteAddress: '192.0.2.1',
        headers: { 'x-forwarded-for': '203.0.113.2' },
      });
      expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
      expect(ips).toEqual(['203.0.113.1', '203.0.113.2']);
    } finally {
      vi.unstubAllEnvs();
      await proxied.close();
    }
  });
  it('livre les changements par SSE, contrôle la session et libère la connexion', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const abort = new AbortController();
    const response = await fetch(`${address}/api/v1/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: abort.signal,
    });
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const reader = response.body!.getReader();
    try {
      expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: connected');
      const change = reader.read();
      await addProject();
      expect(new TextDecoder().decode((await change).value)).toContain('event: change');
      const closed = reader.read();
      await req('POST', '/auth/logout', {});
      expect((await closed).done).toBe(true);
      expect(app.store.events.listenerCount('change')).toBe(0);
    } finally {
      abort.abort();
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  });
  it('détecte une session expirée pendant un heartbeat SSE', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const abort = new AbortController();
    const response = await fetch(`${address}/api/v1/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: abort.signal,
    });
    const reader = response.body!.getReader();
    try {
      await reader.read();
      const heartbeat = reader.read();
      vi.advanceTimersByTime(25000);
      expect(new TextDecoder().decode((await heartbeat).value)).toContain('heartbeat');
      now += 31 * 86400;
      const closed = reader.read();
      vi.advanceTimersByTime(25000);
      expect((await closed).done).toBe(true);
    } finally {
      abort.abort();
      await reader.cancel().catch(() => {});
      reader.releaseLock();
      vi.useRealTimers();
    }
  });
  it('limite les tentatives et répond sans détails internes aux erreurs', async () => {
    for (let i = 0; i < 10; i++)
      expect(
        (await req('POST', '/auth/login', { email: 'alex@exemple.test', password: 'faux' }, ''))
          .statusCode,
      ).toBe(401);
    expect(
      (await req('POST', '/auth/login', { email: 'alex@exemple.test', password: 'faux' }, ''))
        .statusCode,
    ).toBe(429);
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/time-entries',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    expect(invalid.statusCode).toBe(400);
    expect((await req('GET', '/reports/monthly?month=2026-99')).statusCode).toBe(400);
    app.store.db.exec('DROP TABLE providers');
    const failed = await req('GET', '/providers');
    expect(failed.statusCode).toBe(500);
    expect(failed.body).not.toContain('providers');
  });
});
describe('Gestion quotidienne complète', () => {
  it('gère les rôles, les tâches, la description d’un temps et la résolution administrateur', async () => {
    const user = await addMember();
    const manager = await addMember('manager');
    const p = await addProject([user.member.id]);
    const task = body<{ id: string }>(
      await req('POST', `/projects/${p.id}/tasks`, { name: 'Préparer' }, manager.token),
    );
    expect(
      (
        await req(
          'PATCH',
          `/tasks/${task.id}`,
          { name: 'Préparation', archived: true },
          manager.token,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await req(
          'PATCH',
          `/tasks/${task.id}`,
          { name: 'Préparation', archived: false },
          manager.token,
        )
      ).statusCode,
    ).toBe(200);
    const start = body<TimeEntry>(
      await req('POST', '/timer/start', { projectId: p.id, taskId: task.id }, user.token),
    );
    now += 61;
    const viewed = body<{ timer: TimeEntry }>(await req('GET', `/members/${user.member.id}/timer`));
    expect(viewed.timer.id).toBe(start.id);
    expect(
      (
        await req('POST', `/members/${user.member.id}/timer/stop`, {
          version: 1,
          reason: 'Session oubliée à finaliser',
        })
      ).statusCode,
    ).toBe(200);
    const result = body<TimeEntry>(
      await req(
        'PATCH',
        `/time-entries/${start.id}/description`,
        { version: 2, description: 'Livrable terminé', reason: 'Précision du résultat' },
        manager.token,
      ),
    );
    expect(result.kind).toBe('timer');
    expect(result.seconds).toBe(61);
    expect(result.segments).toHaveLength(1);
    expect(
      (
        await req('POST', `/members/${user.member.id}/password`, {
          password: 'Un nouveau mot de passe',
        })
      ).statusCode,
    ).toBe(200);
    expect((await req('GET', '/me', undefined, user.token)).statusCode).toBe(401);
    expect(
      (await req('PATCH', '/workspace', { name: 'Nouvel atelier', timezone: 'Europe/London' }))
        .statusCode,
    ).toBe(400);
    expect(
      (await req('PATCH', '/workspace', { name: 'Nouvel atelier', timezone: 'Europe/Paris' }))
        .statusCode,
    ).toBe(200);
    expect((await req('GET', '/members', undefined, manager.token)).statusCode).toBe(200);
    expect(
      (
        await req('PATCH', `/projects/${p.id}`, {
          name: p.name,
          description: 'Prêt',
          color: '#087f75',
          memberIds: [user.member.id],
          archived: true,
          version: p.version,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await req('PATCH', `/members/${user.member.id}`, {
          name: user.member.name,
          email: user.member.email,
          role: 'manager',
          enabled: false,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      body<{ members: { id: string; seconds: number }[] }>(
        await req('GET', '/reports/monthly?month=2026-11'),
      ).members.find((m) => m.id === user.member.id)?.seconds,
    ).toBe(61);
  });
  it('permet la relecture d’une note sans publier le brouillon et exporte sans secrets', async () => {
    const p = await addProject();
    const e = await manual(p.id);
    const note = body<{ id: string }>(
      await req('POST', '/notes', {
        projectId: p.id,
        workDate: '2026-11-04',
        text: 'Version à relire',
      }),
    );
    const summary = body<{ id: string }>(
      await req('POST', '/summaries', { month: '2026-11', text: 'Compte rendu de la période' }),
    );
    expect(
      (await req('PATCH', `/summaries/${summary.id}`, { text: 'Encore privé', status: 'draft' }))
        .statusCode,
    ).toBe(200);
    expect(
      (await req('PATCH', `/notes/${note.id}`, { text: 'Note relue et partagée', shared: true }))
        .statusCode,
    ).toBe(200);
    const exported = await req('GET', '/workspace/export');
    expect(exported.statusCode).toBe(200);
    const data = body<{
      schema_version: number;
      time_entries: { id: string }[];
      work_notes: { text: string }[];
    }>(exported);
    expect(data.schema_version).toBe(2);
    expect(data.time_entries[0]!.id).toBe(e.id);
    expect(data.work_notes[0]!.text).toBe('Note relue et partagée');
    expect(exported.body).not.toContain('password');
    expect(exported.body).not.toContain(adminToken);
    expect(exported.body).not.toContain('Encore privé');
    expect((await req('DELETE', `/notes/${note.id}`)).statusCode).toBe(200);
    expect(body(await req('GET', '/notes'))).toEqual([]);
    expect(
      (
        await req('POST', '/time-entries', {
          projectId: p.id,
          description: '',
          kind: 'duration',
          workDate: '2026-11-04',
          duration: '1,30',
        })
      ).statusCode,
    ).toBe(400);
    await req('POST', '/timer/start', { projectId: p.id });
    expect((await req('GET', '/workspace/export')).statusCode).toBe(409);
  });
  it('compare les agrégats SQL aux secondes d’un mois traversé par un intervalle', async () => {
    const p = await addProject();
    await manual(p.id, adminToken, {
      kind: 'interval',
      startedAt: '2026-10-31T22:30:00Z',
      endedAt: '2026-11-01T00:30:00Z',
      description: 'À cheval sur deux mois',
    });
    const oct = body<{ totalSeconds: number }>(await req('GET', '/reports/monthly?month=2026-10'));
    const nov = body<{ totalSeconds: number }>(await req('GET', '/reports/monthly?month=2026-11'));
    expect(oct.totalSeconds).toBe(1800);
    expect(nov.totalSeconds).toBe(5400);
    expect(
      body<{ total: number }>(await req('GET', '/time-entries?month=2026-10&limit=1')).total,
    ).toBe(1);
    expect(
      body<{ items: TimeEntry[] }>(await req('GET', '/time-entries?month=2026-12')).items,
    ).toEqual([]);
  });
});

it('refuse une reprise quand l’horloge recule sans créer de segment incohérent', async () => {
  const p = await addProject();
  await req('POST', '/timer/start', { projectId: p.id });
  now += 60;
  expect((await req('POST', '/timer/pause', { version: 1 })).statusCode).toBe(200);
  now -= 10;
  expect((await req('POST', '/timer/resume', { version: 2 })).statusCode).toBe(409);
  const timer = body<{ timer: TimeEntry }>(await req('GET', '/timer')).timer;
  expect(timer.state).toBe('paused');
  expect(timer.seconds).toBe(60);
  expect(timer.segments).toHaveLength(1);
});

it('ne crée pas deux durées manuelles quand une même saisie est rejouée après une coupure', async () => {
  const p = await addProject();
  const payload = {
    projectId: p.id,
    kind: 'duration',
    duration: '45 min',
    workDate: '2026-11-04',
    description: 'Saisie à réponse perdue',
  };
  const headers = { 'idempotency-key': 'manual-form-intent-stable' };
  const first = await req('POST', '/time-entries', payload, adminToken, headers);
  const retry = await req('POST', '/time-entries', payload, adminToken, headers);
  expect(first.statusCode).toBe(200);
  expect(body<TimeEntry>(retry).id).toBe(body<TimeEntry>(first).id);
  expect(body<{ total: number }>(await req('GET', '/time-entries')).total).toBe(1);
});
