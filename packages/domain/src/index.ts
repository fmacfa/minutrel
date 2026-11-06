// SPDX-License-Identifier: AGPL-3.0-or-later

/** Parse une durée manuelle explicite et retourne des secondes entières. */
export function parseDuration(input: string): number {
  const value = input.trim().toLowerCase();
  let minutes: bigint;
  let match: RegExpMatchArray | null;

  if ((match = value.match(/^(\d+)\s*h(?:\s*([0-5]?\d)(?:\s*min)?)?$/))) {
    minutes = BigInt(match[1]!) * 60n + BigInt(match[2] ?? '0');
  } else if ((match = value.match(/^(\d+):([0-5]\d)$/))) {
    minutes = BigInt(match[1]!) * 60n + BigInt(match[2]!);
  } else if ((match = value.match(/^(\d+)\s*min$/))) {
    minutes = BigInt(match[1]!);
  } else if ((match = value.match(/^(\d+)[,.](\d+)\s*h$/))) {
    const denominator = 10n ** BigInt(match[2]!.length);
    const numerator = (BigInt(match[1]!) * denominator + BigInt(match[2]!)) * 60n;
    if (numerator % denominator !== 0n) {
      throw new RangeError('La durée doit être exprimable en minutes entières.');
    }
    minutes = numerator / denominator;
  } else {
    throw new RangeError('Précisez une durée comme 1h30, 01:30, 90 min ou 1,5 h.');
  }

  const seconds = minutes * 60n;
  if (seconds <= 0n || seconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('La durée doit être positive, sûre et exprimable en minutes entières.');
  }
  return Number(seconds);
}

export function formatDuration(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new RangeError('Une durée est un nombre entier positif ou nul de secondes.');
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')} min${remainder ? ` ${remainder} s` : ''}`;
}

export function sumDurations(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(total + value)) {
      throw new RangeError('Les durées doivent rester des entiers sûrs et positifs ou nuls.');
    }
    total += value;
  }
  return total;
}
