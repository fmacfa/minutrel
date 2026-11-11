// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from 'react';
import {
  addDays,
  daysBetween,
  presetSchedule,
  schedulePeriods,
  validDate,
  type SchedulePeriod,
  type SchedulePreset,
  type ScheduleRange,
} from '@minutrel/domain/reports';
import { locale, t as tr } from './i18n.ts';

type ScheduleChoice = SchedulePreset | 'custom';
const choices: Record<ScheduleChoice, string> = {
  '6w': tr('6 semaines'),
  '3m': tr('3 mois'),
  '6m': tr('6 mois'),
  '12m': tr('12 mois'),
  '3y': tr('3 ans'),
  '5y': tr('5 ans'),
  custom: tr('Dates personnalisées'),
};
const earliest = '0001-01-01';
const latest = '9999-12-30';
const validRange = ({ start, end }: ScheduleRange) =>
  validDate(start) && validDate(end) && start >= earliest && end > start;

export function useSchedule(today: string) {
  const [selection, setSelection] = useState<ScheduleRange & { preset: ScheduleChoice }>(() => ({
    ...presetSchedule(today, '6w'),
    preset: '6w',
  }));
  const { start, end, preset } = selection;
  const periods = useMemo(() => schedulePeriods({ start, end }, preset), [start, end, preset]);
  return { selection, setSelection, periods };
}

export function calendarLabel(date: string, long = false) {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...(long ? { year: 'numeric' } : {}),
  }).format(new Date(`${date}T00:00:00Z`));
}

export function periodLabel(period: SchedulePeriod) {
  if (period.unit === 'week') return calendarLabel(period.start);
  const year = Number(period.start.slice(0, 4));
  const month = Number(period.start.slice(5, 7));
  if (period.unit === 'quarter') return tr('T{0} {1}', Math.ceil(month / 3), year);
  if (period.unit === 'year') {
    const lastYear = Number(addDays(period.end, -1).slice(0, 4));
    return year === lastYear ? String(year) : `${year} – ${lastYear}`;
  }
  return new Intl.DateTimeFormat(locale(), {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period.start}T00:00:00Z`));
}

export const scheduleLabel = ({ start, end }: ScheduleRange) =>
  `${calendarLabel(start, true)} – ${calendarLabel(addDays(end, -1), true)}`;

export function ScheduleWindow({ schedule }: { schedule: ReturnType<typeof useSchedule> }) {
  const { selection, setSelection } = schedule;
  const { start, end, preset } = selection;
  const lastDate = addDays(end, -1);
  const change = (range: ScheduleRange, nextPreset = preset) => {
    if (validRange(range)) setSelection({ ...range, preset: nextPreset });
  };
  const adjacent = (direction: number) => {
    if (preset !== 'custom') return presetSchedule(start, preset, direction);
    const offset = direction * daysBetween(start, end);
    return { start: addDays(start, offset), end: addDays(end, offset) };
  };
  const previous = adjacent(-1);
  const next = adjacent(1);
  return (
    <div className="schedule-window">
      <label className="inline-field">
        {tr('Période')}
        <select
          value={preset}
          onChange={(e) => {
            const value = e.target.value as ScheduleChoice;
            change(value === 'custom' ? { start, end } : presetSchedule(start, value), value);
          }}
        >
          {Object.entries(choices).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button secondary"
        aria-label={tr('Période précédente')}
        disabled={!validRange(previous)}
        onClick={() => change(previous)}
      >
        ‹
      </button>
      <label className="inline-field">
        {tr('À partir de')}
        <input
          type="date"
          value={start}
          min={earliest}
          max={latest}
          onChange={(e) => {
            const date = e.target.value;
            if (!validDate(date) || !e.target.validity.valid) return;
            if (preset === 'custom')
              change({ start: date, end: date < end ? end : addDays(date, 1) });
            else change(presetSchedule(date, preset));
          }}
        />
      </label>
      {preset === 'custom' && (
        <label className="inline-field">
          {tr('Jusqu’au')}
          <input
            type="date"
            value={lastDate}
            min={start}
            max={latest}
            onChange={(e) => {
              if (validDate(e.target.value) && e.target.validity.valid)
                change({ start, end: addDays(e.target.value, 1) });
            }}
          />
        </label>
      )}
      <button
        type="button"
        className="button secondary"
        aria-label={tr('Période suivante')}
        disabled={!validRange(next)}
        onClick={() => change(next)}
      >
        ›
      </button>
      {preset !== 'custom' && (
        <span className="quiet schedule-dates">{scheduleLabel(selection)}</span>
      )}
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
