// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { invoke } from '@tauri-apps/api/core';
import type {
  Project,
  ProjectAction,
  Session,
  TimeEntry,
  WorkNote,
  WorkSummary,
} from '@minutrel/contracts';
import { parseDuration } from '@minutrel/domain';
import { dateInZone, instantSeconds, validDate, validTimezone } from '@minutrel/domain/reports';
import {
  acknowledge,
  currentTimer,
  localEntryAction,
  localOverview,
  localReport,
  localSpace,
  timerMutation,
  type LocalData,
} from './local-core.ts';

type Remote = <T>(path: string, method?: string, body?: unknown, key?: string) => Promise<T>;
interface Envelope {
  revision: number;
  data: LocalData | null;
}
export interface SyncStatus {
  local: boolean;
  offline: boolean;
  pending: number;
  conflict: string;
}
let personal = false;
let networkDown = false;
let snapshot: LocalData | null = null;
let syncing: Promise<void> | null = null;
export const syncStatus = (): SyncStatus => ({
  local: personal,
  offline: networkDown,
  pending: snapshot?.pending.length ?? 0,
  conflict: snapshot?.conflict ?? '',
});
export function setMode(local: boolean) {
  personal = local;
  networkDown = false;
  snapshot = null;
}
async function read(local = personal): Promise<Envelope> {
  return invoke('offline_read', { personal: local });
}
async function change<T>(fn: (data: LocalData) => T, notify = true, local = personal): Promise<T> {
  for (let i = 0; i < 12; i++) {
    const env = await read(local);
    if (!env.data)
      throw new Error(tr('Connectez-vous une première fois pour préparer le mode hors connexion.'));
    const result = fn(env.data);
    try {
      const saved = await invoke<Envelope>('offline_write', {
        personal: local,
        revision: env.revision,
        data: env.data,
        notify,
      });
      if (local === personal) snapshot = saved.data;
      return result;
    } catch (e) {
      if (!String(e).includes('LOCAL_CONFLICT')) throw e;
    }
  }
  throw new Error(tr('Une autre fenêtre modifie vos données. Réessayez.'));
}
export async function startPersonal(name = tr('Moi')) {
  const env = await read(true);
  if (!env.data)
    await invoke('offline_write', {
      personal: true,
      revision: env.revision,
      data: localSpace(name, Math.floor(Date.now() / 1000)),
      notify: false,
    });
  await invoke('set_local_mode', { local: true });
  setMode(true);
}
export async function leavePersonal() {
  await invoke('set_local_mode', { local: false });
  setMode(false);
}
export async function pendingBackup() {
  const env = await read();
  return JSON.stringify(env.data, null, 2);
}
export async function archiveConflict() {
  await change(
    (d) => {
      if (
        currentTimer(d)?.id &&
        d.pending.some((p) => p.entry.id === currentTimer(d)?.id && p.entry.state === 'running')
      )
        throw new Error(tr('Terminez votre temps local avant de résoudre le conflit.'));
      d.archives.push(structuredClone(d.pending));
      d.entries = d.entries.filter((e) => !d.pending.some((p) => p.entry.id === e.id));
      d.pending = [];
      d.conflict = '';
    },
    true,
    false,
  );
}
function now(data: LocalData) {
  return Math.floor(Date.now() / 1000 + data.offset);
}
function canFallback(e: unknown) {
  return !(e instanceof Error && 'status' in e);
}
export async function flush(remote: Remote) {
  if (personal) return;
  if (syncing) return syncing;
  syncing = (async () => {
    const env = await read(false);
    if (!personal) snapshot = env.data;
    if (!env.data || env.data.conflict) return;
    const owner = env.data.session.member.id;
    for (let i = 0; i < 1000; i++) {
      const latest = (await read(false)).data;
      if (latest?.session.member.id !== owner) return;
      const item = latest.pending[0];
      if (!item) return;
      try {
        const entry = {
          id: item.entry.id,
          projectId: item.entry.projectId,
          taskId: item.entry.taskId,
          ...(item.entry.actionId ? { actionId: item.entry.actionId } : {}),
          description: item.entry.description,
          state: item.entry.state,
          segments: item.entry.segments,
        };
        const accepted =
          item.entry.kind === 'timer'
            ? await remote<{ entry: TimeEntry; serverNow: number }>(
                '/sync/time-entry',
                'POST',
                { mutationId: item.mutationId, baseVersion: item.baseVersion, entry },
                item.mutationId,
              )
            : await remote<TimeEntry>(
                '/sync/import',
                'POST',
                {
                  localId: item.entry.id,
                  input: { ...manualPayload(item.entry), allowOverlap: item.allowOverlap ?? false },
                },
                item.mutationId,
              ).then((entry) => ({ entry, serverNow: entry.updatedAt }));
        await change(
          (d) => {
            if (d.session.member.id !== owner) throw new Error('ACCOUNT_CHANGED');
            acknowledge(d, item, accepted.entry);
            d.lastOnline = accepted.serverNow;
            d.offset = accepted.serverNow - Date.now() / 1000;
          },
          true,
          false,
        );
        networkDown = false;
      } catch (e) {
        if (canFallback(e)) {
          networkDown = true;
          return;
        }
        const status = (e as { status?: number }).status;
        if (status === 401) throw e;
        await change(
          (d) => {
            if (d.session.member.id === owner)
              d.conflict = e instanceof Error ? e.message : String(e);
          },
          true,
          false,
        );
        return;
      }
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
async function cacheGet(path: string, result: unknown) {
  if (path === '/me') {
    const s = result as Session;
    const env = await read(false);
    if (!env.data) {
      const d = localSpace(s.member.name, s.serverNow);
      d.session = s;
      d.lastOnline = s.serverNow;
      d.offset = s.serverNow - Date.now() / 1000;
      await invoke('offline_write', {
        personal: false,
        revision: env.revision,
        data: d,
        notify: false,
      });
      snapshot = d;
    } else
      await change(
        (d) => {
          const offset = s.serverNow - Date.now() / 1000;
          const identityChanged =
            JSON.stringify({
              member: d.session.member,
              workspace: d.session.workspace,
              csrf: d.session.csrf,
            }) !== JSON.stringify({ member: s.member, workspace: s.workspace, csrf: s.csrf });
          if (
            identityChanged ||
            s.serverNow - d.lastOnline >= 300 ||
            Math.abs(offset - d.offset) > 2
          ) {
            d.session = s;
            d.lastOnline = s.serverNow;
            d.offset = offset;
          }
        },
        false,
        false,
      );
  } else if (path === '/projects')
    await change(
      (d) => {
        d.projects = result as Project[];
      },
      false,
      false,
    );
  else if (path === '/project-actions' || path.startsWith('/project-actions?'))
    await change(
      (d) => {
        const projectId = new URLSearchParams(path.split('?')[1]).get('projectId');
        const retained = projectId
          ? (d.projectActions ?? []).filter((a) => a.projectId !== projectId)
          : [];
        d.projectActions = [...retained, ...(result as ProjectAction[])];
      },
      false,
      false,
    );
  else if (path === '/timer')
    await change(
      (d) => {
        const t = (result as { timer: TimeEntry | null }).timer;
        const pendingIds = new Set(d.pending.map((p) => p.entry.id));
        d.entries = d.entries.filter(
          (e) => pendingIds.has(e.id) || e.state === 'finished' || e.state === 'deleted',
        );
        if (t && !pendingIds.has(t.id)) {
          d.entries = d.entries.filter((e) => e.id !== t.id);
          d.entries.unshift(t);
        }
      },
      false,
      false,
    );
  else if (
    path.startsWith('/time-entries?') &&
    new URLSearchParams(path.split('?')[1]).get('memberId') === 'me'
  )
    await change(
      (d) => {
        const received = (result as { items: TimeEntry[] }).items.filter(
          (e) => e.memberId === d.session.member.id,
        );
        const ids = new Set([...received.map((e) => e.id), ...d.pending.map((p) => p.entry.id)]);
        d.entries = [
          ...d.pending.map((p) => p.entry),
          ...received.filter((e) => !d.pending.some((p) => p.entry.id === e.id)),
          ...d.entries.filter((e) => !ids.has(e.id)),
        ].slice(0, 5000);
      },
      false,
      false,
    );
  else if (path === '/notes')
    await change(
      (d) => {
        d.notes = result as WorkNote[];
      },
      false,
      false,
    );
  else if (path === '/summaries')
    await change(
      (d) => {
        d.summaries = result as WorkSummary[];
      },
      false,
      false,
    );
}
export async function nativeRequest<T>(
  remote: Remote,
  path: string,
  method = 'GET',
  input?: unknown,
  key?: string,
): Promise<T> {
  if (personal) return personalRequest(path, method, input, key) as Promise<T>;
  if (method === 'POST' && /^\/timer\/(start|pause|resume|stop)$/.test(path)) {
    const result = await change(
      (d) => {
        if (d.conflict && path === '/timer/start')
          throw new Error(
            tr('Résolvez le conflit de synchronisation avant de démarrer un nouveau temps.'),
          );
        return timerMutation(
          d,
          path.split('/')[2] as 'start',
          input as Record<string, unknown>,
          now(d),
          true,
        );
      },
      true,
      false,
    );
    void flush(remote).catch(() => {});
    return result as T;
  }
  if (method === 'POST' && path === '/time-entries') {
    const result = await change(
      (d) => {
        const existing = d.entries.find((e) => e.id === key);
        if (existing) return existing;
        const entry = manual(d, input as Record<string, unknown>);
        if (key) entry.id = key;
        d.entries.unshift(entry);
        d.pending.push({
          allowOverlap: Boolean((input as Record<string, unknown>).allowOverlap),
          mutationId: crypto.randomUUID(),
          baseVersion: null,
          entry: structuredClone(entry),
        });
        return entry;
      },
      true,
      false,
    );
    void flush(remote).catch(() => {});
    return result as T;
  }
  if (
    method === 'PATCH' &&
    path.startsWith('/timesheets/') &&
    (input as { status?: string })?.status === 'submitted'
  ) {
    await flush(remote);
    if ((await read(false)).data?.pending.length)
      throw new Error(tr('Synchronisez vos temps avant de soumettre la feuille.'));
  }
  try {
    // La file part avant la lecture canonique, sans écraser un état local en attente.
    if (path === '/timer') {
      const env = await read();
      if (env.data?.pending.length) {
        snapshot = env.data;
        void flush(remote).catch(() => {});
        return { timer: currentTimer(env.data), serverNow: now(env.data) } as T;
      }
    }
    const result = await remote<T>(path, method, input, key);
    networkDown = false;
    if (method === 'GET') await cacheGet(path, result);
    if (path === '/timer' && (await read()).data?.pending.length) {
      const d = (await read()).data!;
      snapshot = d;
      return { timer: currentTimer(d), serverNow: now(d) } as T;
    }
    return result;
  } catch (e) {
    if (!canFallback(e)) throw e;
    networkDown = true;
    const env = await read();
    snapshot = env.data;
    if (!env.data || Date.now() / 1000 - env.data.lastOnline > 30 * 86400) throw e;
    if (method === 'GET') return cachedRequest(env.data, path) as T;
    throw new Error(
      tr('Cette action nécessite le serveur. Le chronomètre reste utilisable hors connexion.'),
      { cause: e },
    );
  }
}
function manualPayload(e: TimeEntry) {
  return {
    projectId: e.projectId,
    taskId: e.taskId,
    ...(e.actionId ? { actionId: e.actionId } : {}),
    description: e.description,
    kind: e.kind,
    ...(e.kind === 'duration'
      ? { duration: `${e.seconds / 60} min`, workDate: e.workDate }
      : {
          startedAt: new Date(e.segments[0]!.startedAt * 1000).toISOString(),
          endedAt: new Date(e.segments[0]!.endedAt! * 1000).toISOString(),
        }),
  };
}
function cachedRequest(d: LocalData, path: string): unknown {
  const url = new URL(`https://local.invalid${path}`);
  const p = url.pathname;
  const requestedMembers = [
    url.searchParams.get('memberId') ?? '',
    ...(url.searchParams.get('memberIds')?.split(',') ?? []),
  ].filter(Boolean);
  if (requestedMembers.some((id) => id !== 'me' && id !== d.session.member.id))
    throw new Error(tr('Cette vue nécessite le serveur. Vos temps locaux sont conservés.'));
  if (p === '/setup') return { required: false };
  if (p === '/me') return { ...d.session, serverNow: now(d) };
  if (p === '/projects') return d.projects;
  if (p === '/project-actions') {
    const projectId = url.searchParams.get('projectId');
    const allowed = new Set(d.projects.map((p) => p.id));
    return (d.projectActions ?? []).filter(
      (a) => allowed.has(a.projectId) && (!projectId || projectId === a.projectId),
    );
  }
  if (/^\/projects\/[^/]+\/overview$/.test(p))
    return localOverview(d, p.split('/')[2]!, url.searchParams);
  if (p === '/timer') return { timer: currentTimer(d), serverNow: now(d) };
  if (p === '/members') return [d.session.member];
  if (p === '/time-entries') {
    const month = url.searchParams.get('month');
    const all = d.entries.filter(
      (e) =>
        e.state !== 'deleted' &&
        (!month ||
          (e.kind === 'duration'
            ? e.workDate?.startsWith(month)
            : e.segments.some((s) =>
                dateInZone(s.startedAt, d.session.workspace.timezone).startsWith(month),
              ))),
    );
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    return { items: all.slice(offset, offset + limit), total: all.length, serverNow: now(d) };
  }
  if (p === '/reports/monthly' && url.searchParams.get('approvedOnly') !== 'true')
    return localReport(
      d,
      url.searchParams.get('month') ?? dateInZone(now(d), d.session.workspace.timezone).slice(0, 7),
      now(d),
    );
  if (p === '/notes') return d.notes;
  if (p === '/summaries') return d.summaries;
  if (['/providers', '/mcp-tokens'].includes(p)) return [];
  if (p === '/audit') return d.audit ?? [];
  if (p === '/workspace/export') return d;
  throw new Error(tr('Cette vue nécessite le serveur. Vos temps locaux sont conservés.'));
}
function manual(d: LocalData, b: Record<string, unknown>, entry?: TimeEntry): TimeEntry {
  const p = d.projects.find((p) => p.id === b.projectId && !p.archived);
  if (!p) throw new Error(tr('Projet introuvable ou archivé.'));
  const task = p.tasks.find((t) => t.id === b.taskId && !t.archived);
  if (b.taskId && !task) throw new Error(tr('Sous-catégorie introuvable ou archivée.'));
  const actionId =
    b.actionId === undefined && entry?.projectId === p.id && entry.taskId === (task?.id ?? null)
      ? entry.actionId
      : b.actionId;
  const action = localEntryAction(d, p.id, task?.id ?? null, actionId);
  let seconds: number;
  const segments: TimeEntry['segments'] = [];
  if (b.kind === 'duration') {
    if (
      !validDate(String(b.workDate)) ||
      String(b.workDate) > dateInZone(now(d), d.session.workspace.timezone)
    )
      throw new Error(tr('Date invalide.'));
    seconds = parseDuration(String(b.duration));
    if (seconds > 86400) throw new Error(tr('La durée est limitée à 24 h par saisie.'));
  } else {
    const from = instantSeconds(String(b.startedAt)),
      to = instantSeconds(String(b.endedAt));
    if (to <= from || from < 0 || to > now(d) || to - from > 7 * 86400)
      throw new Error(tr('L’intervalle doit être positif et entièrement passé.'));
    if (
      !b.allowOverlap &&
      d.entries.some(
        (e) =>
          e.id !== entry?.id &&
          e.state !== 'deleted' &&
          e.segments.some((s) => s.startedAt < to && (s.endedAt ?? now(d)) > from),
      )
    )
      throw new Error(tr('Ce temps chevauche un autre intervalle. Confirmez le chevauchement.'));
    seconds = to - from;
    segments.push({ startedAt: from, endedAt: to });
  }
  return {
    id: entry?.id ?? crypto.randomUUID(),
    memberId: d.session.member.id,
    memberName: d.session.member.name,
    projectId: p.id,
    projectName: p.name,
    projectColor: p.color,
    taskId: task?.id ?? null,
    taskName: task?.name ?? null,
    ...(action ? { actionId: action.id, actionName: action.title } : {}),
    description: String(b.description ?? ''),
    kind: b.kind as 'duration' | 'interval',
    state: 'finished',
    workDate: b.kind === 'duration' ? String(b.workDate) : null,
    seconds,
    segments,
    version: (entry?.version ?? 0) + 1,
    createdAt: entry?.createdAt ?? now(d),
    updatedAt: now(d),
  };
}
function optionalDate(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !validDate(value)) throw new Error(tr('Date invalide.'));
  return value;
}
function optionalSeconds(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 360_000_000)
    throw new Error(tr('La durée doit être comprise entre une seconde et 100 000 heures.'));
  return value;
}
function saveLocalAction(
  d: LocalData,
  projectId: string,
  b: Record<string, unknown>,
  actionId?: string,
) {
  const all = (d.projectActions ??= []);
  const previous = all.find((a) => a.id === actionId);
  if (actionId && (!previous || b.version !== previous.version))
    throw new Error(tr('Cette action a changé. Actualisez.'));
  const p = d.projects.find((p) => p.id === (previous?.projectId ?? projectId) && !p.archived);
  if (!p) throw new Error(tr('Projet introuvable ou archivé.'));
  const title = String(b.title ?? previous?.title ?? '').trim();
  if (!title || title.length > 200)
    throw new Error(tr('Saisissez un intitulé de 1 à 200 caractères.'));
  const status = b.status ?? previous?.status ?? 'todo';
  if (status !== 'todo' && status !== 'in_progress' && status !== 'done')
    throw new Error(tr('Statut invalide.'));
  const startOn = optionalDate('startOn' in b ? b.startOn : previous?.startOn);
  const dueOn = optionalDate('dueOn' in b ? b.dueOn : previous?.dueOn);
  if (startOn && dueOn && startOn > dueOn) throw new Error(tr('La fin prévue précède le début.'));
  const taskId = 'taskId' in b ? (b.taskId ? String(b.taskId) : null) : (previous?.taskId ?? null);
  if (taskId !== previous?.taskId && taskId && !p.tasks.some((t) => t.id === taskId && !t.archived))
    throw new Error(tr('Sous-catégorie introuvable ou archivée.'));
  if (
    previous &&
    taskId !== previous.taskId &&
    d.entries.some((e) => e.actionId === previous.id && e.state !== 'deleted')
  )
    throw new Error(tr('Des temps sont associés à cette action. Sa sous-catégorie est conservée.'));
  const assigneeId =
    'assigneeId' in b
      ? b.assigneeId
        ? String(b.assigneeId)
        : null
      : (previous?.assigneeId ?? null);
  if (assigneeId && assigneeId !== d.session.member.id)
    throw new Error(tr('Choisissez un membre actif affecté au projet.'));
  const next: ProjectAction = {
    id: previous?.id ?? crypto.randomUUID(),
    projectId: p.id,
    title,
    taskId,
    status,
    assigneeId,
    assigneeName: assigneeId ? d.session.member.name : null,
    startOn,
    dueOn,
    estimateSeconds: optionalSeconds(
      'estimateSeconds' in b ? b.estimateSeconds : previous?.estimateSeconds,
    ),
    version: (previous?.version ?? 0) + 1,
  };
  d.projectActions = [...all.filter((a) => a.id !== next.id), next];
  for (const e of d.entries) if (e.actionId === next.id) e.actionName = next.title;
  return next;
}
async function personalRequest(
  path: string,
  method: string,
  body?: unknown,
  key?: string,
): Promise<unknown> {
  const env = await read(true);
  snapshot = env.data;
  if (!snapshot) throw new Error(tr('Créez votre espace local.'));
  if (method === 'GET') return cachedRequest(snapshot, path);
  if (path === '/auth/logout') {
    await leavePersonal();
    return { ok: true };
  }
  if (path === '/exports') {
    const b = body as { month: string; format: string };
    const { localExport } = await import('./local-exports.ts');
    return localExport(localReport(snapshot, b.month, now(snapshot)), b.format);
  }
  return change(
    (d) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const parts = path.split('/');
      const objectId = parts[2];
      if (parts[1] === 'timer') return timerMutation(d, parts[2] as 'start', b, now(d), false);
      if (parts[1] === 'projects' && parts[3] === 'actions' && method === 'POST')
        return saveLocalAction(d, objectId!, b);
      if (parts[1] === 'project-actions' && objectId && method === 'PATCH')
        return saveLocalAction(d, '', b, objectId);
      if (path === '/workspace' && method === 'PATCH') {
        if (!validTimezone(String(b.timezone))) throw new Error(tr('Fuseau horaire invalide.'));
        if (d.entries.length && d.session.workspace.timezone !== b.timezone)
          throw new Error(tr('Le fuseau reste fixe après la première saisie.'));
        d.session.workspace.name = String(b.name).trim().slice(0, 200);
        d.session.workspace.timezone = String(b.timezone);
        return d.session.workspace;
      }
      if (parts[1] === 'projects') {
        if (parts[3] === 'tasks') {
          const p = d.projects.find((p) => p.id === objectId);
          if (!p || p.archived) throw new Error(tr('Projet introuvable ou archivé.'));
          const name = String(b.name ?? '').trim();
          if (!name || name.length > 200)
            throw new Error(tr('Le nom de la sous-catégorie doit contenir de 1 à 200 caractères.'));
          const task = {
            id: crypto.randomUUID(),
            projectId: p.id,
            name,
            archived: false,
          };
          p.tasks.push(task);
          return task;
        }
        const old = d.projects.find((p) => p.id === objectId);
        if (method === 'PATCH' && (!old || old.version !== b.version))
          throw new Error(tr('Ce projet a changé. Actualisez.'));
        if (old && b.archived && currentTimer(d)?.projectId === old.id)
          throw new Error(tr('Terminez le chronomètre avant d’archiver ce projet.'));
        const p: Project = {
          id: old?.id ?? crypto.randomUUID(),
          name: String(b.name ?? old?.name ?? '')
            .trim()
            .slice(0, 200),
          description: String(b.description ?? old?.description ?? '').slice(0, 2000),
          color: String(b.color ?? old?.color ?? '#087f75'),
          archived: Boolean(b.archived ?? old?.archived ?? false),
          version: (old?.version ?? 0) + 1,
          memberIds: [d.session.member.id],
          tasks: old?.tasks ?? [],
          budgetSeconds: optionalSeconds(
            'budgetSeconds' in b ? b.budgetSeconds : old?.budgetSeconds,
          ),
          dueOn: optionalDate('dueOn' in b ? b.dueOn : old?.dueOn),
        };
        if (!p.name) throw new Error(tr('Précisez le nom du projet.'));
        d.projects = d.projects.filter((p) => p.id !== old?.id);
        d.projects.push(p);
        return p;
      }
      if (parts[1] === 'tasks') {
        const task = d.projects.flatMap((p) => p.tasks).find((t) => t.id === objectId);
        if (!task) throw new Error(tr('Sous-catégorie introuvable.'));
        if ('name' in b) {
          const name = String(b.name ?? '').trim();
          if (!name || name.length > 200)
            throw new Error(tr('Le nom de la sous-catégorie doit contenir de 1 à 200 caractères.'));
          task.name = name;
        }
        if (b.archived && currentTimer(d)?.taskId === task.id)
          throw new Error(tr('Terminez le chronomètre avant d’archiver cette sous-catégorie.'));
        if ('archived' in b) task.archived = Boolean(b.archived);
        return task;
      }
      if (parts[1] === 'time-entries') {
        const e = d.entries.find((e) => e.id === objectId);
        if (method === 'POST') {
          // La clé du formulaire identifie aussi la saisie locale en cas de réponse perdue.
          const existing = d.entries.find((e) => e.id === key);
          if (existing) return existing;
          const created = manual(d, b);
          if (key) created.id = key;
          d.entries.unshift(created);
          return created;
        }
        if (!e || e.state !== 'finished' || e.version !== b.version)
          throw new Error(tr('Ce temps a changé. Actualisez avant de le corriger.'));
        if (String(b.reason ?? '').trim().length < 5)
          throw new Error(tr('Expliquez la correction (au moins 5 caractères).'));
        d.audit = [
          {
            id: crypto.randomUUID(),
            action:
              method === 'DELETE'
                ? 'time.delete'
                : parts[3] === 'description'
                  ? 'time.description'
                  : 'time.correct',
            actorName: d.session.member.name,
            createdAt: now(d),
            detail: JSON.stringify({ reason: String(b.reason), before: structuredClone(e) }),
          },
          ...(d.audit ?? []),
        ].slice(0, 1000);
        if (method === 'DELETE') {
          e.state = 'deleted';
          e.version++;
          return e;
        }
        if (parts[3] === 'description') {
          e.description = String(b.description ?? '').slice(0, 2000);
          e.version++;
          return e;
        }
        const replacement = manual(d, b, e);
        d.entries = d.entries.map((e) => (e.id === replacement.id ? replacement : e));
        return replacement;
      }
      if (parts[1] === 'notes') {
        const old = d.notes.find((n) => n.id === objectId);
        if (method === 'DELETE') {
          d.notes = d.notes.filter((n) => n.id !== objectId);
          return { ok: true };
        }
        if (!validDate(String(b.workDate ?? old?.workDate))) throw new Error(tr('Date invalide.'));
        const p = d.projects.find((p) => p.id === (b.projectId ?? old?.projectId));
        if (!p) throw new Error(tr('Projet introuvable.'));
        const n: WorkNote = {
          id: old?.id ?? crypto.randomUUID(),
          memberId: d.session.member.id,
          projectId: p.id,
          projectName: p.name,
          workDate: String(b.workDate ?? old?.workDate),
          text: String(b.text ?? old?.text ?? '').slice(0, 8000),
          shared: Boolean(b.shared ?? old?.shared),
          source: 'human',
          createdAt: old?.createdAt ?? now(d),
          updatedAt: now(d),
        };
        d.notes = d.notes.filter((v) => v.id !== n.id);
        d.notes.push(n);
        return n;
      }
      if (parts[1] === 'summaries') {
        const old = d.summaries.find((s) => s.id === objectId);
        const s: WorkSummary = {
          id: old?.id ?? crypto.randomUUID(),
          memberId: d.session.member.id,
          month: String(b.month ?? old?.month),
          text: String(b.text ?? old?.text ?? '').slice(0, 8000),
          status: b.status === 'approved' ? 'approved' : 'draft',
          source: 'human',
          entryIds: [],
          createdAt: old?.createdAt ?? now(d),
          approvedAt: b.status === 'approved' ? now(d) : null,
        };
        d.summaries = d.summaries.filter((v) => v.id !== s.id);
        d.summaries.push(s);
        return s;
      }
      throw new Error(tr('Cette fonction est disponible dans un espace d’équipe connecté.'));
    },
    true,
    true,
  );
}
export async function importPersonal(remote: Remote, mapping: Record<string, string>) {
  const env = await read(true);
  if (!env.data) return 0;
  const d = env.data;
  if (currentTimer(d))
    throw new Error(tr('Terminez le chronomètre de l’espace local avant de transférer ses temps.'));
  let count = 0;
  for (const e of d.entries.filter((e) => e.state === 'finished')) {
    const projectId = mapping[e.projectId];
    if (!projectId) continue;
    if (e.kind === 'timer') {
      const entry = {
        id: e.id,
        projectId,
        taskId: null,
        description: e.description,
        state: e.state,
        segments: e.segments,
      };
      await remote(
        '/sync/time-entry',
        'POST',
        { mutationId: e.id, baseVersion: null, entry },
        e.id,
      );
    } else
      await remote(
        '/sync/import',
        'POST',
        {
          localId: e.id,
          input: {
            projectId,
            description: e.description,
            kind: e.kind,
            ...(e.kind === 'duration'
              ? { duration: tr('{0} min', e.seconds / 60), workDate: e.workDate }
              : {
                  startedAt: new Date(e.segments[0]!.startedAt * 1000).toISOString(),
                  endedAt: new Date(e.segments[0]!.endedAt! * 1000).toISOString(),
                }),
          },
        },
        e.id,
      );
    count++;
  }
  return count;
}
