// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  Project,
  Task,
  TimeEntry,
  Segment,
  WorkNote,
  WorkSummary,
  MonthlyReport,
  Workspace,
} from '@minutrel/contracts';
import { parseDuration, sumDurations } from '@minutrel/domain';
import {
  dateInZone,
  instantSeconds,
  monthBounds,
  monthRange,
  validDate,
} from '@minutrel/domain/reports';
import { Store, ensure, hash, id } from './store.ts';
import type { SQLInputValue } from 'node:sqlite';
import { publicMember, type MemberRow } from './auth.ts';
import { requireOpenWeek, timeSlices } from './time-slices.ts';

type ProjectRow = Omit<Project, 'memberIds' | 'tasks' | 'archived'> & { archived: number };
export function projects(store: Store, member: MemberRow): Project[] {
  const rows = store.all<ProjectRow>(
    member.role === 'contributor'
      ? 'SELECT p.* FROM projects p JOIN assignments a ON a.projectId=p.id WHERE a.memberId=? ORDER BY p.archived,p.name'
      : 'SELECT * FROM projects ORDER BY archived,name',
    ...(member.role === 'contributor' ? [member.id] : []),
  );
  return rows.map((p) => ({
    ...p,
    archived: !!p.archived,
    memberIds: store
      .all<{ memberId: string }>('SELECT memberId FROM assignments WHERE projectId=?', p.id)
      .map((a) => a.memberId),
    tasks: store
      .all<Omit<Task, 'archived'> & { archived: number }>(
        'SELECT * FROM tasks WHERE projectId=? ORDER BY name',
        p.id,
      )
      .map((t) => ({ ...t, archived: !!t.archived })),
  }));
}
export function projectAccess(
  store: Store,
  member: MemberRow,
  projectId: string,
  taskId?: string | null,
  writable = true,
): ProjectRow {
  const p = store.get<ProjectRow>('SELECT * FROM projects WHERE id=?', projectId);
  ensure(p, 'Projet introuvable.', 404);
  ensure(
    member.role !== 'contributor' ||
      store.get('SELECT 1 FROM assignments WHERE projectId=? AND memberId=?', projectId, member.id),
    'Ce projet ne vous est pas affecté.',
    403,
  );
  ensure(!writable || !p.archived, 'Ce projet est archivé.');
  if (taskId) {
    const task = store.get<Task>(
      'SELECT * FROM tasks WHERE id=? AND projectId=?',
      taskId,
      projectId,
    );
    ensure(task && (!writable || !task.archived), 'Sous-catégorie introuvable ou archivée.');
  }
  return p;
}
export function checkEntryAction(
  store: Store,
  projectId: string,
  taskId?: string | null,
  actionId?: string | null,
) {
  if (!actionId) return;
  const action = store.get<{ taskId: string | null }>(
    'SELECT taskId FROM project_actions WHERE id=? AND projectId=?',
    actionId,
    projectId,
  );
  ensure(
    action && action.taskId === (taskId ?? null),
    'Cette action ne correspond pas au projet et à la sous-catégorie.',
  );
}
const entrySelect = `SELECT e.*,p.name projectName,p.color projectColor,t.name taskName,m.name memberName,a.title actionName
  FROM entries e JOIN projects p ON p.id=e.projectId JOIN members m ON m.id=e.memberId
  LEFT JOIN tasks t ON t.id=e.taskId LEFT JOIN project_actions a ON a.id=e.actionId`;
function hydrate(store: Store, rows: Omit<TimeEntry, 'segments'>[]): TimeEntry[] {
  const segments = new Map<string, Segment[]>();
  for (let start = 0; start < rows.length; start += 500) {
    const ids = rows.slice(start, start + 500).map((e) => e.id);
    for (const s of store.all<Segment & { entryId: string }>(
      `SELECT entryId,startedAt,endedAt FROM segments WHERE entryId IN (${ids.map(() => '?').join(',')}) ORDER BY startedAt`,
      ...ids,
    )) {
      const list = segments.get(s.entryId) ?? [];
      list.push({ startedAt: s.startedAt, endedAt: s.endedAt });
      segments.set(s.entryId, list);
    }
  }
  return rows.map((e) => ({ ...e, segments: segments.get(e.id) ?? [] }));
}
export function entriesByIds(store: Store, ids: string[]): TimeEntry[] {
  const rows: Omit<TimeEntry, 'segments'>[] = [];
  for (let start = 0; start < ids.length; start += 500) {
    const chunk = ids.slice(start, start + 500);
    rows.push(
      ...store.all<Omit<TimeEntry, 'segments'>>(
        `${entrySelect} WHERE e.id IN (${chunk.map(() => '?').join(',')}) ORDER BY e.createdAt DESC,e.id`,
        ...chunk,
      ),
    );
  }
  return hydrate(store, rows);
}
export interface EntryFilter {
  month?: string;
  timezone?: string;
  finished?: boolean;
  limit?: number;
  offset?: number;
}
export function queryEntries(
  store: Store,
  memberId?: string,
  filter: EntryFilter = {},
): { items: TimeEntry[]; total: number } {
  const where = [filter.finished ? "e.state='finished'" : "e.state!='deleted'"];
  const params: SQLInputValue[] = [];
  if (memberId) {
    where.push('e.memberId=?');
    params.push(memberId);
  }
  if (filter.month) {
    const { from, to } = monthBounds(filter.month, filter.timezone!);
    where.push(
      `(e.state IN ('running','paused') OR (e.kind='duration' AND e.workDate>=? AND e.workDate<?) OR (e.kind!='duration' AND EXISTS(SELECT 1 FROM segments s WHERE s.entryId=e.id AND s.startedAt<? AND s.endedAt>?)))`,
    );
    params.push(`${filter.month}-01`, dateInZone(to, filter.timezone!), to, from);
  }
  const total = store.get<{ n: number }>(
    `SELECT COUNT(*) n FROM entries e WHERE ${where.join(' AND ')}`,
    ...params,
  )!.n;
  const page = filter.limit === undefined ? '' : 'LIMIT ? OFFSET ?';
  const rows = store.all<Omit<TimeEntry, 'segments'>>(
    `${entrySelect} WHERE ${where.join(' AND ')} ORDER BY e.createdAt DESC,e.id ${page}`,
    ...params,
    ...(filter.limit === undefined ? [] : [filter.limit, filter.offset ?? 0]),
  );
  return { items: hydrate(store, rows), total };
}
export function entries(store: Store, memberId?: string): TimeEntry[] {
  return queryEntries(store, memberId).items;
}
export function entryById(store: Store, entryId: string): TimeEntry {
  const e = store.get<Omit<TimeEntry, 'segments'>>(`${entrySelect} WHERE e.id=?`, entryId);
  ensure(e, 'Temps introuvable.', 404);
  return {
    ...e,
    segments: store.all<Segment>(
      'SELECT startedAt,endedAt FROM segments WHERE entryId=? ORDER BY startedAt',
      entryId,
    ),
  };
}
export function activeTimer(store: Store, memberId: string): TimeEntry | null {
  const e = store.get<{ id: string }>(
    "SELECT id FROM entries WHERE memberId=? AND state IN ('running','paused')",
    memberId,
  );
  return e ? entryById(store, e.id) : null;
}
export function idempotent<T>(
  store: Store,
  member: MemberRow,
  key: string,
  action: string,
  data: unknown,
  mutate: () => T,
): T {
  ensure(
    key.length >= 8 && key.length <= 128 && /^[\w-]+$/.test(key),
    'Fournissez une clé Idempotency-Key unique (8 à 128 caractères).',
  );
  return store.tx(() => {
    const fingerprint = hash(JSON.stringify({ action, data }));
    const previous = store.get<{ fingerprint: string; response: string }>(
      'SELECT * FROM idempotency WHERE memberId=? AND key=?',
      member.id,
      key,
    );
    if (previous) {
      ensure(
        previous.fingerprint === fingerprint,
        'Cette clé a déjà servi pour une autre action.',
        409,
      );
      return JSON.parse(previous.response) as T;
    }
    const response = mutate();
    store.run('DELETE FROM idempotency WHERE createdAt<?', store.now() - 30 * 86400);
    store.run(
      'INSERT INTO idempotency VALUES (?,?,?,?,?)',
      member.id,
      key,
      fingerprint,
      JSON.stringify(response),
      store.now(),
    );
    return response;
  });
}
export function startTimer(
  store: Store,
  member: MemberRow,
  data: {
    projectId: string;
    taskId?: string | null;
    actionId?: string | null;
    description?: string;
  },
): TimeEntry {
  projectAccess(store, member, data.projectId, data.taskId);
  checkEntryAction(store, data.projectId, data.taskId, data.actionId);
  ensure(
    !activeTimer(store, member.id),
    'Un chronomètre est déjà actif sur un de vos appareils.',
    409,
  );
  const entryId = id();
  const now = store.now();
  requireOpenWeek(store, member.id, null, [{ startedAt: now, endedAt: null }]);
  store.run(
    "INSERT INTO entries(id,memberId,projectId,taskId,actionId,kind,state,description,workDate,seconds,version,createdAt,updatedAt) VALUES (?,?,?,?,?,'timer','running',?,NULL,0,1,?,?)",
    entryId,
    member.id,
    data.projectId,
    data.taskId ?? null,
    data.actionId ?? null,
    data.description ?? '',
    now,
    now,
  );
  store.run('INSERT INTO segments VALUES (?,?,?,NULL)', id(), entryId, now);
  store.audit(member.id, 'timer.start', entryId);
  return entryById(store, entryId);
}
export function changeTimer(
  store: Store,
  member: MemberRow,
  action: 'pause' | 'resume' | 'stop',
  version: number,
): TimeEntry {
  const timer = activeTimer(store, member.id);
  ensure(timer, 'Aucun chronomètre actif.', 409);
  ensure(
    timer.version === version,
    'Le chronomètre a changé sur un autre appareil. Actualisez.',
    409,
  );
  ensure(
    action === 'stop' ||
      (action === 'pause' ? timer.state === 'running' : timer.state === 'paused'),
    'Le chronomètre a déjà changé d’état.',
    409,
  );
  const now = store.now();
  ensure(
    now >= timer.updatedAt,
    'L’horloge du serveur a reculé. Vérifiez-la avant de poursuivre.',
    409,
  );
  let seconds = timer.seconds;
  if (timer.state === 'running') {
    const segment = timer.segments.find((s) => s.endedAt === null)!;
    ensure(
      now >= segment.startedAt,
      'L’horloge du serveur a reculé. Vérifiez-la avant de poursuivre.',
      409,
    );
    seconds += now - segment.startedAt;
    store.run('UPDATE segments SET endedAt=? WHERE entryId=? AND endedAt IS NULL', now, timer.id);
  }
  if (action === 'resume') {
    requireOpenWeek(store, member.id, null, [{ startedAt: now, endedAt: null }]);
    store.run('INSERT INTO segments VALUES (?,?,?,NULL)', id(), timer.id, now);
  }
  const state =
    action === 'stop'
      ? seconds
        ? 'finished'
        : 'deleted'
      : action === 'pause'
        ? 'paused'
        : 'running';
  store.run(
    'UPDATE entries SET state=?,seconds=?,version=version+1,updatedAt=? WHERE id=?',
    state,
    seconds,
    now,
    timer.id,
  );
  store.audit(member.id, `timer.${action}`, timer.id, { seconds, version: timer.version + 1 });
  return entryById(store, timer.id);
}
export interface ManualInput {
  projectId: string;
  taskId?: string | null;
  actionId?: string | null;
  description: string;
  kind: 'duration' | 'interval';
  duration?: string;
  workDate?: string;
  startedAt?: string;
  endedAt?: string;
  allowOverlap?: boolean;
}
export function manualValues(store: Store, memberId: string, input: ManualInput, exceptId = '') {
  const timezone = store.get<Workspace>('SELECT * FROM workspace')!.timezone;
  let seconds: number;
  let segment: Segment | null = null;
  let workDate: string | null = null;
  if (input.kind === 'duration') {
    ensure(
      input.duration && input.workDate && validDate(input.workDate),
      'Précisez une durée et une date valides.',
    );
    seconds = parseDuration(input.duration);
    ensure(
      seconds <= 86400 && input.workDate <= dateInZone(store.now(), timezone),
      'La durée est limitée à 24 h par saisie et la date ne peut être future.',
    );
    workDate = input.workDate;
  } else {
    ensure(input.startedAt && input.endedAt, 'Précisez le début et la fin.');
    const startedAt = instantSeconds(input.startedAt);
    const endedAt = instantSeconds(input.endedAt);
    ensure(
      startedAt >= 0 && endedAt > startedAt && endedAt <= store.now(),
      'L’intervalle doit être positif et entièrement passé.',
    );
    ensure(endedAt - startedAt <= 7 * 86400, 'Un intervalle ne peut pas dépasser sept jours.');
    seconds = endedAt - startedAt;
    segment = { startedAt, endedAt };
    const overlap = store.get(
      `SELECT 1 FROM segments s JOIN entries e ON e.id=s.entryId
      WHERE e.memberId=? AND e.state!='deleted' AND e.id!=? AND s.startedAt<? AND COALESCE(s.endedAt,?)>? LIMIT 1`,
      memberId,
      exceptId,
      endedAt,
      store.now(),
      startedAt,
    );
    ensure(
      !overlap || input.allowOverlap,
      'Ce temps chevauche un autre intervalle. Confirmez le chevauchement.',
      409,
    );
  }
  return { seconds, segment, workDate };
}
export function createManual(store: Store, member: MemberRow, input: ManualInput): TimeEntry {
  projectAccess(store, member, input.projectId, input.taskId);
  checkEntryAction(store, input.projectId, input.taskId, input.actionId);
  const values = manualValues(store, member.id, input);
  requireOpenWeek(store, member.id, values.workDate, values.segment ? [values.segment] : []);
  const entryId = id();
  const now = store.now();
  store.run(
    "INSERT INTO entries(id,memberId,projectId,taskId,actionId,kind,state,description,workDate,seconds,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?,'finished',?,?,?,1,?,?)",
    entryId,
    member.id,
    input.projectId,
    input.taskId ?? null,
    input.actionId ?? null,
    input.kind,
    input.description,
    values.workDate,
    values.seconds,
    now,
    now,
  );
  if (values.segment)
    store.run(
      'INSERT INTO segments VALUES (?,?,?,?)',
      id(),
      entryId,
      values.segment.startedAt,
      values.segment.endedAt,
    );
  store.audit(member.id, 'time.create', entryId, {
    seconds: values.seconds,
    allowOverlap: !!input.allowOverlap,
  });
  return entryById(store, entryId);
}
export function editTime(
  store: Store,
  actor: MemberRow,
  entryId: string,
  input: ManualInput & { version: number; reason: string },
  remove = false,
): TimeEntry {
  const previous = entryById(store, entryId);
  ensure(previous.state === 'finished', 'Seuls les temps finalisés peuvent être corrigés.');
  ensure(
    previous.memberId === actor.id || actor.role !== 'contributor',
    'Vous ne pouvez pas modifier ce temps.',
    403,
  );
  ensure(input.reason.trim().length >= 5, 'Expliquez la correction (au moins 5 caractères).');
  ensure(
    previous.version === input.version,
    'Ce temps a changé. Actualisez avant de le corriger.',
    409,
  );
  requireOpenWeek(store, previous.memberId, previous.workDate, previous.segments);
  if (remove)
    store.run(
      "UPDATE entries SET state='deleted',version=version+1,updatedAt=? WHERE id=?",
      store.now(),
      entryId,
    );
  else {
    const owner = store.get<MemberRow>('SELECT * FROM members WHERE id=?', previous.memberId)!;
    const moved =
      input.projectId !== previous.projectId || (input.taskId ?? null) !== previous.taskId;
    if (moved) projectAccess(store, owner, input.projectId, input.taskId);
    const actionId =
      input.actionId === undefined ? (moved ? null : (previous.actionId ?? null)) : input.actionId;
    checkEntryAction(store, input.projectId, input.taskId, actionId);
    const values = manualValues(store, owner.id, input, entryId);
    requireOpenWeek(store, owner.id, values.workDate, values.segment ? [values.segment] : []);
    store.run(
      'UPDATE entries SET projectId=?,taskId=?,actionId=?,kind=?,description=?,workDate=?,seconds=?,version=version+1,updatedAt=? WHERE id=?',
      input.projectId,
      input.taskId ?? null,
      actionId,
      input.kind,
      input.description,
      values.workDate,
      values.seconds,
      store.now(),
      entryId,
    );
    store.run('DELETE FROM segments WHERE entryId=?', entryId);
    if (values.segment)
      store.run(
        'INSERT INTO segments VALUES (?,?,?,?)',
        id(),
        entryId,
        values.segment.startedAt,
        values.segment.endedAt,
      );
  }
  const result = entryById(store, entryId);
  store.audit(actor.id, remove ? 'time.delete' : 'time.correct', entryId, {
    reason: input.reason,
    before: previous,
    after: result,
  });
  return result;
}
export function notes(store: Store, memberId?: string, sharedOnly = false): WorkNote[] {
  return store
    .all<Omit<WorkNote, 'shared'> & { shared: number }>(
      `SELECT n.*,p.name projectName FROM notes n JOIN projects p ON p.id=n.projectId WHERE 1=1 ${memberId ? 'AND n.memberId=?' : ''} ${sharedOnly ? 'AND n.shared=1' : ''} ORDER BY n.workDate DESC,n.createdAt DESC`,
      ...(memberId ? [memberId] : []),
    )
    .map((n) => ({ ...n, shared: !!n.shared }));
}
export function createNote(
  store: Store,
  member: MemberRow,
  data: { projectId: string; workDate: string; text: string; shared?: boolean },
  source: 'human' | 'assistant' = 'human',
): WorkNote {
  projectAccess(store, member, data.projectId);
  ensure(validDate(data.workDate), 'Date invalide.');
  const noteId = id();
  const now = store.now();
  store.run(
    'INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?)',
    noteId,
    member.id,
    data.projectId,
    data.workDate,
    data.text,
    source === 'human' && data.shared ? 1 : 0,
    source,
    now,
    now,
  );
  store.audit(member.id, 'note.create', noteId, {
    source,
    shared: source === 'human' && !!data.shared,
  });
  return notes(store, member.id).find((n) => n.id === noteId)!;
}
export function summaries(store: Store, memberId?: string, approvedOnly = false): WorkSummary[] {
  return store
    .all<Omit<WorkSummary, 'entryIds'> & { entryIds: string }>(
      `SELECT * FROM summaries WHERE 1=1 ${memberId ? 'AND memberId=?' : ''} ${approvedOnly ? "AND status='approved'" : ''} ORDER BY createdAt DESC`,
      ...(memberId ? [memberId] : []),
    )
    .map((s) => ({ ...s, entryIds: JSON.parse(s.entryIds) as string[] }));
}
export function monthlyReport(
  store: Store,
  month: string,
  memberIds?: string[],
  detailLimit = 100,
  approvedOnly = false,
): MonthlyReport {
  const workspace = store.get<Workspace>('SELECT * FROM workspace')!;
  const range = monthRange(month, workspace.timezone);
  const selected = new Set(
    memberIds ?? store.all<{ id: string }>('SELECT id FROM members').map((m) => m.id),
  );
  const selectedIds = [...selected];
  const times = timeSlices(store, {
    memberIds: selectedIds,
    range,
    timezone: workspace.timezone,
    approved: approvedOnly,
  });
  const byMember = new Map<string, number>();
  const byProject = new Map<string, number>();
  for (const e of times) {
    byMember.set(e.memberId, (byMember.get(e.memberId) ?? 0) + e.reportSeconds);
    byProject.set(e.projectId, (byProject.get(e.projectId) ?? 0) + e.reportSeconds);
  }
  const members = store
    .all<MemberRow>('SELECT * FROM members ORDER BY name')
    .filter((m) => selected.has(m.id))
    .map((m) => ({ ...publicMember(m), seconds: byMember.get(m.id) ?? 0 }));
  const projectRows = store
    .all<{ id: string; name: string; color: string }>(
      'SELECT id,name,color FROM projects ORDER BY name',
    )
    .map((p) => ({ ...p, seconds: byProject.get(p.id) ?? 0 }))
    .filter((p) => p.seconds > 0);
  const previewIds = times.slice(0, detailLimit).map((e) => e.id);
  const durations = new Map(times.map((t) => [t.id, t.reportSeconds]));
  return {
    ...(approvedOnly ? { approvedOnly: true } : {}),
    month,
    timezone: workspace.timezone,
    workspaceName: workspace.name,
    generatedAt: store.now(),
    entryCount: times.length,
    totalSeconds: sumDurations(times.map((e) => e.reportSeconds)),
    members,
    projects: projectRows,
    entries: entriesByIds(store, previewIds).map((e) => ({
      ...e,
      reportSeconds: durations.get(e.id)!,
    })),
    activeTimers: approvedOnly
      ? 0
      : store.get<{ n: number }>(
          `SELECT COUNT(*) n FROM entries e WHERE e.state IN ('running','paused') AND e.memberId IN (SELECT value FROM json_each(?))`,
          JSON.stringify(selectedIds),
        )!.n,
    notes: approvedOnly
      ? []
      : notes(store, undefined, true).filter(
          (n) => selected.has(n.memberId) && n.workDate.startsWith(`${month}-`),
        ),
    summaries: approvedOnly
      ? []
      : summaries(store, undefined, true).filter(
          (s) => selected.has(s.memberId) && s.month === month,
        ),
  };
}
