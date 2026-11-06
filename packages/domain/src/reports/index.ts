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
export function monthBounds(month: string, timezone: string): { from: number; to: number } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new RangeError('Le mois doit être au format AAAA-MM.');
  const date = Temporal.PlainDate.from(`${month}-01`);
  return {
    from: date.toZonedDateTime(timezone).epochMilliseconds / 1000,
    to: date.add({ months: 1 }).toZonedDateTime(timezone).epochMilliseconds / 1000,
  };
}
/** Les intervalles sont semi-ouverts : [début, fin[. Une pause ne fait partie d'aucun segment. */
export function secondsInMonth(
  entry: {
    kind: string;
    workDate: string | null;
    seconds: number;
    segments: readonly { startedAt: number; endedAt: number | null }[];
  },
  month: string,
  timezone: string,
): number {
  const { from, to } = monthBounds(month, timezone);
  if (entry.kind === 'duration') return entry.workDate?.startsWith(`${month}-`) ? entry.seconds : 0;
  return entry.segments.reduce(
    (sum, segment) =>
      sum +
      (segment.endedAt === null
        ? 0
        : Math.max(0, Math.min(segment.endedAt, to) - Math.max(segment.startedAt, from))),
    0,
  );
}
/** ISO 8601 avec fuseau explicite uniquement, arrondi interdit. */
export function instantSeconds(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new RangeError('Précisez un horodatage ISO avec son fuseau.');
  const ms = Temporal.Instant.from(value).epochMilliseconds;
  if (ms % 1000 !== 0) throw new RangeError('Les horodatages doivent être en secondes entières.');
  return ms / 1000;
}
