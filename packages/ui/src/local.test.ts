// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, expect, it, vi } from 'vitest';
import type { TimeEntry } from '@minutrel/contracts';
import { localSpace, timerMutation, type LocalData } from './local-core.ts';
const memory = vi.hoisted(() => ({
  records: new Map<boolean, { revision: number; data: unknown }>(),
}));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: async (command: string, args: Record<string, unknown>) => {
    if (command === 'set_local_mode') return;
    const personal = Boolean(args.personal),
      env = memory.records.get(personal) ?? { revision: 0, data: null };
    if (command === 'offline_read') return structuredClone(env);
    if (command === 'offline_write') {
      if (args.revision !== env.revision) throw new Error('LOCAL_CONFLICT');
      const result = { revision: env.revision + 1, data: structuredClone(args.data) };
      memory.records.set(personal, result);
      return result;
    }
    throw new Error(command);
  },
}));
import { flush, nativeRequest, setMode, startPersonal, syncStatus } from './local.ts';
const data = (personal: boolean) => memory.records.get(personal)!.data as LocalData;
const unavailable = async <T>(): Promise<T> => {
  throw new Error('network disconnected');
};
const ready = () => {
  const d = localSpace('Alex', Math.floor(Date.now() / 1000));
  d.projects = [
    {
      id: crypto.randomUUID(),
      name: 'Travail',
      description: '',
      color: '#087f75',
      archived: false,
      version: 1,
      memberIds: [d.session.member.id],
      tasks: [],
    },
  ];
  return d;
};
beforeEach(() => {
  memory.records.clear();
  setMode(false);
  vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
});
it('fonctionne sans aucun serveur : projets, saisies, notes et comptes rendus locaux', async () => {
  await startPersonal('Moi');
  const project = await nativeRequest<{ id: string }>(unavailable, '/projects', 'POST', {
    name: 'Autonome',
  });
  const key = crypto.randomUUID();
  const input = {
    projectId: project.id,
    kind: 'duration',
    duration: '1h30',
    workDate: '2026-11-06',
    description: 'Travail',
  };
  const a = await nativeRequest<TimeEntry>(unavailable, '/time-entries', 'POST', input, key);
  const b = await nativeRequest<TimeEntry>(unavailable, '/time-entries', 'POST', input, key);
  expect(b.id).toBe(a.id);
  expect(data(true).entries).toHaveLength(1);
  await nativeRequest(unavailable, `/time-entries/${a.id}/description`, 'PATCH', {
    description: 'Texte relu',
    version: a.version,
    reason: 'Précision du travail',
  });
  expect(data(true).audit?.[0]?.detail).toContain('Précision du travail');
  expect(data(true).entries[0]!.seconds).toBe(5400);
  await nativeRequest(unavailable, '/notes', 'POST', {
    projectId: project.id,
    workDate: '2026-11-06',
    text: 'Première note',
  });
  await nativeRequest(unavailable, '/notes', 'POST', {
    projectId: project.id,
    workDate: '2026-11-06',
    text: 'Deuxième note',
  });
  expect(data(true).notes).toHaveLength(2);
  expect(
    (await nativeRequest<{ totalSeconds: number }>(unavailable, '/reports/monthly?month=2026-11'))
      .totalSeconds,
  ).toBe(5400);
  expect(syncStatus().local).toBe(true);
});
it('garde les sous-catégories libres par projet et la description du travail en autonomie', async () => {
  await startPersonal('Moi');
  const project = await nativeRequest<{ id: string; tasks: unknown[] }>(
    unavailable,
    '/projects',
    'POST',
    { name: 'Dossier libre' },
  );
  expect(project.tasks).toEqual([]);
  await expect(
    nativeRequest(unavailable, `/projects/${project.id}/tasks`, 'POST', { name: '  ' }),
  ).rejects.toThrow('Le nom de la sous-catégorie');
  const category = await nativeRequest<{ id: string }>(
    unavailable,
    `/projects/${project.id}/tasks`,
    'POST',
    { name: 'Accompagnement clientèle' },
  );
  const other = await nativeRequest<{ id: string }>(unavailable, '/projects', 'POST', {
    name: 'Autre dossier',
  });
  const input = {
    projectId: project.id,
    taskId: category.id,
    kind: 'duration',
    duration: '25 min',
    workDate: '2026-11-06',
    description: 'Préparation de la proposition pour le client',
  };
  await expect(
    nativeRequest(unavailable, '/time-entries', 'POST', { ...input, projectId: other.id }),
  ).rejects.toThrow('Sous-catégorie introuvable');
  const entry = await nativeRequest<TimeEntry>(unavailable, '/time-entries', 'POST', input);
  expect(entry).toMatchObject({
    taskName: 'Accompagnement clientèle',
    description: input.description,
    seconds: 1500,
  });
  const timer = await nativeRequest<TimeEntry>(unavailable, '/timer/start', 'POST', {
    projectId: project.id,
    taskId: category.id,
  });
  await expect(
    nativeRequest(unavailable, `/tasks/${category.id}`, 'PATCH', { archived: true }),
  ).rejects.toThrow('Terminez le chronomètre');
  vi.setSystemTime(new Date('2026-11-06T12:01:00Z'));
  await nativeRequest(unavailable, '/timer/stop', 'POST', { version: timer.version });
  await nativeRequest(unavailable, `/tasks/${category.id}`, 'PATCH', { archived: true });
  expect(data(true).entries.find((e) => e.id === entry.id)?.taskName).toBe(
    'Accompagnement clientèle',
  );
});
it('conserve les temps et les actions pendant une coupure et après réouverture', async () => {
  const d = ready();
  memory.records.set(false, { revision: 1, data: d });
  const start = await nativeRequest<TimeEntry>(unavailable, '/timer/start', 'POST', {
    projectId: d.projects[0]!.id,
  });
  await flush(unavailable);
  vi.setSystemTime(new Date('2026-11-06T12:03:00Z'));
  await nativeRequest(unavailable, '/timer/stop', 'POST', { version: start.version });
  await flush(unavailable);
  setMode(false);
  const result = await nativeRequest<{ timer: TimeEntry | null }>(unavailable, '/timer');
  expect(result.timer).toBeNull();
  await flush(unavailable);
  expect(data(false).pending[0]!.entry.seconds).toBe(180);
  const remote = async <T>(_path: string, _method?: string, body?: unknown): Promise<T> => {
    const e = (body as { entry: TimeEntry }).entry;
    return {
      entry: { ...data(false).pending[0]!.entry, ...e, version: 1 },
      serverNow: Math.floor(Date.now() / 1000),
    } as T;
  };
  await flush(remote);
  expect(data(false).pending).toHaveLength(0);
  expect(data(false).entries[0]!.seconds).toBe(180);
});
it('conserve l’historique personnel chargé en ligne dans le rapport hors connexion', async () => {
  const d = ready();
  const timestamp = Math.floor(Date.now() / 1000);
  const entry = structuredClone(
    timerMutation(d, 'start', { projectId: d.projects[0]!.id }, timestamp - 180, false),
  );
  const finished = structuredClone(
    timerMutation(d, 'stop', { version: entry.version }, timestamp, false),
  );
  const other = { ...finished, id: crypto.randomUUID(), memberId: crypto.randomUUID() };
  d.entries = [];
  memory.records.set(false, { revision: 1, data: d });
  const remote = async <T>(): Promise<T> => ({ items: [finished, other], total: 2 }) as T;
  await nativeRequest(remote, '/time-entries?memberId=me&month=2026-11');
  // Le cache de cet appareil ne conserve pas les temps des collègues.
  expect(data(false).entries.map((e) => e.id)).toEqual([finished.id]);
  setMode(false);
  const report = await nativeRequest<{ totalSeconds: number }>(
    unavailable,
    '/reports/monthly?month=2026-11',
  );
  expect(report.totalSeconds).toBe(180);
  const list = await nativeRequest<{ items: TimeEntry[] }>(
    unavailable,
    '/time-entries?memberId=me&month=2026-11',
  );
  expect(list.items.map((e) => e.id)).toEqual([finished.id]);
  await expect(
    nativeRequest(unavailable, `/time-entries?month=2026-11&memberId=${other.memberId}`),
  ).rejects.toThrow('Cette vue nécessite le serveur.');
  await expect(
    nativeRequest(unavailable, `/reports/monthly?month=2026-11&memberIds=${other.memberId}`),
  ).rejects.toThrow('Cette vue nécessite le serveur.');
});
it('n’écrit pas la réponse d’une synchronisation dans l’espace personnel ouvert entre-temps', async () => {
  const d = ready();
  memory.records.set(false, { revision: 1, data: d });
  await nativeRequest(unavailable, '/timer/start', 'POST', { projectId: d.projects[0]!.id });
  await flush(unavailable);
  let resolve!: () => void;
  const gate = new Promise<void>((r) => {
    resolve = r;
  });
  const remote = async <T>(): Promise<T> => {
    await gate;
    return { entry: data(false).pending[0]!.entry, serverNow: Math.floor(Date.now() / 1000) } as T;
  };
  const sending = flush(remote);
  await Promise.resolve();
  await startPersonal('Personnel');
  resolve();
  await sending;
  expect(data(true).entries).toHaveLength(0);
  expect(data(true).session.member.name).toBe('Personnel');
  expect(data(false).pending).toHaveLength(0);
});
it('garde un conflit explicite et permet de terminer le temps local avant résolution', async () => {
  const d = ready();
  memory.records.set(false, { revision: 1, data: d });
  const conflict = async <T>(): Promise<T> => {
    throw Object.assign(new Error('Version différente'), { status: 409 });
  };
  const start = await nativeRequest<TimeEntry>(conflict, '/timer/start', 'POST', {
    projectId: d.projects[0]!.id,
  });
  await flush(conflict);
  expect(data(false).conflict).toContain('Version différente');
  vi.setSystemTime(new Date('2026-11-06T12:01:00Z'));
  await nativeRequest(conflict, '/timer/stop', 'POST', { version: start.version });
  expect(data(false).pending[0]!.entry.state).toBe('finished');
});
