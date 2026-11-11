// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import type {
  MonthlyReport,
  Project,
  ProjectAction,
  ProjectOverview,
  Session,
  TimeEntry,
  WorkNote,
  WorkSummary,
} from '@minutrel/contracts';
import { monthRange, secondsInRange } from '@minutrel/domain/reports';

export interface PendingTime {
  allowOverlap?: boolean;
  mutationId: string;
  baseVersion: number | null;
  entry: TimeEntry;
}
export interface LocalData {
  schema: 1;
  session: Session;
  projects: Project[];
  projectActions?: ProjectAction[];
  entries: TimeEntry[];
  notes: WorkNote[];
  summaries: WorkSummary[];
  pending: PendingTime[];
  offset: number;
  lastOnline: number;
  conflict: string;
  archives: PendingTime[][];
  audit?: { id: string; action: string; actorName: string; createdAt: number; detail: string }[];
}
export function localSpace(name: string, now: number): LocalData {
  return {
    schema: 1,
    session: {
      member: {
        id: crypto.randomUUID(),
        name: name.trim() || tr('Moi'),
        email: 'local@minutrel.invalid',
        role: 'admin',
        enabled: true,
        createdAt: now,
      },
      workspace: {
        id: crypto.randomUUID(),
        name: tr('Mon espace local'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      csrf: '',
      serverNow: now,
    },
    projects: [],
    projectActions: [],
    entries: [],
    notes: [],
    summaries: [],
    pending: [],
    offset: 0,
    lastOnline: now,
    conflict: '',
    archives: [],
  };
}
export function currentTimer(data: LocalData) {
  return data.entries.find((e) => e.state === 'running' || e.state === 'paused') ?? null;
}
export function localEntryAction(
  data: LocalData,
  projectId: string,
  taskId: string | null,
  actionId: unknown,
) {
  if (!actionId) return;
  const action = data.projectActions?.find(
    (a) => a.id === actionId && a.projectId === projectId && a.taskId === taskId,
  );
  if (!action)
    throw new Error(tr('Choisissez une action du projet et de la sous-catégorie sélectionnés.'));
  return action;
}
export function timerMutation(
  data: LocalData,
  action: 'start' | 'pause' | 'resume' | 'stop',
  input: Record<string, unknown>,
  now: number,
  linked: boolean,
) {
  let e = currentTimer(data);
  if (action === 'start') {
    if (e) throw new Error(tr('Un chronomètre est déjà actif sur un de vos appareils.'));
    const p = data.projects.find((p) => p.id === input.projectId && !p.archived);
    if (!p) throw new Error(tr('Projet introuvable ou archivé.'));
    const task = p.tasks.find((t) => t.id === input.taskId && !t.archived);
    if (input.taskId && !task) throw new Error(tr('Sous-catégorie introuvable ou archivée.'));
    const projectAction = localEntryAction(data, p.id, task?.id ?? null, input.actionId);
    e = {
      id: crypto.randomUUID(),
      memberId: data.session.member.id,
      memberName: data.session.member.name,
      projectId: p.id,
      projectName: p.name,
      projectColor: p.color,
      taskId: task?.id ?? null,
      taskName: task?.name ?? null,
      ...(projectAction ? { actionId: projectAction.id, actionName: projectAction.title } : {}),
      kind: 'timer',
      state: 'running',
      description: String(input.description ?? '').slice(0, 2000),
      workDate: null,
      seconds: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
      segments: [{ startedAt: now, endedAt: null }],
    };
    data.entries.unshift(e);
  } else {
    if (!e || e.version !== input.version)
      throw new Error(tr('Le chronomètre a changé sur un autre appareil. Actualisez.'));
    if (now < e.updatedAt)
      throw new Error(tr('L’horloge locale a reculé. Corrigez-la avant de continuer.'));
    if (action !== 'stop' && (action === 'pause' ? e.state !== 'running' : e.state !== 'paused'))
      throw new Error(tr('Le chronomètre a déjà changé d’état.'));
    const open = e.segments.find((s) => s.endedAt === null);
    if (open) {
      open.endedAt = now;
      e.seconds += now - open.startedAt;
    }
    if (action === 'resume') e.segments.push({ startedAt: now, endedAt: null });
    e.state =
      action === 'stop'
        ? e.seconds
          ? 'finished'
          : 'deleted'
        : action === 'pause'
          ? 'paused'
          : 'running';
    e.updatedAt = now;
    e.version++;
  }
  if (linked) {
    const previous = data.pending.find((p) => p.entry.id === e.id);
    data.pending = data.pending.filter((p) => p.entry.id !== e.id);
    // Le premier changement conserve la version acceptée avant la coupure.
    const baseVersion = previous
      ? previous.baseVersion
      : action === 'start'
        ? null
        : Number(input.version);
    data.pending.push({ mutationId: crypto.randomUUID(), baseVersion, entry: structuredClone(e) });
  }
  return e;
}
export function acknowledge(data: LocalData, sent: PendingTime, accepted: TimeEntry) {
  const next = data.pending.find((p) => p.entry.id === sent.entry.id);
  if (!next) return;
  if (next && next.mutationId !== sent.mutationId) {
    next.baseVersion = accepted.version;
    return;
  }
  data.pending = data.pending.filter((p) => p.mutationId !== sent.mutationId);
  data.entries = data.entries.filter((e) => e.id !== accepted.id && e.id !== sent.entry.id);
  data.entries.unshift(accepted);
}
function finishedEntries(data: LocalData, month?: string, projectId?: string) {
  const range = month ? monthRange(month, data.session.workspace.timezone) : undefined;
  return data.entries
    .filter((e) => e.state === 'finished')
    .filter((e) => !projectId || e.projectId === projectId)
    .map((e) => ({
      ...e,
      reportSeconds: range ? secondsInRange(e, range) : e.seconds,
    }))
    .filter((e) => e.reportSeconds > 0);
}
export function localOverview(
  data: LocalData,
  projectId: string,
  params: URLSearchParams,
): ProjectOverview {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) throw new Error(tr('Projet introuvable.'));
  const month = params.get('month') ?? undefined;
  const taskId = params.get('taskId');
  const offset = Number(params.get('offset') ?? 0);
  const entries = finishedEntries(data, month, projectId);
  const categories = new Map<string | null, number>();
  for (const e of entries)
    categories.set(e.taskId, (categories.get(e.taskId) ?? 0) + e.reportSeconds);
  const filtered = taskId
    ? entries.filter((e) => e.taskId === (taskId === 'none' ? null : taskId))
    : entries;
  return {
    scope: 'personal',
    totalSeconds: data.entries.reduce(
      (sum, e) => sum + (e.projectId === projectId && e.state === 'finished' ? e.seconds : 0),
      0,
    ),
    filteredSeconds: filtered.reduce((sum, e) => sum + e.reportSeconds, 0),
    entryCount: filtered.length,
    categories: [...categories].map(([taskId, seconds]) => ({ taskId, seconds })),
    entries: filtered.slice(offset, offset + 50),
  };
}
export function localReport(data: LocalData, month: string, now: number): MonthlyReport {
  const entries = finishedEntries(data, month);
  const totalSeconds = entries.reduce((n, e) => n + e.reportSeconds, 0);
  const { id, name, email } = data.session.member;
  return {
    month,
    timezone: data.session.workspace.timezone,
    workspaceName: data.session.workspace.name,
    generatedAt: now,
    totalSeconds,
    entryCount: entries.length,
    activeTimers: currentTimer(data) ? 1 : 0,
    members: [{ id, name, email, seconds: totalSeconds }],
    projects: data.projects
      .map((p) => ({
        ...p,
        seconds: entries
          .filter((e) => e.projectId === p.id)
          .reduce((n, e) => n + e.reportSeconds, 0),
      }))
      .filter((p) => p.seconds > 0),
    entries,
    notes: data.notes.filter((n) => n.shared && n.workDate.startsWith(`${month}-`)),
    summaries: data.summaries.filter((s) => s.status === 'approved' && s.month === month),
  };
}
