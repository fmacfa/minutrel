// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { acknowledge, currentTimer, localReport, localSpace, timerMutation } from './local-core.ts';
const ready = () => {
  const d = localSpace('Alex', 1800000000);
  d.projects.push({
    id: crypto.randomUUID(),
    name: 'Local',
    description: '',
    color: '#087f75',
    archived: false,
    version: 1,
    memberIds: [d.session.member.id],
    tasks: [],
  });
  return d;
};
it('persiste un chronomètre autonome, exclut les pauses et ne crée aucune file réseau', () => {
  const d = ready();
  const start = timerMutation(d, 'start', { projectId: d.projects[0]!.id }, 1800000000, false);
  timerMutation(d, 'pause', { version: start.version }, 1800000060, false);
  const restored = JSON.parse(JSON.stringify(d));
  timerMutation(restored, 'resume', { version: 2 }, 1800000180, false);
  const stop = timerMutation(restored, 'stop', { version: 3 }, 1800000240, false);
  expect(stop.seconds).toBe(120);
  expect(currentTimer(restored)).toBe(null);
  expect(restored.pending).toHaveLength(0);
  expect(localReport(restored, '2027-01', 1800000300).totalSeconds).toBe(120);
});
it('garde la version serveur initiale et protège une modification pendant un envoi', () => {
  const d = ready();
  const t = timerMutation(d, 'start', { projectId: d.projects[0]!.id }, 1800000000, true);
  const first = structuredClone(d.pending[0]!);
  timerMutation(d, 'pause', { version: t.version }, 1800000060, true);
  expect(d.pending[0]!.baseVersion).toBeNull();
  acknowledge(d, first, { ...first.entry, version: 7 });
  expect(d.pending).toHaveLength(1);
  expect(d.pending[0]!.baseVersion).toBe(7);
  expect(currentTimer(d)!.state).toBe('paused');
  const latest = structuredClone(d.pending[0]!);
  acknowledge(d, latest, { ...latest.entry, version: 8 });
  expect(d.pending).toHaveLength(0);
  expect(currentTimer(d)!.version).toBe(8);
  acknowledge(d, first, { ...first.entry, version: 7 });
  expect(currentTimer(d)!.version).toBe(8);
  expect(currentTimer(d)!.state).toBe('paused');
});
it('refuse une horloge qui recule, un second chronomètre et une version périmée', () => {
  const d = ready();
  timerMutation(d, 'start', { projectId: d.projects[0]!.id }, 1800000000, true);
  expect(() =>
    timerMutation(d, 'start', { projectId: d.projects[0]!.id }, 1800000001, true),
  ).toThrow();
  expect(() => timerMutation(d, 'pause', { version: 99 }, 1800000001, true)).toThrow();
  expect(() => timerMutation(d, 'pause', { version: 1 }, 1799999999, true)).toThrow();
});
