// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { mcpScopes, type Workspace } from '@minutrel/contracts';
import { monthBounds, validDate, validTimezone } from '@minutrel/domain/reports';
import { Store, ensure, id, hash, secret } from './store.ts';
import { requireOpenWeek } from './time-slices.ts';
import {
  authenticate,
  newSession,
  passwordHash,
  passwordMatches,
  publicMember,
  requireRole,
  safeEqual,
  sessionDetails,
  type MemberRow,
} from './auth.ts';
import {
  projects,
  projectAccess,
  queryEntries,
  activeTimer,
  idempotent,
  startTimer,
  changeTimer,
  createManual,
  editTime,
  notes,
  createNote,
  summaries,
  monthlyReport,
  entryById,
} from './service.ts';

const text = (max = 200) => z.string().trim().min(1).max(max);
const uuid = z.uuid();
const role = z.enum(['contributor', 'manager', 'admin']);
const password = z.string().min(12, 'Utilisez au moins 12 caractères.').max(256);
const email = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const memberInput = z.object({ name: text(), email, password, role }).strict();
const projectInput = z
  .object({
    name: text(),
    description: z.string().trim().max(2000).default(''),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default('#087F75'),
    memberIds: z.array(uuid).max(1000).default([]),
    budgetSeconds: z.int().positive().max(360_000_000).nullable().optional(),
    dueOn: z.string().refine(validDate).nullable().optional(),
  })
  .strict();
const timerInput = z
  .object({
    projectId: uuid,
    taskId: uuid.nullable().optional(),
    actionId: uuid.nullable().optional(),
    description: z.string().trim().max(2000).default(''),
  })
  .strict();
const manualInput = timerInput.extend({
  kind: z.enum(['duration', 'interval']),
  duration: z.string().max(60).optional(),
  workDate: z.string().max(10).optional(),
  startedAt: z.string().max(60).optional(),
  endedAt: z.string().max(60).optional(),
  allowOverlap: z.boolean().default(false),
});
const noteInput = z
  .object({
    projectId: uuid,
    workDate: z.string().length(10),
    text: text(8000),
    shared: z.boolean().default(false),
  })
  .strict();
export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => schema.parse(value);
export const routeId = (request: FastifyRequest) =>
  parse(z.object({ id: uuid }), request.params).id;
export function registerRoutes(app: FastifyInstance, store: Store) {
  const actor = (r: FastifyRequest) => authenticate(store, r, !['GET', 'HEAD'].includes(r.method));
  const admin = (r: FastifyRequest) => {
    const m = actor(r);
    requireRole(m, 'admin');
    return m;
  };
  const manage = (r: FastifyRequest) => {
    const m = actor(r);
    requireRole(m, 'manager', 'admin');
    return m;
  };
  const key = (r: FastifyRequest) => String(r.headers['idempotency-key'] ?? '');
  const notify = <T>(result: T) => {
    store.changed();
    return result;
  };

  app.get('/api/v1/setup', async () => ({ required: !store.get('SELECT 1 FROM workspace') }));
  app.post(
    '/api/v1/setup',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const data = parse(
        memberInput.omit({ role: true }).extend({
          setupToken: text(256),
          workspaceName: text(),
          timezone: text(100).default('Europe/Paris'),
          native: z.boolean().default(false),
        }),
        request.body,
      );
      ensure(!store.get('SELECT 1 FROM workspace'), 'Cet espace est déjà initialisé.', 409);
      ensure(
        safeEqual(data.setupToken, store.setupToken),
        'Le secret d’installation est incorrect.',
        403,
      );
      ensure(validTimezone(data.timezone), 'Fuseau horaire invalide.');
      const encoded = await passwordHash(data.password);
      const member = store.tx(() => {
        ensure(!store.get('SELECT 1 FROM workspace'), 'Cet espace est déjà initialisé.', 409);
        const memberId = id();
        store.run('INSERT INTO workspace VALUES (?,?,?)', id(), data.workspaceName, data.timezone);
        store.run(
          "INSERT INTO members VALUES (?,?,?,'admin',1,?,?)",
          memberId,
          data.name,
          data.email,
          encoded,
          store.now(),
        );
        store.audit(memberId, 'workspace.setup', memberId);
        return store.get<MemberRow>('SELECT * FROM members WHERE id=?', memberId)!;
      });
      const session = newSession(store, member, data.native);
      if (!data.native)
        reply.setCookie('minutrel', session.token, {
          path: '/',
          httpOnly: true,
          secure: process.env.APP_SECURE_COOKIES === 'true',
          sameSite: 'strict',
          maxAge: 7 * 86400,
        });
      const publicSession = {
        member: session.member,
        workspace: session.workspace,
        csrf: session.csrf,
        serverNow: session.serverNow,
      };
      return notify(data.native ? session : publicSession);
    },
  );
  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const data = parse(
        z
          .object({ email, password: z.string().max(256), native: z.boolean().default(false) })
          .strict(),
        request.body,
      );
      const member = store.get<MemberRow>('SELECT * FROM members WHERE email=?', data.email);
      // Un hash factice garantit le même coût de calcul pour un compte inconnu.
      const matches = await passwordMatches(
        data.password,
        member?.password ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`,
      );
      ensure(member && member.enabled && matches, 'Adresse ou mot de passe incorrect.', 401);
      // La désactivation peut intervenir pendant le calcul du mot de passe.
      ensure(
        store.get<MemberRow>(
          'SELECT * FROM members WHERE id=? AND enabled=1 AND password=?',
          member.id,
          member.password,
        ),
        'Ce compte a changé. Reconnectez-vous.',
        401,
      );
      const session = newSession(store, member, data.native);
      if (!data.native)
        reply.setCookie('minutrel', session.token, {
          path: '/',
          httpOnly: true,
          secure: process.env.APP_SECURE_COOKIES === 'true',
          sameSite: 'strict',
          maxAge: 7 * 86400,
        });
      const publicSession = {
        member: session.member,
        workspace: session.workspace,
        csrf: session.csrf,
        serverNow: session.serverNow,
      };
      return data.native ? session : publicSession;
    },
  );
  app.get('/api/v1/me', async (r) => sessionDetails(store, r));
  app.post('/api/v1/auth/logout', async (r, reply) => {
    actor(r);
    const token = r.headers.authorization?.slice(7) ?? r.cookies.minutrel!;
    store.run('DELETE FROM sessions WHERE hash=?', hash(token));
    reply.clearCookie('minutrel', { path: '/' });
    return notify({ ok: true });
  });
  app.post('/api/v1/me/password', async (r) => {
    const member = actor(r);
    const data = parse(
      z.object({ currentPassword: z.string().max(256), password }).strict(),
      r.body,
    );
    ensure(
      await passwordMatches(data.currentPassword, member.password),
      'Le mot de passe actuel est incorrect.',
      403,
    );
    const encoded = await passwordHash(data.password);
    store.tx(() => {
      ensure(
        store.get(
          'SELECT 1 FROM members WHERE id=? AND password=? AND enabled=1',
          member.id,
          member.password,
        ),
        'Ce compte a changé. Reconnectez-vous.',
        401,
      );
      store.run('UPDATE members SET password=? WHERE id=?', encoded, member.id);
      store.run('DELETE FROM sessions WHERE memberId=?', member.id);
      store.run('DELETE FROM tokens WHERE memberId=?', member.id);
      store.audit(member.id, 'member.password', member.id);
    });
    return notify({ ok: true });
  });
  app.patch('/api/v1/workspace', async (r) => {
    const member = admin(r);
    const data = parse(z.object({ name: text(), timezone: text(100) }).strict(), r.body);
    ensure(validTimezone(data.timezone), 'Fuseau horaire invalide.');
    const old = store.get<Workspace>('SELECT * FROM workspace')!;
    ensure(
      data.timezone === old.timezone || !store.get('SELECT 1 FROM entries LIMIT 1'),
      'Le fuseau est figé après la première saisie afin de préserver les rapports.',
    );
    store.run('UPDATE workspace SET name=?,timezone=?', data.name, data.timezone);
    store.audit(member.id, 'workspace.update', old.id, data);
    return notify(store.get<Workspace>('SELECT * FROM workspace'));
  });
  app.get('/api/v1/members', async (r) => {
    manage(r);
    return store.all<MemberRow>('SELECT * FROM members ORDER BY name').map(publicMember);
  });
  app.post('/api/v1/members', async (r) => {
    const member = admin(r);
    const data = parse(memberInput, r.body);
    const encoded = await passwordHash(data.password);
    // Revérification après l'opération asynchrone.
    admin(r);
    ensure(
      !store.get('SELECT 1 FROM members WHERE email=?', data.email),
      'Cette adresse est déjà utilisée.',
      409,
    );
    const memberId = id();
    store.run(
      'INSERT INTO members VALUES (?,?,?,?,1,?,?)',
      memberId,
      data.name,
      data.email,
      data.role,
      encoded,
      store.now(),
    );
    store.audit(member.id, 'member.create', memberId, { role: data.role });
    return notify(
      publicMember(store.get<MemberRow>('SELECT * FROM members WHERE id=?', memberId)!),
    );
  });
  app.patch('/api/v1/members/:id', async (r) => {
    const member = admin(r);
    const memberId = routeId(r);
    const data = parse(
      z.object({ name: text(), email, role, enabled: z.boolean() }).strict(),
      r.body,
    );
    return notify(
      store.tx(() => {
        const previous = store.get<MemberRow>('SELECT * FROM members WHERE id=?', memberId);
        ensure(previous, 'Membre introuvable.', 404);
        ensure(
          !store.get('SELECT 1 FROM members WHERE email=? AND id!=?', data.email, memberId),
          'Cette adresse est déjà utilisée.',
          409,
        );
        if (
          previous.role === 'admin' &&
          previous.enabled &&
          (data.role !== 'admin' || !data.enabled)
        )
          ensure(
            store.get<{ n: number }>(
              "SELECT COUNT(*) n FROM members WHERE role='admin' AND enabled=1",
            )!.n > 1,
            'Conservez au moins un administrateur actif.',
          );
        ensure(
          data.enabled || !activeTimer(store, memberId),
          'Arrêtez explicitement le chronomètre de ce membre avant de le désactiver.',
          409,
        );
        store.run(
          'UPDATE members SET name=?,email=?,role=?,enabled=? WHERE id=?',
          data.name,
          data.email,
          data.role,
          data.enabled ? 1 : 0,
          memberId,
        );
        if (!data.enabled || previous.role !== data.role) {
          store.run('DELETE FROM sessions WHERE memberId=?', memberId);
          store.run('DELETE FROM tokens WHERE memberId=?', memberId);
        }
        store.audit(member.id, 'member.update', memberId, {
          before: publicMember(previous),
          after: data,
        });
        return publicMember(store.get<MemberRow>('SELECT * FROM members WHERE id=?', memberId)!);
      }),
    );
  });
  app.post('/api/v1/members/:id/password', async (r) => {
    const member = admin(r);
    const memberId = routeId(r);
    const data = parse(z.object({ password }).strict(), r.body);
    const encoded = await passwordHash(data.password);
    admin(r);
    ensure(store.get('SELECT 1 FROM members WHERE id=?', memberId), 'Membre introuvable.', 404);
    store.tx(() => {
      store.run('UPDATE members SET password=? WHERE id=?', encoded, memberId);
      store.run('DELETE FROM sessions WHERE memberId=?', memberId);
      store.run('DELETE FROM tokens WHERE memberId=?', memberId);
      store.audit(member.id, 'member.password_reset', memberId);
    });
    return notify({ ok: true });
  });
  app.post('/api/v1/members/:id/timer/stop', async (r) => {
    const member = admin(r);
    const memberId = routeId(r);
    const data = parse(
      z.object({ version: z.int().positive(), reason: text(2000).min(5) }).strict(),
      r.body,
    );
    return notify(
      store.tx(() => {
        const owner = store.get<MemberRow>('SELECT * FROM members WHERE id=?', memberId);
        ensure(owner, 'Membre introuvable.', 404);
        const timer = changeTimer(store, owner, 'stop', data.version);
        store.audit(member.id, 'timer.admin_resolve', timer.id, { memberId, reason: data.reason });
        return timer;
      }),
    );
  });
  app.get('/api/v1/members/:id/timer', async (r) => {
    admin(r);
    return { timer: activeTimer(store, routeId(r)), serverNow: store.now() };
  });

  app.get('/api/v1/projects', async (r) => projects(store, actor(r)));
  const validateMembers = (ids: string[]) => {
    for (const memberId of ids)
      ensure(
        store.get('SELECT 1 FROM members WHERE id=?', memberId),
        'Une affectation vise un membre inexistant.',
      );
  };
  app.post('/api/v1/projects', async (r) => {
    const member = manage(r);
    const data = parse(projectInput, r.body);
    validateMembers(data.memberIds);
    const projectId = id();
    store.tx(() => {
      store.run(
        'INSERT INTO projects(id,name,description,color,budgetSeconds,dueOn) VALUES (?,?,?,?,?,?)',
        projectId,
        data.name,
        data.description,
        data.color,
        data.budgetSeconds ?? null,
        data.dueOn ?? null,
      );
      for (const memberId of new Set(data.memberIds))
        store.run('INSERT INTO assignments VALUES (?,?)', projectId, memberId);
      store.audit(member.id, 'project.create', projectId, data);
    });
    return notify(projects(store, member).find((p) => p.id === projectId));
  });
  app.patch('/api/v1/projects/:id', async (r) => {
    const member = manage(r);
    const projectId = routeId(r);
    const data = parse(
      projectInput.extend({ version: z.int().positive(), archived: z.boolean() }),
      r.body,
    );
    validateMembers(data.memberIds);
    store.tx(() => {
      const previous = projectAccess(store, member, projectId, null, false);
      ensure(previous.version === data.version, 'Ce projet a changé. Actualisez.', 409);
      const active = store.all<{ memberId: string }>(
        "SELECT memberId FROM entries WHERE projectId=? AND state IN ('running','paused')",
        projectId,
      );
      ensure(
        !data.archived || active.length === 0,
        'Un chronomètre utilise encore ce projet.',
        409,
      );
      ensure(
        active.every(
          (a) =>
            data.memberIds.includes(a.memberId) ||
            store.get<MemberRow>('SELECT * FROM members WHERE id=?', a.memberId)!.role !==
              'contributor',
        ),
        'Un membre retiré utilise encore ce projet.',
        409,
      );
      store.run(
        'UPDATE projects SET name=?,description=?,color=?,archived=?,budgetSeconds=?,dueOn=?,version=version+1 WHERE id=?',
        data.name,
        data.description,
        data.color,
        data.archived ? 1 : 0,
        data.budgetSeconds === undefined ? (previous.budgetSeconds ?? null) : data.budgetSeconds,
        data.dueOn === undefined ? (previous.dueOn ?? null) : data.dueOn,
        projectId,
      );
      store.run('DELETE FROM assignments WHERE projectId=?', projectId);
      for (const memberId of new Set(data.memberIds))
        store.run('INSERT INTO assignments VALUES (?,?)', projectId, memberId);
      store.audit(member.id, 'project.update', projectId, data);
    });
    return notify(projects(store, member).find((p) => p.id === projectId));
  });
  app.post('/api/v1/projects/:id/tasks', async (r) => {
    const member = manage(r);
    const projectId = routeId(r);
    const data = parse(z.object({ name: text() }).strict(), r.body);
    projectAccess(store, member, projectId);
    const taskId = id();
    store.run('INSERT INTO tasks VALUES (?,?,?,0)', taskId, projectId, data.name);
    store.audit(member.id, 'task.create', taskId);
    return notify({ id: taskId, projectId, name: data.name, archived: false });
  });
  app.patch('/api/v1/tasks/:id', async (r) => {
    const member = manage(r);
    const taskId = routeId(r);
    const data = parse(z.object({ name: text(), archived: z.boolean() }).strict(), r.body);
    ensure(store.get('SELECT 1 FROM tasks WHERE id=?', taskId), 'Sous-catégorie introuvable.', 404);
    ensure(
      !data.archived ||
        !store.get(
          "SELECT 1 FROM entries WHERE taskId=? AND state IN ('running','paused')",
          taskId,
        ),
      'Terminez le chronomètre avant d’archiver cette sous-catégorie.',
      409,
    );
    store.run(
      'UPDATE tasks SET name=?,archived=? WHERE id=?',
      data.name,
      data.archived ? 1 : 0,
      taskId,
    );
    store.audit(member.id, 'task.update', taskId, data);
    return notify({ ok: true });
  });

  app.get('/api/v1/timer', async (r) => {
    const m = actor(r);
    return { timer: activeTimer(store, m.id), serverNow: store.now() };
  });
  app.post('/api/v1/timer/start', async (r) => {
    const m = actor(r);
    const data = parse(timerInput, r.body);
    return notify(
      idempotent(store, m, key(r), 'timer.start', data, () => startTimer(store, m, data)),
    );
  });
  for (const action of ['pause', 'resume', 'stop'] as const)
    app.post(`/api/v1/timer/${action}`, async (r) => {
      const m = actor(r);
      const data = parse(z.object({ version: z.int().positive() }).strict(), r.body);
      return notify(
        idempotent(store, m, key(r), `timer.${action}`, data, () =>
          changeTimer(store, m, action, data.version),
        ),
      );
    });
  app.get('/api/v1/time-entries', async (r) => {
    const member = actor(r);
    const q = parse(
      z
        .object({
          memberId: z.union([uuid, z.literal('me')]).optional(),
          month: z.string().optional(),
          offset: z.coerce.number().int().min(0).default(0),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .strict(),
      r.query,
    );
    const memberId =
      member.role === 'contributor' || q.memberId === 'me' || !q.memberId ? member.id : q.memberId;
    if (member.role === 'contributor' && q.memberId && q.memberId !== 'me')
      ensure(q.memberId === member.id, 'Vous ne pouvez lire que vos temps.', 403);
    const timezone = store.get<Workspace>('SELECT * FROM workspace')!.timezone;
    if (q.month) monthBounds(q.month, timezone);
    return {
      ...queryEntries(store, memberId, {
        month: q.month,
        timezone,
        offset: q.offset,
        limit: q.limit,
      }),
      serverNow: store.now(),
    };
  });
  app.post('/api/v1/time-entries', async (r) => {
    const m = actor(r);
    const data = parse(manualInput, r.body);
    return notify(
      idempotent(store, m, key(r), 'time.create', data, () => createManual(store, m, data)),
    );
  });
  app.patch('/api/v1/time-entries/:id', async (r) => {
    const m = actor(r);
    const data = parse(
      manualInput.extend({ version: z.int().positive(), reason: text(2000).min(5) }),
      r.body,
    );
    return notify(store.tx(() => editTime(store, m, routeId(r), data)));
  });
  app.patch('/api/v1/time-entries/:id/description', async (r) => {
    const m = actor(r);
    const entryId = routeId(r);
    const data = parse(
      z
        .object({
          description: z.string().trim().max(2000),
          version: z.int().positive(),
          reason: text(2000).min(5),
        })
        .strict(),
      r.body,
    );
    return notify(
      store.tx(() => {
        const previous = entryById(store, entryId);
        ensure(previous.state === 'finished', 'Seuls les temps finalisés peuvent être corrigés.');
        ensure(
          previous.memberId === m.id || m.role !== 'contributor',
          'Vous ne pouvez pas modifier ce temps.',
          403,
        );
        ensure(previous.version === data.version, 'Ce temps a changé. Actualisez.', 409);
        requireOpenWeek(store, previous.memberId, previous.workDate, previous.segments);
        store.run(
          'UPDATE entries SET description=?,version=version+1,updatedAt=? WHERE id=?',
          data.description,
          store.now(),
          entryId,
        );
        store.audit(m.id, 'time.description', entryId, {
          reason: data.reason,
          before: previous.description,
          after: data.description,
        });
        return entryById(store, entryId);
      }),
    );
  });
  app.delete('/api/v1/time-entries/:id', async (r) => {
    const m = actor(r);
    const entryId = routeId(r);
    const data = parse(
      z.object({ version: z.int().positive(), reason: text(2000).min(5) }).strict(),
      r.body,
    );
    const e = entryById(store, entryId);
    return notify(
      store.tx(() =>
        editTime(
          store,
          m,
          entryId,
          {
            ...data,
            projectId: e.projectId,
            taskId: e.taskId,
            description: e.description,
            kind: 'duration',
          },
          true,
        ),
      ),
    );
  });

  app.get('/api/v1/notes', async (r) => notes(store, actor(r).id));
  app.post('/api/v1/notes', async (r) => {
    const m = actor(r);
    const data = parse(noteInput, r.body);
    return notify(createNote(store, m, data));
  });
  app.patch('/api/v1/notes/:id', async (r) => {
    const m = actor(r);
    const noteId = routeId(r);
    const data = parse(z.object({ text: text(8000), shared: z.boolean() }).strict(), r.body);
    ensure(
      store.get('SELECT 1 FROM notes WHERE id=? AND memberId=?', noteId, m.id),
      'Note introuvable.',
      404,
    );
    store.run(
      'UPDATE notes SET text=?,shared=?,updatedAt=? WHERE id=?',
      data.text,
      data.shared ? 1 : 0,
      store.now(),
      noteId,
    );
    store.audit(m.id, 'note.update', noteId, { shared: data.shared });
    return notify(notes(store, m.id).find((n) => n.id === noteId));
  });
  app.delete('/api/v1/notes/:id', async (r) => {
    const m = actor(r);
    const noteId = routeId(r);
    ensure(
      store.get('SELECT 1 FROM notes WHERE id=? AND memberId=?', noteId, m.id),
      'Note introuvable.',
      404,
    );
    store.run('DELETE FROM notes WHERE id=?', noteId);
    store.audit(m.id, 'note.delete', noteId);
    return notify({ ok: true });
  });
  app.get('/api/v1/summaries', async (r) => summaries(store, actor(r).id));
  app.post('/api/v1/summaries', async (r) => {
    const m = actor(r);
    const data = parse(z.object({ month: z.string(), text: text(8000) }).strict(), r.body);
    monthBounds(data.month, store.get<Workspace>('SELECT * FROM workspace')!.timezone);
    const summaryId = id();
    store.run(
      "INSERT INTO summaries VALUES (?,?,?,?,'draft','human','[]',?,NULL)",
      summaryId,
      m.id,
      data.month,
      data.text,
      store.now(),
    );
    return notify(summaries(store, m.id).find((s) => s.id === summaryId));
  });
  app.patch('/api/v1/summaries/:id', async (r) => {
    const m = actor(r);
    const summaryId = routeId(r);
    const data = parse(
      z.object({ text: text(8000), status: z.enum(['draft', 'approved']) }).strict(),
      r.body,
    );
    ensure(
      store.get('SELECT 1 FROM summaries WHERE id=? AND memberId=?', summaryId, m.id),
      'Compte rendu introuvable.',
      404,
    );
    if (data.status === 'approved')
      store.run(
        "UPDATE summaries SET status='draft',approvedAt=NULL WHERE memberId=? AND month=(SELECT month FROM summaries WHERE id=?)",
        m.id,
        summaryId,
      );
    store.run(
      'UPDATE summaries SET text=?,status=?,approvedAt=? WHERE id=?',
      data.text,
      data.status,
      data.status === 'approved' ? store.now() : null,
      summaryId,
    );
    store.audit(m.id, 'summary.review', summaryId, { status: data.status });
    return notify(summaries(store, m.id).find((s) => s.id === summaryId));
  });
  app.get('/api/v1/reports/monthly', async (r) => {
    const m = actor(r);
    const q = parse(
      z
        .object({
          month: z.string(),
          memberIds: z.string().optional(),
          approvedOnly: z.enum(['true', 'false']).optional(),
        })
        .strict(),
      r.query,
    );
    const ids = q.memberIds ? parse(z.array(uuid).max(1000), q.memberIds.split(',')) : undefined;
    if (m.role !== 'admin')
      ensure(
        !ids || ids.every((memberId) => memberId === m.id),
        'Les rapports de l’équipe sont réservés aux administrateurs.',
        403,
      );
    return monthlyReport(
      store,
      q.month,
      m.role === 'admin' ? ids : [m.id],
      100,
      q.approvedOnly === 'true',
    );
  });
  app.get('/api/v1/audit', async (r) => {
    admin(r);
    return store.all(
      'SELECT a.id,a.action,a.objectId,a.createdAt,m.name actorName,a.detail FROM audit a LEFT JOIN members m ON m.id=a.actorId ORDER BY a.createdAt DESC,a.rowid DESC LIMIT 200',
    );
  });

  app.get('/api/v1/mcp-tokens', async (r) => {
    const m = actor(r);
    return store
      .all<{ id: string; name: string; scopes: string; expiresAt: number; createdAt: number }>(
        'SELECT id,name,scopes,expiresAt,createdAt FROM tokens WHERE memberId=? AND expiresAt>?',
        m.id,
        store.now(),
      )
      .map((t) => ({ ...t, scopes: JSON.parse(t.scopes) as string[] }));
  });
  app.post('/api/v1/mcp-tokens', async (r) => {
    const m = actor(r);
    const data = parse(
      z
        .object({
          name: text(),
          scopes: z.array(z.enum(mcpScopes)).min(1).max(5),
          days: z.int().min(1).max(365).default(30),
        })
        .strict(),
      r.body,
    );
    const token = `mcp_${secret()}`;
    const tokenId = id();
    const expiresAt = store.now() + data.days * 86400;
    store.run(
      'INSERT INTO tokens VALUES (?,?,?,?,?,?,?)',
      tokenId,
      hash(token),
      m.id,
      data.name,
      JSON.stringify([...new Set(data.scopes)]),
      expiresAt,
      store.now(),
    );
    store.audit(m.id, 'mcp.token_create', tokenId, { scopes: data.scopes, expiresAt });
    return { id: tokenId, name: data.name, scopes: data.scopes, expiresAt, token };
  });
  app.delete('/api/v1/mcp-tokens/:id', async (r) => {
    const m = actor(r);
    const tokenId = routeId(r);
    store.run('DELETE FROM tokens WHERE id=? AND memberId=?', tokenId, m.id);
    store.audit(m.id, 'mcp.token_revoke', tokenId);
    return { ok: true };
  });
}
