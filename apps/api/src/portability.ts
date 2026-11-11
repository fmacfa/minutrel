// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import type { Project, ProjectAction, Timesheet, Workspace } from '@minutrel/contracts';
import { Store, ensure } from './store.ts';
import { authenticate, requireRole, type MemberRow } from './auth.ts';
import { entries, notes, summaries } from './service.ts';

export function exportWorkspace(store: Store) {
  ensure(
    !store.get("SELECT 1 FROM entries WHERE state IN ('running','paused') LIMIT 1"),
    'Finalisez les chronomètres actifs avant d’exporter l’espace.',
    409,
  );
  const workspace = store.get<Workspace>('SELECT * FROM workspace')!;
  const times = entries(store).filter((e) => e.state === 'finished');
  const stamp = (seconds: number) => new Date(seconds * 1000).toISOString();
  const entryIds = new Set(times.map((e) => e.id));
  return {
    schema_version: 2,
    exported_at: stamp(store.now()),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      time_zone: workspace.timezone,
      locale: 'fr-FR',
    },
    members: store
      .all<MemberRow>('SELECT * FROM members ORDER BY name')
      .map((m) => ({ id: m.id, display_name: m.name, email: m.email })),
    projects: store.all<Project>('SELECT * FROM projects ORDER BY name').map((p) => ({
      id: p.id,
      workspace_id: workspace.id,
      name: p.name,
      description: p.description,
      color: p.color,
      archived_at: p.archived ? stamp(store.now()) : null,
      version: p.version,
      budget_seconds: p.budgetSeconds,
      due_on: p.dueOn,
    })),
    project_members: store
      .all<{ projectId: string; memberId: string }>('SELECT * FROM assignments')
      .map((a) => ({ project_id: a.projectId, member_id: a.memberId })),
    tasks: store
      .all<{ id: string; projectId: string; name: string; archived: number }>('SELECT * FROM tasks')
      .map((t) => ({ id: t.id, project_id: t.projectId, name: t.name, archived: !!t.archived })),
    project_actions: store
      .all<ProjectAction>('SELECT * FROM project_actions ORDER BY id')
      .map((a) => ({
        id: a.id,
        project_id: a.projectId,
        task_id: a.taskId,
        title: a.title,
        status: a.status,
        assignee_id: a.assigneeId,
        start_on: a.startOn,
        due_on: a.dueOn,
        estimate_seconds: a.estimateSeconds,
        version: a.version,
      })),
    timesheets: store
      .all<Timesheet & { reviewerId: string | null }>(
        'SELECT * FROM timesheets ORDER BY weekStart,memberId',
      )
      .map((s) => ({
        member_id: s.memberId,
        week_start: s.weekStart,
        status: s.status,
        version: s.version,
        submitted_at: s.submittedAt === null ? null : stamp(s.submittedAt),
        reviewed_at: s.reviewedAt === null ? null : stamp(s.reviewedAt),
        reviewer_id: s.reviewerId,
        reason: s.reason,
      })),
    time_entries: times.map((e) => ({
      id: e.id,
      workspace_id: workspace.id,
      member_id: e.memberId,
      project_id: e.projectId,
      task_id: e.taskId,
      action_id: e.actionId ?? null,
      kind: e.kind,
      state: 'stopped',
      description: e.description,
      work_date: e.workDate,
      time_zone: workspace.timezone,
      duration_seconds: e.seconds,
      version: e.version,
      created_at: stamp(e.createdAt),
      updated_at: stamp(e.updatedAt),
      deleted_at: null,
    })),
    time_segments: times.flatMap((e) =>
      e.segments.map((s, index) => ({
        id: `${e.id}:${index}`,
        entry_id: e.id,
        started_at: stamp(s.startedAt),
        ended_at: stamp(s.endedAt!),
      })),
    ),
    work_notes: notes(store, undefined, true).map((n) => ({
      id: n.id,
      member_id: n.memberId,
      project_id: n.projectId,
      work_date: n.workDate,
      text: n.text,
      shared: true,
      source: n.source,
      created_at: stamp(n.createdAt),
      updated_at: stamp(n.updatedAt),
    })),
    work_summaries: summaries(store, undefined, true).map((s) => ({
      id: s.id,
      member_id: s.memberId,
      month: s.month,
      text: s.text,
      source: s.source,
      status: 'approved',
      entry_ids: s.entryIds.filter((entryId) => entryIds.has(entryId)),
      created_at: stamp(s.createdAt),
      approved_at: stamp(s.approvedAt!),
    })),
  };
}
export function registerPortability(app: FastifyInstance, store: Store) {
  app.get('/api/v1/workspace/export', async (r, reply) => {
    const member = authenticate(store, r);
    requireRole(member, 'admin');
    const data = store.tx(() => exportWorkspace(store));
    store.audit(member.id, 'workspace.export', data.workspace.id, {
      entries: data.time_entries.length,
    });
    reply.header('Content-Disposition', 'attachment; filename="minutrel-espace.json"');
    return reply.type('application/json; charset=utf-8').send(data);
  });
}
