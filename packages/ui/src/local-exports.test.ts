// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
import { localCsv, localExport, localPdf, takeLocalFile } from './local-exports.ts';
import { localReport, localSpace, timerMutation } from './local-core.ts';
const report = () => {
  const now = Math.floor(Date.parse('2026-11-06T12:00:00Z') / 1000),
    d = localSpace('Élodie Müller', now);
  d.projects = [
    {
      id: crypto.randomUUID(),
      name: 'Projet',
      description: '',
      color: '#087f75',
      archived: false,
      version: 1,
      memberIds: [d.session.member.id],
      tasks: [],
    },
  ];
  const start = timerMutation(
    d,
    'start',
    { projectId: d.projects[0]!.id, description: 'Maquettes et révision — Grüße' },
    now - 181,
    false,
  );
  timerMutation(d, 'stop', { version: start.version }, now, false);
  return localReport(d, '2026-11', now);
};
const font = () =>
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        new Uint8Array(
          readFileSync(new URL('../../../brand/fonts/Manrope-Regular.ttf', import.meta.url)),
        ),
      ),
  );
afterEach(() => vi.unstubAllGlobals());
it('exporte les secondes exactes et neutralise les préfixes de formules et contrôles', () => {
  const r = report();
  r.entries[0]!.description = '\u0000=1+2';
  const csv = localCsv(r);
  expect(csv).toContain('"181";"00:03:01"');
  expect(csv).toContain('"\'\u0000=1+2"');
  r.entries[0]!.description = '\t@SUM(1)';
  expect(localCsv(r)).toContain('"\'\t@SUM(1)"');
  r.entries[0]!.taskName = 'Accompagnement clientèle';
  expect(localCsv(r).split('\r\n')[0]).toContain('"subcategory"');
  expect(localCsv(r)).toContain('"Accompagnement clientèle"');
});
it('produit un PDF valide avec accents et pagination pour des descriptions longues', async () => {
  font();
  const r = report();
  r.entries[0]!.description = 'Élodie Müller — révision des maquettes. '.repeat(400);
  const bytes = await localPdf(r);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  expect(pdf.getPages().every((p) => p.getSize().width > 500)).toBe(true);
});
it('prépare un dossier ZIP local cohérent et retire le fichier temporaire après prise', async () => {
  font();
  const r = report();
  const prepared = await localExport(r, 'zip'),
    file = takeLocalFile(prepared.url);
  const zip = unzipSync(file.bytes);
  expect(Array.from(zip['temps.csv']!.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  expect(strFromU8(zip['temps.csv']!)).toBe(localCsv(r).replace(/^\uFEFF/, ''));
  expect(JSON.parse(strFromU8(zip['rapport.json']!)).totalSeconds).toBe(181);
  expect((await PDFDocument.load(zip['rapport.pdf']!)).getPageCount()).toBe(1);
  expect(() => takeLocalFile(prepared.url)).toThrow();
});
