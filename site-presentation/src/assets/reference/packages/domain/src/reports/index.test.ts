// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import {
  validDate,
  validTimezone,
  dateInZone,
  monthBounds,
  instantSeconds,
  secondsInMonth,
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
});
