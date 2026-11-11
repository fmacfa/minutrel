// SPDX-License-Identifier: AGPL-3.0-or-later
import { Temporal } from '@js-temporal/polyfill';

export function validDate(value: string): boolean {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}
export function validTimezone(value: string): boolean {
  try {
    Temporal.Now.zonedDateTimeISO(value);
    return true;
  } catch {
    return false;
  }
}
export function dateInZone(seconds: number, timezone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(seconds * 1000)
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();
}
export interface CalendarRange {
  start: string;
  end: string;
  from: number;
  to: number;
}
export function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function daysBetween(start: string, end: string): number {
  return Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(end)).days;
}
export function mondayOf(date: string): string {
  const day = Temporal.PlainDate.from(date);
  return day.subtract({ days: day.dayOfWeek - 1 }).toString();
}
export function scheduledSpan(action: { startOn: string | null; dueOn: string | null }) {
  const start = action.startOn ?? action.dueOn;
  return start ? { start, end: addDays(action.dueOn ?? start, 1) } : null;
}
function workdaysBetween(start: string, end: string): number {
  const first = Temporal.PlainDate.from(start);
  const days = Math.max(0, first.until(Temporal.PlainDate.from(end)).days);
  let count = Math.floor(days / 7) * 5;
  for (let offset = 0; offset < days % 7; offset++) {
    if ((first.dayOfWeek - 1 + offset) % 7 < 5) count++;
  }
  return count;
}
export function plannedSeconds(
  span: { start: string; end: string },
  estimate: number,
  from: string,
  to: string,
): number {
  if (span.start >= to || span.end <= from) return 0;
  const days = workdaysBetween(span.start, span.end);
  if (!days) return span.start >= from ? estimate : 0;
  // Differences of cumulative totals preserve the exact estimate across periods.
  const cumulative = (date: string) =>
    Math.floor((estimate * workdaysBetween(span.start, date < span.end ? date : span.end)) / days);
  return cumulative(to) - cumulative(from);
}
export function calendarRange(start: string, end: string, timezone: string): CalendarRange {
  return {
    start,
    end,
    from: Temporal.PlainDate.from(start).toZonedDateTime(timezone).epochMilliseconds / 1000,
    to: Temporal.PlainDate.from(end).toZonedDateTime(timezone).epochMilliseconds / 1000,
  };
}
export function weekRange(start: string, timezone: string): CalendarRange {
  if (!validDate(start) || mondayOf(start) !== start)
    throw new RangeError('La semaine doit commencer un lundi.');
  return calendarRange(start, addDays(start, 7), timezone);
}
export function monthRange(month: string, timezone: string): CalendarRange {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new RangeError('Le mois doit être au format AAAA-MM.');
  const date = Temporal.PlainDate.from(`${month}-01`);
  return calendarRange(date.toString(), date.add({ months: 1 }).toString(), timezone);
}
export function monthBounds(month: string, timezone: string): { from: number; to: number } {
  const { from, to } = monthRange(month, timezone);
  return { from, to };
}
/** Les intervalles sont semi-ouverts : [début, fin[. Une pause ne fait partie d'aucun segment. */
export function secondsInRange(
  entry: {
    kind: string;
    workDate: string | null;
    seconds: number;
    segments: readonly { startedAt: number; endedAt: number | null }[];
  },
  range: CalendarRange,
): number {
  const { from, to, start, end } = range;
  if (entry.kind === 'duration')
    return entry.workDate && entry.workDate >= start && entry.workDate < end ? entry.seconds : 0;
  return entry.segments.reduce(
    (sum, segment) =>
      sum +
      (segment.endedAt === null
        ? 0
        : Math.max(0, Math.min(segment.endedAt, to) - Math.max(segment.startedAt, from))),
    0,
  );
}
export function secondsInMonth(
  entry: Parameters<typeof secondsInRange>[0],
  month: string,
  timezone: string,
): number {
  return secondsInRange(entry, monthRange(month, timezone));
}
/** ISO 8601 avec fuseau explicite uniquement, arrondi interdit. */
export function instantSeconds(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new RangeError('Précisez un horodatage ISO avec son fuseau.');
  const ms = Temporal.Instant.from(value).epochMilliseconds;
  if (ms % 1000 !== 0) throw new RangeError('Les horodatages doivent être en secondes entières.');
  return ms / 1000;
}
