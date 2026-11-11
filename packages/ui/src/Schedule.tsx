// SPDX-License-Identifier: AGPL-3.0-or-later
import { addDays, mondayOf, validDate } from '@minutrel/domain/reports';
import { locale, t as tr } from './i18n.ts';

export const scheduleWeeks = 6;
export const weekStarts = (start: string) =>
  Array.from({ length: scheduleWeeks }, (_, i) => addDays(start, i * 7));

export function calendarLabel(date: string, long = false) {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...(long ? { year: 'numeric' } : {}),
  }).format(new Date(`${date}T00:00:00Z`));
}

export function ScheduleWindow({
  start,
  onChange,
}: {
  start: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="schedule-window">
      <button
        type="button"
        className="button secondary"
        aria-label={tr('Période précédente')}
        onClick={() => onChange(addDays(start, -scheduleWeeks * 7))}
      >
        ‹
      </button>
      <label className="inline-field">
        {tr('À partir de')}
        <input
          type="date"
          value={start}
          onChange={(e) => {
            if (validDate(e.target.value)) onChange(mondayOf(e.target.value));
          }}
        />
      </label>
      <button
        type="button"
        className="button secondary"
        aria-label={tr('Période suivante')}
        onClick={() => onChange(addDays(start, scheduleWeeks * 7))}
      >
        ›
      </button>
    </div>
  );
}

export function PageControls({
  offset,
  count,
  onChange,
}: {
  offset: number;
  count: number;
  onChange: (value: number) => void;
}) {
  if (count <= 50 && offset === 0) return null;
  return (
    <div className="button-group page-controls">
      <button
        type="button"
        className="button secondary"
        disabled={offset === 0}
        onClick={() => onChange(offset - 50)}
      >
        {tr('Précédent')}
      </button>
      <span className="quiet">{tr('Page {0}', Math.floor(offset / 50) + 1)}</span>
      <button
        type="button"
        className="button secondary"
        disabled={offset + 50 >= count}
        onClick={() => onChange(offset + 50)}
      >
        {tr('Suivant')}
      </button>
    </div>
  );
}
