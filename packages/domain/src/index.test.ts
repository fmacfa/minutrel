import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration, sumDurations } from './index';

describe('saisie manuelle', () => {
  it.each(['1h30', '01:30', '90 min', '1,5 h', '1.5 h', ' 1H30 '])(
    '%s vaut 90 minutes',
    (input) => {
      expect(parseDuration(input)).toBe(5400);
    },
  );

  it.each(['1,30', '01:75', '1h75', '0 min', '-5 min', '', '1', '1,001 h', '1e6 min'])(
    'refuse %s',
    (input) => {
      expect(() => parseDuration(input)).toThrow(RangeError);
    },
  );

  it('accepte une heure seule et un total au-delà de 24 heures', () => {
    expect(parseDuration('1 h')).toBe(3600);
    expect(parseDuration('27:15')).toBe(98100);
  });

  it('refuse un débordement numérique', () => {
    expect(() => parseDuration('999999999999999999999 h')).toThrow(RangeError);
  });

  it.each([
    ['4,1 h', 14760],
    ['0,1 h', 360],
    ['0,25 h', 900],
  ] as const)('convertit exactement %s, sans arrondi flottant', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});

describe('totaux sans perte de secondes', () => {
  it('additionne les secondes avant de formater', () => {
    expect(formatDuration(sumDurations([20, 50]))).toBe('0 h 01 min 10 s');
    expect(formatDuration(sumDurations([4800, 2700]))).toBe('2 h 05 min');
  });

  it('conserve les heures au-delà de 24 et accepte un total vide', () => {
    expect(formatDuration(98100)).toBe('27 h 15 min');
    expect(sumDurations([])).toBe(0);
    expect(formatDuration(0)).toBe('0 h 00 min');
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuse une durée invalide %s',
    (value) => {
      expect(() => sumDurations([value])).toThrow(RangeError);
      expect(() => formatDuration(value)).toThrow(RangeError);
    },
  );

  it('refuse un total dépassant la précision entière', () => {
    expect(() => sumDurations([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
});
