// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import type { MonthlyReport } from '@minutrel/contracts';
import fontUrl from '../../../brand/fonts/Manrope-Regular.ttf?url';

const files = new Map<string, { bytes: Uint8Array; filename: string }>();
export function takeLocalFile(url: string) {
  const file = files.get(url);
  files.delete(url);
  if (!file) throw new Error(tr('Préparez à nouveau le téléchargement local.'));
  return file;
}
const cell = (value: unknown) => {
  let text = String(value ?? '');
  // eslint-disable-next-line no-control-regex -- Un contrôle peut précéder une formule de tableur.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const duration = (n: number) =>
  `${Math.floor(n / 3600)
    .toString()
    .padStart(2, '0')}:${Math.floor((n % 3600) / 60)
    .toString()
    .padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
export function localCsv(r: MonthlyReport) {
  return (
    '\uFEFF' +
    [
      [
        'entry_id',
        'member',
        'project',
        'description',
        'date',
        'duration_seconds',
        'duration',
        'timezone',
        'approved_summaries',
        'shared_notes',
        'subcategory',
      ]
        .map(cell)
        .join(';'),
      ...r.entries.map((e) =>
        [
          e.id,
          e.memberName,
          e.projectName,
          e.description,
          e.workDate ?? new Date(e.createdAt * 1000).toISOString(),
          e.reportSeconds,
          duration(e.reportSeconds),
          r.timezone,
          r.summaries
            .filter((s) => s.status === 'approved' && s.memberId === e.memberId)
            .map((s) => s.text)
            .join('\n'),
          r.notes
            .filter((n) => n.shared && n.memberId === e.memberId && n.projectId === e.projectId)
            .map((n) => n.text)
            .join('\n'),
          e.taskName ?? '',
        ]
          .map(cell)
          .join(';'),
      ),
    ].join('\r\n')
  );
}
export async function localPdf(r: MonthlyReport) {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit.default);
  const font = await pdf.embedFont(await fetch(fontUrl).then((r) => r.arrayBuffer()), {
    subset: true,
  });
  const pages = [];
  let page = pdf.addPage();
  pages.push(page);
  let y = 780;
  const line = (text: string, size = 10) => {
    if (y < 60) {
      page = pdf.addPage();
      pages.push(page);
      y = 780;
    }
    page.drawText(text, { x: 45, y, size, font, color: rgb(0.08, 0.18, 0.17) });
    y -= size + 8;
  };
  const paragraph = (text: string, size = 10) => {
    const measured = new Map<string, number>();
    const measure = (value: string) => {
      const cached = measured.get(value);
      if (cached !== undefined) return cached;
      const width = font.widthOfTextAtSize(value, size);
      measured.set(value, width);
      return width;
    };
    for (const raw of text.replaceAll('\r', '').split('\n')) {
      let buffer = '',
        width = 0;
      for (const word of raw.split(/(\s+)/)) {
        const wordWidth = measure(word);
        if (wordWidth > 500) {
          for (const char of word) {
            const charWidth = measure(char);
            if (width + charWidth > 500) {
              line(buffer, size);
              buffer = '';
              width = 0;
            }
            buffer += char;
            width += charWidth;
          }
          continue;
        }
        if (width + wordWidth > 500) {
          line(buffer.trimEnd(), size);
          buffer = '';
          width = 0;
        }
        if (!buffer && /^\s+$/.test(word)) continue;
        buffer += word;
        width += wordWidth;
      }
      line(buffer, size);
    }
  };
  line('minutrel.', 24);
  line(`${r.workspaceName} — ${r.month}`, 16);
  line(`${r.timezone} · ${r.entryCount} · ${duration(r.totalSeconds)}`, 11);
  y -= 16;
  for (const p of r.projects) paragraph(`${p.name} : ${duration(p.seconds)}`);
  y -= 15;
  for (const e of r.entries) {
    paragraph(
      `${e.projectName}${e.taskName ? ` / ${e.taskName}` : ''} · ${duration(e.reportSeconds)}`,
      11,
    );
    paragraph(`${e.workDate ?? new Date(e.createdAt * 1000).toISOString()} · ${e.memberName}`, 9);
    paragraph(e.description || '—');
    y -= 8;
  }
  for (const s of r.summaries) {
    y -= 12;
    paragraph(s.text);
  }
  for (const n of r.notes) {
    y -= 8;
    paragraph(`${n.workDate} · ${n.projectName}`);
    paragraph(n.text);
  }
  pages.forEach((p, i) =>
    p.drawText(tr('Minutrel · {0}/{1}', i + 1, pages.length), {
      x: 45,
      y: 30,
      font,
      size: 8,
      color: rgb(0.4, 0.45, 0.42),
    }),
  );
  return pdf.save();
}
export async function localExport(r: MonthlyReport, format: string) {
  let bytes: Uint8Array;
  if (format === 'csv') bytes = new TextEncoder().encode(localCsv(r));
  else if (format === 'pdf') bytes = await localPdf(r);
  else if (format === 'zip') {
    const { zipSync, strToU8 } = await import('fflate');
    bytes = zipSync({
      'temps.csv': strToU8(localCsv(r)),
      'rapport.pdf': await localPdf(r),
      'rapport.json': strToU8(JSON.stringify(r, null, 2)),
    });
  } else throw new Error(tr('Format d’export inconnu.'));
  const url = `local:${crypto.randomUUID()}`,
    filename = `minutrel-${r.month}.${format}`;
  files.clear();
  files.set(url, { bytes, filename });
  return { url, filename };
}
