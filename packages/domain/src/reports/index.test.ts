// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import {
  validDate,
  validTimezone,
  dateInZone,
  monthBounds,
  instantSeconds,
  secondsInMonth,
  addDays,
  daysBetween,
  mondayOf,
  weekRange,
  scheduledSpan,
  plannedSeconds,
  presetSchedule,
  schedulePeriods,
} from './index.ts';

describe('Calendriers et durées de rapport', () => {
  it('refuse les dates normalisées silencieusement et les fuseaux inconnus', () => {
    expect(validDate('2026-02-29')).toBe(false);
    expect(validDate('2024-02-29')).toBe(true);
    expect(validDate('2026-04-31')).toBe(false);
    expect(validDate('26-11-05')).toBe(false);
    expect(validTimezone('Europe/Paris')).toBe(true);
    expect(validTimezone('Invalid/Timezone')).toBe(false);
    expect(() => monthBounds('2026-13', 'Europe/Paris')).toThrow();
  });
  it('respecte les changements d’heure dans les mois de mars et octobre', () => {
    const march = monthBounds('2026-03', 'Europe/Paris');
    expect(march.to - march.from).toBe((31 * 24 - 1) * 3600);
    const october = monthBounds('2026-10', 'Europe/Paris');
    expect(october.to - october.from).toBe((31 * 24 + 1) * 3600);
    expect(dateInZone(instantSeconds('2026-10-31T23:30:00Z'), 'Europe/Paris')).toBe('2026-11-01');
  });
  it('répartit un intervalle à la frontière locale du mois, sans compter les pauses', () => {
    const entry = {
      kind: 'timer',
      workDate: null,
      seconds: 7200,
      segments: [
        {
          startedAt: instantSeconds('2026-10-31T22:30:00Z'),
          endedAt: instantSeconds('2026-10-31T23:30:00Z'),
        },
        {
          startedAt: instantSeconds('2026-11-01T00:00:00Z'),
          endedAt: instantSeconds('2026-11-01T01:00:00Z'),
        },
        { startedAt: instantSeconds('2026-11-01T02:00:00Z'), endedAt: null },
      ],
    };
    expect(secondsInMonth(entry, '2026-10', 'Europe/Paris')).toBe(1800);
    expect(secondsInMonth(entry, '2026-11', 'Europe/Paris')).toBe(5400);
    expect(
      secondsInMonth(
        { kind: 'duration', workDate: '2026-11-05', seconds: 900, segments: [] },
        '2026-11',
        'Europe/Paris',
      ),
    ).toBe(900);
    expect(
      secondsInMonth(
        { kind: 'duration', workDate: null, seconds: 900, segments: [] },
        '2026-11',
        'Europe/Paris',
      ),
    ).toBe(0);
  });
  it('exige un fuseau et des secondes entières', () => {
    expect(() => instantSeconds('2026-11-05T10:00:00')).toThrow();
    expect(() => instantSeconds('2026-11-05T10:00:00.500Z')).toThrow();
    expect(instantSeconds('2026-10-25T02:30:00+02:00') + 3600).toBe(
      instantSeconds('2026-10-25T02:30:00+01:00'),
    );
  });
  it('délimite la semaine dans le fuseau de l’espace, y compris lors du passage à l’heure d’hiver', () => {
    const monday = mondayOf('2026-10-25');
    expect(monday).toBe('2026-10-19');
    const week = weekRange(monday, 'Europe/Paris');
    expect(week.end).toBe('2026-10-26');
    expect(week.to - week.from).toBe(169 * 3600);
    expect(daysBetween(week.end, monday)).toBe(-7);
    expect(() => weekRange('2026-10-20', 'Europe/Paris')).toThrow();
  });
  it('répartit exactement une estimation entre semaines sur les jours ouvrés', () => {
    expect(scheduledSpan({ startOn: null, dueOn: null })).toBeNull();
    const span = scheduledSpan({ startOn: '2026-11-06', dueOn: '2026-11-10' })!;
    expect(span.end).toBe('2026-11-11');
    expect(plannedSeconds(span, 1001, '2026-10-26', '2026-11-02')).toBe(0);
    expect(plannedSeconds(span, 1001, '2026-11-02', '2026-11-09')).toBe(333);
    expect(plannedSeconds(span, 1001, '2026-11-09', '2026-11-16')).toBe(668);
    expect(plannedSeconds(span, 1001, '2026-11-11', '2026-11-16')).toBe(0);
    const weekend = scheduledSpan({ startOn: null, dueOn: '2026-11-07' })!;
    expect(plannedSeconds(weekend, 60, '2026-11-02', '2026-11-09')).toBe(60);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('aligne la navigation sur le calendrier et préserve les dates des périodes personnalisées', () => {
    const quarterView = presetSchedule('2026-11-11', '3y');
    expect(quarterView).toEqual({ start: '2026-01-01', end: '2029-01-01' });
    expect(schedulePeriods(quarterView, '3y')).toHaveLength(12);
    expect(presetSchedule(quarterView.start, '3y', 1)).toEqual({
      start: '2029-01-01',
      end: '2032-01-01',
    });
    const annual = schedulePeriods(presetSchedule('2026-11-11', '5y'), '5y');
    expect(annual.map(({ days }) => days)).toEqual([365, 365, 366, 365, 365]);
    expect(presetSchedule('2028-02-29', '3m', -1)).toEqual({
      start: '2027-11-01',
      end: '2028-02-01',
    });
    expect(
      schedulePeriods(presetSchedule('2026-11-11', '6w'), '6w').map(({ workdays }) => workdays),
    ).toEqual([5, 5, 5, 5, 5, 5]);
    const custom = { start: '2028-01-20', end: '2028-04-02' };
    const months = schedulePeriods(custom, 'custom');
    expect(months.map(({ start, end, days }) => ({ start, end, days }))).toEqual([
      { start: '2028-01-20', end: '2028-02-01', days: 12 },
      { start: '2028-02-01', end: '2028-03-01', days: 29 },
      { start: '2028-03-01', end: '2028-04-01', days: 31 },
      { start: '2028-04-01', end: '2028-04-02', days: 1 },
    ]);
    expect(
      months.reduce((total, p) => total + plannedSeconds(custom, 36_001, p.start, p.end), 0),
    ).toBe(36_001);
    expect(
      schedulePeriods({ start: '2020-04-03', end: '2071-08-06' }, 'custom').length,
    ).toBeLessThanOrEqual(13);
  });
});
