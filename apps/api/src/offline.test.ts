// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { randomUUID } from 'node:crypto';
import type { Project, TimeEntry } from '@minutrel/contracts';
let app: ReturnType<typeof createApp>;
let token: string;
let project: Project;
let now = 1800000000;
const call = (url: string, payload?: Record<string, unknown>, auth = token, key = randomUUID()) =>
  app.inject({
    method: payload === undefined ? 'GET' : 'POST',
    url,
    headers: { authorization: `Bearer ${auth}`, 'idempotency-key': key },
    payload,
  });
beforeEach(async () => {
  now = 1800000000;
  app = createApp({ path: ':memory:', setupToken: 'initial-local-secret', now: () => now });
  const setup = await call(
    '/api/v1/setup',
    {
      setupToken: 'initial-local-secret',
      workspaceName: 'Test',
      name: 'Alex',
      email: 'alex@example.test',
      password: 'Test-password-123456',
      native: true,
    },
    '',
  );
  token = setup.json().token;
  project = (
    await call('/api/v1/projects', { name: 'Projet', memberIds: [setup.json().member.id] })
  ).json();
});
afterEach(() => app.close());
it('produit des en-têtes de rapport anglais et allemands sans traduire les données utilisateur', async () => {
  for (const [language, label] of [
    ['en', 'Month'],
    ['de', 'Monat'],
  ]) {
    const result = await call('/api/v1/exports', { month: '2026-11', format: 'csv', language });
    expect(result.statusCode, result.body).toBe(200);
    const downloaded = await call(result.json().url);
    expect(downloaded.body).toContain(`"${label}"`);
  }
  expect(
    (await call('/api/v1/exports', { month: '2026-11', format: 'csv', language: 'xx' })).statusCode,
  ).toBe(400);
});
const snapshot = (state = 'finished') => ({
  mutationId: randomUUID(),
  baseVersion: null as number | null,
  entry: {
    id: randomUUID(),
    projectId: project.id,
    taskId: null,
    description: 'Travail local',
    state,
    segments: [{ startedAt: now - 120, endedAt: state === 'running' ? null : now - 60 }],
  },
});
it('refuse un projet non affecté, un temps d’autrui et un webhook administrateur non personnel', async () => {
  const member = (
    await call('/api/v1/members', {
      name: 'Autre',
      email: 'other@example.test',
      password: 'Test-password-123456',
      role: 'contributor',
    })
  ).json();
  const memberToken = (
    await call(
      '/api/v1/auth/login',
      { email: member.email, password: 'Test-password-123456', native: true },
      '',
    )
  ).json().token;
  expect((await call('/api/v1/sync/time-entry', snapshot(), memberToken)).statusCode).toBe(403);
  const owned = snapshot();
  expect((await call('/api/v1/sync/time-entry', owned)).statusCode).toBe(200);
  const assigned = await app.inject({
    method: 'PATCH',
    url: `/api/v1/projects/${project.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: project.name,
      description: project.description,
      color: project.color,
      archived: false,
      version: project.version,
      memberIds: [member.id],
    },
  });
  expect(assigned.statusCode, assigned.body).toBe(200);
  expect(
    (
      await call(
        '/api/v1/sync/time-entry',
        { ...owned, mutationId: randomUUID(), baseVersion: 1 },
        memberToken,
      )
    ).statusCode,
  ).toBe(403);
  const personal = (
    await call('/api/v1/mcp-tokens', { name: 'Hook', days: 7, scopes: ['work.draft_own'] })
  ).json().token;
  expect(
    (
      await call(
        '/hooks/work-notes',
        { projectId: project.id, workDate: '2026-11-05', text: 'Privé' },
        personal,
      )
    ).statusCode,
  ).toBe(403);
  expect(app.store.get<{ n: number }>('SELECT COUNT(*) n FROM notes')!.n).toBe(0);
});
it('synchronise les segments exacts et reconnaît un envoi même après 30 jours', async () => {
  const data = snapshot();
  const first = await call('/api/v1/sync/time-entry', data);
  expect(first.statusCode, first.body).toBe(200);
  expect(first.json().entry.seconds).toBe(60);
  now += 31 * 86400;
  const login = await call(
    '/api/v1/auth/login',
    { email: 'alex@example.test', password: 'Test-password-123456', native: true },
    '',
  );
  token = login.json().token;
  const again = await call('/api/v1/sync/time-entry', data);
  expect(again.json()).toEqual(first.json());
  expect(app.store.get<{ n: number }>('SELECT COUNT(*) n FROM entries')!.n).toBe(1);
  expect(
    (
      await call('/api/v1/sync/time-entry', {
        ...data,
        entry: { ...data.entry, description: 'Autre' },
      })
    ).statusCode,
  ).toBe(409);
});
it('conserve les données du serveur lors d’un conflit de version ou de propriétaire', async () => {
  const data = snapshot('running');
  const first = (await call('/api/v1/sync/time-entry', data)).json().entry as TimeEntry;
  const pause = await call('/api/v1/timer/pause', { version: first.version });
  expect(pause.statusCode).toBe(200);
  const stale = {
    ...data,
    mutationId: randomUUID(),
    baseVersion: 1,
    entry: {
      ...data.entry,
      state: 'finished',
      segments: [{ startedAt: now - 120, endedAt: now - 30 }],
    },
  };
  expect((await call('/api/v1/sync/time-entry', stale)).statusCode).toBe(409);
  expect((await call('/api/v1/timer')).json().timer.state).toBe('paused');
});
it('refuse doubles chronomètres, chevauchements, segments futurs et réécriture historique', async () => {
  const data = snapshot('running');
  expect((await call('/api/v1/sync/time-entry', data)).statusCode).toBe(200);
  expect((await call('/api/v1/sync/time-entry', snapshot('running'))).statusCode).toBe(409);
  expect(
    (
      await call('/api/v1/sync/time-entry', {
        ...snapshot(),
        entry: { ...snapshot().entry, segments: [{ startedAt: now + 100, endedAt: now + 200 }] },
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await call('/api/v1/sync/time-entry', {
        ...data,
        mutationId: randomUUID(),
        baseVersion: 1,
        entry: {
          ...data.entry,
          state: 'finished',
          segments: [{ startedAt: now - 100, endedAt: now - 20 }],
        },
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await call('/api/v1/sync/time-entry', {
        ...data,
        mutationId: randomUUID(),
        baseVersion: 1,
        entry: {
          ...data.entry,
          state: 'finished',
          segments: [{ startedAt: now - 120, endedAt: now - 20 }],
        },
      })
    ).statusCode,
  ).toBe(200);
});
it('transfère les saisies locales manuelles une seule fois et revalide les droits', async () => {
  const payload = {
    localId: randomUUID(),
    input: {
      projectId: project.id,
      kind: 'duration',
      workDate: '2026-11-05',
      duration: '1h30',
      description: 'Avant connexion',
    },
  };
  const a = await call('/api/v1/sync/import', payload);
  expect(a.statusCode, a.body).toBe(200);
  expect((await call('/api/v1/sync/import', payload)).json().id).toBe(a.json().id);
  expect(
    (await call('/api/v1/sync/import', { ...payload, input: { ...payload.input, duration: '2h' } }))
      .statusCode,
  ).toBe(409);
});
it('reçoit un webhook privé, idempotent et révocable, sans commander les heures', async () => {
  const created = await call('/api/v1/mcp-tokens', {
    name: 'Automatisation',
    days: 7,
    scopes: ['work.draft_own'],
  });
  const secret = created.json().token;
  const payload = { projectId: project.id, workDate: '2026-11-05', text: 'Avancée à relire' };
  const key = randomUUID();
  const first = await call('/hooks/work-notes', payload, secret, key);
  expect(first.statusCode, first.body).toBe(200);
  expect(first.json()).toMatchObject({ shared: false, source: 'assistant' });
  expect((await call('/hooks/work-notes', payload, secret, key)).json().id).toBe(first.json().id);
  expect(app.store.get<{ n: number }>('SELECT COUNT(*) n FROM notes')!.n).toBe(1);
  expect(app.store.get<{ n: number }>('SELECT COUNT(*) n FROM entries')!.n).toBe(0);
  expect((await call('/hooks/work-notes', { ...payload, shared: true }, secret)).statusCode).toBe(
    400,
  );
  expect((await call('/api/v1/projects', undefined, secret)).statusCode).toBe(401);
  app.store.run('DELETE FROM tokens');
  expect((await call('/hooks/work-notes', payload, secret)).statusCode).toBe(401);
});
