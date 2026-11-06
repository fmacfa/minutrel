// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import type {
  MonthlyReport,
  Project,
  Session,
  TimeEntry,
  WorkNote,
  WorkSummary,
} from '@minutrel/contracts';
import { monthBounds } from '@minutrel/domain/reports';

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
    if (input.taskId && !task) throw new Error(tr('Tâche introuvable ou archivée.'));
    e = {
      id: crypto.randomUUID(),
      memberId: data.session.member.id,
      memberName: data.session.member.name,
      projectId: p.id,
      projectName: p.name,
      projectColor: p.color,
      taskId: task?.id ?? null,
      taskName: task?.name ?? null,
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
export function localReport(data: LocalData, month: string, now: number): MonthlyReport {
  const bounds = monthBounds(month, data.session.workspace.timezone);
  const entries = data.entries
    .filter((e) => e.state === 'finished')
    .map((e) => ({
      ...e,
      reportSeconds:
        e.kind === 'duration'
          ? e.workDate?.startsWith(`${month}-`)
            ? e.seconds
            : 0
          : e.segments.reduce(
              (n, s) =>
                n +
                (s.endedAt === null
                  ? 0
                  : Math.max(
                      0,
                      Math.min(s.endedAt, bounds.to) - Math.max(s.startedAt, bounds.from),
                    )),
              0,
            ),
    }))
    .filter((e) => e.reportSeconds > 0);
  const totalSeconds = entries.reduce((n, e) => n + e.reportSeconds, 0);
  return {
    month,
    timezone: data.session.workspace.timezone,
    workspaceName: data.session.workspace.name,
    generatedAt: now,
    totalSeconds,
    entryCount: entries.length,
    activeTimers: currentTimer(data) ? 1 : 0,
    members: [{ ...data.session.member, seconds: totalSeconds }],
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
