// SPDX-License-Identifier: AGPL-3.0-or-later
import { it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from './app.ts';
import { Store } from './store.ts';

it('migre le schéma 1 en conservant le chronomètre, puis restaure la sauvegarde, le taux et la clé', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'minutrel-persistence-'));
  const path = join(temp, 'original', 'minutrel.sqlite');
  let now = Math.floor(Date.now() / 1000);
  let app = createApp({ path, now: () => now });
  let closed = false;
  try {
    const setupToken = (await readFile(join(temp, 'original', 'setup-token'), 'utf8')).trim();
    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: {
        setupToken,
        workspaceName: 'Atelier persistant',
        name: 'Alex',
        email: 'alex@exemple.test',
        password: 'Une phrase secrète solide',
        native: true,
      },
    });
    expect(setup.statusCode).toBe(200);
    const token = setup.json<{ token: string }>().token;
    const memberId = setup.json<{ member: { id: string } }>().member.id;
    const headers = { authorization: `Bearer ${token}`, 'idempotency-key': crypto.randomUUID() };
    const project = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers,
        payload: { name: 'Projet persistant' },
      })
    ).json<{ id: string }>();
    const start = await app.inject({
      method: 'POST',
      url: '/api/v1/timer/start',
      headers,
      payload: { projectId: project.id },
    });
    expect(start.statusCode).toBe(200);
    const encrypted = app.store.encrypt('clé-fournisseur-fictive');
    const originalKey = app.store.key.toString('base64url');
    await app.close();
    closed = true;
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      DROP TABLE member_rates;
      DROP INDEX entries_action;
      DROP INDEX entries_project_state;
      ALTER TABLE entries DROP COLUMN actionId;
      DROP TABLE project_actions;
      DROP TABLE timesheets;
      ALTER TABLE projects DROP COLUMN budgetSeconds;
      ALTER TABLE projects DROP COLUMN dueOn;
      PRAGMA user_version=1;
    `);
    legacy.close();
    now += 120;
    app = createApp({ path, now: () => now });
    closed = false;
    expect(app.store.key.toString('base64url')).toBe(originalKey);
    expect(app.store.decrypt(encrypted)).toBe('clé-fournisseur-fictive');
    expect(app.store.get('PRAGMA user_version')).toMatchObject({ user_version: 3 });
    expect(app.store.get('SELECT budgetSeconds,dueOn FROM projects')).toMatchObject({
      budgetSeconds: null,
      dueOn: null,
    });
    const active = await app.inject({ url: '/api/v1/timer', headers });
    expect(active.statusCode).toBe(200);
    expect(active.json().timer.state).toBe('running');
    const finished = await app.inject({
      method: 'POST',
      url: '/api/v1/timer/stop',
      headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
      payload: { version: 1 },
    });
    expect(finished.json().seconds).toBe(120);
    const hourlyRate = { amountMinor: 6250, currency: 'EUR' };
    const rate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/members/${memberId}/hourly-rate`,
      headers,
      payload: { hourlyRate },
    });
    expect(rate.statusCode).toBe(200);
    const assistant = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp-tokens',
      headers,
      payload: { name: 'Assistant de recette', scopes: ['projects.read'] },
    });
    expect(assistant.statusCode).toBe(200);
    const output = join(temp, 'snapshot');
    const restored = join(temp, 'restored');
    execFileSync(
      process.execPath,
      [resolve('scripts/backup.mjs'), '--data', join(temp, 'original'), '--out', output],
      { stdio: 'pipe' },
    );
    execFileSync(
      process.execPath,
      [resolve('scripts/backup.mjs'), '--restore', output, '--data', restored],
      { stdio: 'pipe' },
    );
    const restoredStore = new Store({ path: join(restored, 'minutrel.sqlite') });
    try {
      expect(restoredStore.decrypt(encrypted)).toBe('clé-fournisseur-fictive');
      expect(restoredStore.get('SELECT COUNT(*) AS count FROM sessions')).toEqual({ count: 0 });
      expect(restoredStore.get('SELECT COUNT(*) AS count FROM tokens')).toEqual({ count: 0 });
      expect(
        restoredStore.get(
          'SELECT amountMinor,currency FROM member_rates WHERE memberId=?',
          memberId,
        ),
      ).toEqual(hourlyRate);
      expect(restoredStore.get<{ seconds: number }>('SELECT seconds FROM entries')!.seconds).toBe(
        120,
      );
    } finally {
      restoredStore.close();
    }
    expect(() =>
      execFileSync(
        process.execPath,
        [resolve('scripts/backup.mjs'), '--restore', output, '--data', restored],
        { stdio: 'pipe' },
      ),
    ).toThrow();
    expect(() => new Store({ path: ':memory:', key: Buffer.alloc(12) })).toThrow('32 octets');
  } finally {
    if (!closed) await app.close();
    await rm(temp, { recursive: true, force: true });
  }
});

it('refuse une base plus récente sans en rétrograder le numéro de schéma', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'minutrel-version-'));
  const path = join(temp, 'future.sqlite');
  try {
    const future = new DatabaseSync(path);
    future.exec('PRAGMA user_version=4');
    future.close();
    expect(() => new Store({ path })).toThrow('plus récente');
    const check = new DatabaseSync(path);
    expect(check.prepare('PRAGMA user_version').get()!.user_version).toBe(4);
    check.close();
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
