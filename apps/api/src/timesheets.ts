// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import type { Timesheet, TimesheetDetail, Workspace } from '@minutrel/contracts';
import { dateInZone, mondayOf, weekRange, type CalendarRange } from '@minutrel/domain/reports';
import { z } from 'zod';
import { authenticate, requireRole, type MemberRow } from './auth.ts';
import { entriesByIds } from './service.ts';
import { ensure, type Store } from './store.ts';
import { timeSlices } from './time-slices.ts';

type WeekRecord = Pick<
  Timesheet,
  'status' | 'version' | 'submittedAt' | 'reviewedAt' | 'reason'
> & {
  memberId: string;
  reviewerName: string | null;
};
type SheetMember = Pick<MemberRow, 'id' | 'name' | 'enabled'>;
const pathId = z.object({ id: z.uuid() });
const weekQuery = z.object({ weekStart: z.string().length(10) }).strict();

function activeMembers(store: Store, range: CalendarRange) {
  return new Set(
    store
      .all<{ memberId: string }>(
        `SELECT DISTINCT e.memberId FROM entries e JOIN segments s ON s.entryId=e.id
        WHERE e.state IN ('running','paused') AND s.startedAt<?
          AND COALESCE(s.endedAt,MAX(s.startedAt+1,?))>?`,
        range.to,
        store.now() + 1,
        range.from,
      )
      .map((row) => row.memberId),
  );
}

function readWeek(
  store: Store,
  weekStart: string,
  members: SheetMember[],
): { sheets: Timesheet[]; slices: ReturnType<typeof timeSlices> } {
  const timezone = store.get<Workspace>('SELECT * FROM workspace')!.timezone;
  const range = weekRange(weekStart, timezone);
  const slices = timeSlices(store, { range, timezone, memberIds: members.map((m) => m.id) });
  const totals = new Map<string, number>();
  for (const e of slices) totals.set(e.memberId, (totals.get(e.memberId) ?? 0) + e.reportSeconds);
  const records = new Map(
    store
      .all<WeekRecord>(
        `SELECT w.*,m.name reviewerName FROM timesheets w LEFT JOIN members m ON m.id=w.reviewerId
        WHERE w.weekStart=?`,
        weekStart,
      )
      .map((r) => [r.memberId, r]),
  );
  const active = activeMembers(store, range);
  return {
    sheets: members.map((m) => {
      const row = records.get(m.id);
      return {
        memberId: m.id,
        memberName: m.name,
        weekStart,
        status: row?.status ?? 'draft',
        version: row?.version ?? 0,
        seconds: totals.get(m.id) ?? 0,
        hasActiveTime: active.has(m.id),
        submittedAt: row?.submittedAt ?? null,
        reviewedAt: row?.reviewedAt ?? null,
        reviewerName: row?.reviewerName ?? null,
        reason: row?.reason ?? '',
      };
    }),
    slices,
  };
}

export function registerTimesheets(app: FastifyInstance, store: Store) {
  app.get('/api/v1/timesheets', async (r) => {
    const actor = authenticate(store, r);
    const { weekStart } = weekQuery.parse(r.query);
    const members =
      actor.role === 'contributor'
        ? [actor]
        : store.all<SheetMember>('SELECT id,name,enabled FROM members ORDER BY name,id');
    const { sheets } = readWeek(store, weekStart, members);
    return sheets.filter(
      (sheet, i) => members[i]!.enabled || sheet.seconds > 0 || sheet.status !== 'draft',
    );
  });

  app.get('/api/v1/timesheets/:id', async (r): Promise<TimesheetDetail> => {
    const actor = authenticate(store, r);
    const memberId = pathId.parse(r.params).id;
    ensure(
      actor.id === memberId || actor.role !== 'contributor',
      'Vous ne pouvez lire que vos temps.',
      403,
    );
    const { weekStart, offset } = weekQuery
      .extend({ offset: z.coerce.number().int().nonnegative().default(0) })
      .parse(r.query);
    const member = store.get<SheetMember>(
      'SELECT id,name,enabled FROM members WHERE id=?',
      memberId,
    );
    ensure(member, 'Membre introuvable.', 404);
    const { sheets, slices } = readWeek(store, weekStart, [member]);
    const page = slices.slice(offset, offset + 50);
    const seconds = new Map(page.map((slice) => [slice.id, slice.reportSeconds]));
    return {
      sheet: sheets[0]!,
      entryCount: slices.length,
      entries: entriesByIds(
        store,
        page.map((slice) => slice.id),
      ).map((entry) => ({
        ...entry,
        reportSeconds: seconds.get(entry.id)!,
      })),
    };
  });

  app.patch('/api/v1/timesheets/:id', async (r) => {
    const actor = authenticate(store, r, true);
    const memberId = pathId.parse(r.params).id;
    const data = weekQuery
      .extend({
        status: z.enum(['submitted', 'approved', 'returned']),
        version: z.int().nonnegative(),
        reason: z.string().trim().max(2000).default(''),
      })
      .parse(r.body);
    if (data.status === 'submitted')
      ensure(actor.id === memberId, 'Vous soumettez uniquement votre feuille de temps.', 403);
    else requireRole(actor, 'manager', 'admin');
    const member = store.get<SheetMember>(
      'SELECT id,name,enabled FROM members WHERE id=?',
      memberId,
    );
    ensure(member, 'Membre introuvable.', 404);
    const timezone = store.get<Workspace>('SELECT * FROM workspace')!.timezone;
    const range = weekRange(data.weekStart, timezone);
    ensure(
      data.weekStart <= mondayOf(dateInZone(store.now(), timezone)),
      'Cette semaine n’a pas commencé.',
    );
    const sheet = store.tx(() => {
      const current = store.get<{
        status: Timesheet['status'];
        version: number;
        submittedAt: number;
      }>(
        'SELECT status,version,submittedAt FROM timesheets WHERE memberId=? AND weekStart=?',
        memberId,
        data.weekStart,
      );
      ensure((current?.version ?? 0) === data.version, 'Cette feuille a changé. Actualisez.', 409);
      const now = store.now();
      if (data.status === 'submitted') {
        ensure(!current || current.status === 'returned', 'Cette feuille a déjà été soumise.', 409);
        ensure(
          !activeMembers(store, range).has(memberId),
          'Terminez le chronomètre de cette semaine avant de la soumettre.',
          409,
        );
        store.run(
          `INSERT INTO timesheets(memberId,weekStart,status,version,submittedAt) VALUES (?,?,'submitted',?,?)
          ON CONFLICT(memberId,weekStart) DO UPDATE SET status='submitted',version=excluded.version,
          submittedAt=excluded.submittedAt,reviewedAt=NULL,reviewerId=NULL,reason=''`,
          memberId,
          data.weekStart,
          data.version + 1,
          now,
        );
      } else {
        ensure(
          current?.status === 'submitted' ||
            (current?.status === 'approved' && data.status === 'returned'),
          'Cette feuille doit être soumise avant validation.',
          409,
        );
        ensure(
          data.status !== 'returned' || data.reason.length > 0,
          'Indiquez la correction attendue.',
        );
        store.run(
          'UPDATE timesheets SET status=?,version=version+1,reviewedAt=?,reviewerId=?,reason=? WHERE memberId=? AND weekStart=?',
          data.status,
          now,
          actor.id,
          data.reason,
          memberId,
          data.weekStart,
        );
      }
      store.audit(actor.id, `timesheet.${data.status}`, memberId, {
        weekStart: data.weekStart,
        reason: data.reason,
        version: data.version + 1,
      });
      return readWeek(store, data.weekStart, [member]).sheets[0]!;
    });
    store.changed();
    return sheet;
  });
}
