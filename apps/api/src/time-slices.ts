// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Segment } from '@minutrel/contracts';
import {
  addDays,
  dateInZone,
  mondayOf,
  weekRange,
  type CalendarRange,
} from '@minutrel/domain/reports';
import type { SQLInputValue } from 'node:sqlite';
import { ensure, type Store } from './store.ts';

export interface TimeSlice {
  id: string;
  memberId: string;
  projectId: string;
  taskId: string | null;
  reportSeconds: number;
}

export function timeSlices(
  store: Store,
  filter: {
    memberIds?: readonly string[];
    projectId?: string;
    range?: CalendarRange;
    approved?: boolean;
    timezone: string;
  },
): TimeSlice[] {
  const where = ["e.state='finished'"];
  const params: SQLInputValue[] = [];
  if (filter.memberIds) {
    if (!filter.memberIds.length) return [];
    where.push('e.memberId IN (SELECT value FROM json_each(?))');
    params.push(JSON.stringify(filter.memberIds));
  }
  if (filter.projectId) {
    where.push('e.projectId=?');
    params.push(filter.projectId);
  }
  const fields = 'e.id,e.memberId,e.projectId,e.taskId,e.createdAt';
  const range = filter.range;
  if (!range)
    return store.all<TimeSlice>(
      `SELECT ${fields},e.seconds reportSeconds FROM entries e WHERE ${where.join(' AND ')} ORDER BY e.createdAt DESC,e.id`,
      ...params,
    );
  if (filter.approved) {
    const windows = store
      .all<{ memberId: string; weekStart: string }>(
        "SELECT memberId,weekStart FROM timesheets WHERE status='approved' AND weekStart>=? AND weekStart<?",
        addDays(range.start, -6),
        range.end,
      )
      .filter((row) => !filter.memberIds || filter.memberIds.includes(row.memberId))
      .map((row) => {
        const week = weekRange(row.weekStart, filter.timezone);
        return {
          memberId: row.memberId,
          start: week.start > range.start ? week.start : range.start,
          end: week.end < range.end ? week.end : range.end,
          from: Math.max(week.from, range.from),
          to: Math.min(week.to, range.to),
        };
      });
    if (!windows.length) return [];
    return store.all<TimeSlice>(
      `WITH approved AS MATERIALIZED (
        SELECT json_extract(value,'$.memberId') memberId,json_extract(value,'$.start') startDate,
          json_extract(value,'$.end') endDate,json_extract(value,'$.from') startTime,
          json_extract(value,'$.to') endTime FROM json_each(?)
      )
      SELECT * FROM (
        SELECT ${fields},SUM(CASE WHEN e.kind='duration' THEN e.seconds
          ELSE COALESCE((SELECT SUM(MIN(s.endedAt,w.endTime)-MAX(s.startedAt,w.startTime))
            FROM segments s WHERE s.entryId=e.id AND s.endedAt>w.startTime AND s.startedAt<w.endTime),0)
          END) reportSeconds
        FROM entries e JOIN approved w ON w.memberId=e.memberId
          AND (e.kind!='duration' OR (e.workDate>=w.startDate AND e.workDate<w.endDate))
        WHERE ${where.join(' AND ')} GROUP BY e.id
      ) WHERE reportSeconds>0 ORDER BY createdAt DESC,id`,
      JSON.stringify(windows),
      ...params,
    );
  }
  return store.all<TimeSlice>(
    `SELECT * FROM (
      SELECT ${fields},CASE WHEN e.kind='duration' THEN
        CASE WHEN e.workDate>=? AND e.workDate<? THEN e.seconds ELSE 0 END
        ELSE COALESCE((SELECT SUM(MIN(s.endedAt,?)-MAX(s.startedAt,?))
          FROM segments s WHERE s.entryId=e.id AND s.endedAt>? AND s.startedAt<?),0)
        END reportSeconds
      FROM entries e WHERE ${where.join(' AND ')}
    ) WHERE reportSeconds>0 ORDER BY createdAt DESC,id`,
    range.start,
    range.end,
    range.to,
    range.from,
    range.from,
    range.to,
    ...params,
  );
}

export const lockedWeekMessage = 'Cette semaine est soumise ou approuvée. Demandez sa réouverture.';

export function requireOpenWeek(
  store: Store,
  memberId: string,
  workDate: string | null,
  segments: readonly Segment[],
) {
  if (workDate) {
    ensure(
      !store.get(
        "SELECT 1 FROM timesheets WHERE memberId=? AND weekStart=? AND status IN ('submitted','approved')",
        memberId,
        mondayOf(workDate),
      ),
      lockedWeekMessage,
      409,
    );
    return;
  }
  if (
    !segments.length ||
    !store.get(
      "SELECT 1 FROM timesheets WHERE memberId=? AND status IN ('submitted','approved') LIMIT 1",
      memberId,
    )
  )
    return;
  const timezone = store.get<{ timezone: string }>('SELECT timezone FROM workspace')!.timezone;
  const now = store.now();
  const end = (s: Segment) => s.endedAt ?? Math.max(now + 1, s.startedAt + 1);
  let earliest = Infinity;
  let latest = -Infinity;
  for (const segment of segments) {
    earliest = Math.min(earliest, segment.startedAt);
    latest = Math.max(latest, segment.startedAt, end(segment) - 1);
  }
  const first = mondayOf(dateInZone(earliest, timezone));
  const last = dateInZone(latest, timezone);
  const locked = store.all<{ weekStart: string }>(
    "SELECT weekStart FROM timesheets WHERE memberId=? AND weekStart>=? AND weekStart<=? AND status IN ('submitted','approved')",
    memberId,
    first,
    last,
  );
  for (const { weekStart } of locked) {
    const range = weekRange(weekStart, timezone);
    ensure(
      !segments.some((s) => end(s) > s.startedAt && s.startedAt < range.to && end(s) > range.from),
      lockedWeekMessage,
      409,
    );
  }
}
