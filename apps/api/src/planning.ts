// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import type { ProjectAction, ProjectOverview, Workspace } from '@minutrel/contracts';
import { monthRange, validDate } from '@minutrel/domain/reports';
import { z } from 'zod';
import { authenticate, requireRole, type MemberRow } from './auth.ts';
import { entriesByIds, idempotent, projectAccess } from './service.ts';
import { ensure, id, type Store } from './store.ts';
import { timeSlices } from './time-slices.ts';

const actionInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    taskId: z.uuid().nullable().optional(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
    assigneeId: z.uuid().nullable().optional(),
    startOn: z.string().refine(validDate).nullable().optional(),
    dueOn: z.string().refine(validDate).nullable().optional(),
    estimateSeconds: z.int().positive().max(360_000_000).nullable().optional(),
  })
  .strict();
const actionSelect =
  'SELECT a.*,m.name assigneeName FROM project_actions a LEFT JOIN members m ON m.id=a.assigneeId';
const pathId = z.object({ id: z.uuid() });

function validateAction(
  store: Store,
  actor: MemberRow,
  projectId: string,
  data: z.infer<typeof actionInput>,
  previous?: ProjectAction,
) {
  projectAccess(store, actor, projectId);
  ensure(
    !data.startOn || !data.dueOn || data.startOn <= data.dueOn,
    'La fin prévue précède le début.',
  );
  if (data.taskId && data.taskId !== previous?.taskId)
    projectAccess(store, actor, projectId, data.taskId);
  if (data.assigneeId && data.assigneeId !== previous?.assigneeId)
    ensure(
      store.get(
        'SELECT 1 FROM assignments a JOIN members m ON m.id=a.memberId WHERE a.projectId=? AND a.memberId=? AND m.enabled=1',
        projectId,
        data.assigneeId,
      ),
      'Choisissez un membre actif affecté au projet.',
    );
}

export function registerPlanning(app: FastifyInstance, store: Store) {
  app.get('/api/v1/project-actions', async (r) => {
    const actor = authenticate(store, r);
    const { projectId } = z.object({ projectId: z.uuid().optional() }).strict().parse(r.query);
    if (projectId) projectAccess(store, actor, projectId, null, false);
    return store.all<ProjectAction>(
      `${actionSelect}
      WHERE (? IS NULL OR a.projectId=?) AND (? IS NULL OR EXISTS (
        SELECT 1 FROM assignments p WHERE p.projectId=a.projectId AND p.memberId=?
      )) ORDER BY a.dueOn IS NULL,a.dueOn,a.title,a.id`,
      projectId ?? null,
      projectId ?? null,
      actor.role === 'contributor' ? actor.id : null,
      actor.id,
    );
  });

  app.post('/api/v1/projects/:id/actions', async (r) => {
    const actor = authenticate(store, r, true);
    requireRole(actor, 'manager', 'admin');
    const projectId = pathId.parse(r.params).id;
    const data = actionInput.parse(r.body);
    const action = idempotent(
      store,
      actor,
      String(r.headers['idempotency-key'] ?? ''),
      'project.action.create',
      { projectId, ...data },
      () => {
        validateAction(store, actor, projectId, data);
        const actionId = id();
        store.run(
          `INSERT INTO project_actions(id,projectId,taskId,title,status,assigneeId,startOn,dueOn,estimateSeconds)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          actionId,
          projectId,
          data.taskId ?? null,
          data.title,
          data.status ?? 'todo',
          data.assigneeId ?? null,
          data.startOn ?? null,
          data.dueOn ?? null,
          data.estimateSeconds ?? null,
        );
        store.audit(actor.id, 'project.action.create', actionId, { projectId, ...data });
        return store.get<ProjectAction>(`${actionSelect} WHERE a.id=?`, actionId)!;
      },
    );
    store.changed();
    return action;
  });

  app.patch('/api/v1/project-actions/:id', async (r) => {
    const actor = authenticate(store, r, true);
    const actionId = pathId.parse(r.params).id;
    const data = actionInput.partial().extend({ version: z.int().positive() }).parse(r.body);
    const action = store.tx(() => {
      const previous = store.get<ProjectAction>(`${actionSelect} WHERE a.id=?`, actionId);
      ensure(previous, 'Action introuvable.', 404);
      projectAccess(store, actor, previous.projectId);
      if (actor.role === 'contributor')
        ensure(
          previous.assigneeId === actor.id &&
            data.status &&
            Object.keys(data).every((field) => field === 'status' || field === 'version'),
          'Vous pouvez modifier le statut de vos actions affectées.',
          403,
        );
      ensure(previous.version === data.version, 'Cette action a changé. Actualisez.', 409);
      const next = { ...previous, ...data };
      validateAction(store, actor, previous.projectId, next, previous);
      if (next.taskId !== previous.taskId)
        ensure(
          !store.get("SELECT 1 FROM entries WHERE actionId=? AND state!='deleted'", actionId),
          'Des temps sont associés à cette action. Sa sous-catégorie est conservée.',
          409,
        );
      store.run(
        `UPDATE project_actions SET taskId=?,title=?,status=?,assigneeId=?,startOn=?,dueOn=?,
         estimateSeconds=?,version=version+1 WHERE id=?`,
        next.taskId,
        next.title,
        next.status,
        next.assigneeId,
        next.startOn,
        next.dueOn,
        next.estimateSeconds,
        actionId,
      );
      store.audit(actor.id, 'project.action.update', actionId, data);
      return store.get<ProjectAction>(`${actionSelect} WHERE a.id=?`, actionId)!;
    });
    store.changed();
    return action;
  });

  app.get('/api/v1/projects/:id/overview', async (r): Promise<ProjectOverview> => {
    const actor = authenticate(store, r);
    const projectId = pathId.parse(r.params).id;
    const q = z
      .object({
        month: z.string().optional(),
        taskId: z.union([z.uuid(), z.literal('none')]).optional(),
        memberId: z.uuid().optional(),
        offset: z.coerce.number().int().nonnegative().default(0),
      })
      .strict()
      .parse(r.query);
    projectAccess(store, actor, projectId, q.taskId === 'none' ? null : q.taskId, false);
    const personal = actor.role === 'contributor';
    ensure(
      !personal || !q.memberId || q.memberId === actor.id,
      'Vous ne pouvez lire que vos temps.',
      403,
    );
    const timezone = store.get<Workspace>('SELECT * FROM workspace')!.timezone;
    const memberId = personal ? actor.id : q.memberId;
    const slices = timeSlices(store, {
      projectId,
      memberIds: memberId ? [memberId] : undefined,
      range: q.month ? monthRange(q.month, timezone) : undefined,
      timezone,
    });
    const categories = new Map<string | null, number>();
    for (const slice of slices)
      categories.set(slice.taskId, (categories.get(slice.taskId) ?? 0) + slice.reportSeconds);
    const filtered = q.taskId
      ? slices.filter((slice) => slice.taskId === (q.taskId === 'none' ? null : q.taskId))
      : slices;
    const page = filtered.slice(q.offset, q.offset + 50);
    const seconds = new Map(page.map((slice) => [slice.id, slice.reportSeconds]));
    const totalSeconds = store.get<{ seconds: number }>(
      `SELECT COALESCE(SUM(seconds),0) seconds FROM entries
       WHERE projectId=? AND state='finished'${personal ? ' AND memberId=?' : ''}`,
      projectId,
      ...(personal ? [actor.id] : []),
    )!.seconds;
    return {
      scope: personal ? 'personal' : 'team',
      totalSeconds,
      filteredSeconds: filtered.reduce((sum, slice) => sum + slice.reportSeconds, 0),
      entryCount: filtered.length,
      categories: [...categories].map(([taskId, seconds]) => ({ taskId, seconds })),
      entries: entriesByIds(
        store,
        page.map((slice) => slice.id),
      ).map((entry) => ({
        ...entry,
        reportSeconds: seconds.get(entry.id)!,
      })),
    };
  });
}
