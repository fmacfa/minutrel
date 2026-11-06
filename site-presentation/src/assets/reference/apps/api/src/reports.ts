// SPDX-License-Identifier: AGPL-3.0-or-later
import PDFDocument from 'pdfkit';
import { zipSync, strToU8 } from 'fflate';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MonthlyReport } from '@minutrel/contracts';
import { formatDuration } from '@minutrel/domain';
import { Store, ensure, id } from './store.ts';
import { authenticate, requireRole } from './auth.ts';
import { monthlyReport } from './service.ts';
import { parse, routeId } from './routes.ts';
import { SerialQueue } from './integrations/ai.ts';
import { reportText } from './report-language.ts';

export function csvCell(value: string | number): string {
  let text = String(value);
  // eslint-disable-next-line no-control-regex -- Les contrôles ASCII peuvent précéder une formule de tableur.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
const csvRow = (cells: (string | number)[]) => cells.map(csvCell).join(';');
export function reportCsv(report: MonthlyReport): string {
  const rows = [
    csvRow(
      [
        'Mois',
        'Fuseau',
        'Salarié',
        'Adresse',
        'Projet',
        'Tâche',
        'Date ou début',
        'Description',
        'Secondes',
        'Durée',
        'Version',
        'Compte rendu validé',
        'Notes partagées',
      ].map((label) => reportText(report, label)),
    ),
  ];
  for (const e of report.entries)
    rows.push(
      csvRow([
        report.month,
        report.timezone,
        e.memberName,
        report.members.find((m) => m.id === e.memberId)!.email,
        e.projectName,
        e.taskName ?? '',
        e.workDate ?? new Date(e.segments[0]!.startedAt * 1000).toISOString(),
        e.description,
        e.reportSeconds,
        formatDuration(e.reportSeconds),
        e.version,
        report.summaries
          .filter((s) => s.memberId === e.memberId)
          .map((s) => s.text)
          .join('\n'),
        report.notes
          .filter((n) => n.memberId === e.memberId && n.projectId === e.projectId)
          .map((n) => `${n.workDate} : ${n.text}`)
          .join('\n'),
      ]),
    );
  rows.push(
    csvRow([
      report.month,
      report.timezone,
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      report.totalSeconds,
      formatDuration(report.totalSeconds),
      '',
      '',
      '',
    ]),
  );
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
export function reportPdf(report: MonthlyReport): Promise<Buffer> {
  const tr = (key: string) => reportText(report, key);
  return new Promise((resolveResult, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `Minutrel — Travail ${report.month}`,
        Author: report.workspaceName,
        CreationDate: new Date(report.generatedAt * 1000),
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolveResult(Buffer.concat(chunks)));
    doc.on('error', reject);
    const assetFont = fileURLToPath(new URL('./assets/Manrope-Regular.ttf', import.meta.url));
    const fontDir = existsSync(assetFont)
      ? fileURLToPath(new URL('./assets/', import.meta.url))
      : fileURLToPath(new URL('../../../brand/fonts', import.meta.url));
    doc.registerFont('Regular', resolve(fontDir, 'Manrope-Regular.ttf'));
    doc.registerFont('Bold', resolve(fontDir, 'Manrope-ExtraBold.ttf'));
    doc.font('Regular');
    const width = doc.page.width - 88;
    const room = (height: number) => {
      if (doc.y + height > doc.page.height - 56) doc.addPage();
    };
    const paragraph = (value: string, size = 10, color = '#142C38') => {
      doc.font('Regular').fontSize(size).fillColor(color);
      doc.text(value, 44, doc.y, { width, lineGap: 3 });
      doc.moveDown(0.7);
    };
    const heading = (value: string) => {
      room(70);
      doc.font('Bold').fontSize(15).fillColor('#087F75').text(value, 44, doc.y, { width });
      doc.moveDown(0.6);
    };
    doc.font('Bold').fontSize(28).fillColor('#087F75').text('minutrel', 44, 40);
    doc.moveDown(0.3);
    paragraph(`${report.workspaceName} · ${tr('Rapport mensuel')}`, 11, '#536570');
    doc.font('Bold').fontSize(24).fillColor('#142C38').text(report.month);
    doc.moveDown(0.6);
    paragraph(
      `${tr('Temps finalisé')} : ${formatDuration(report.totalSeconds)} (${report.totalSeconds} ${tr('secondes')})`,
      14,
    );
    paragraph(
      `${tr('Fuseau')} : ${report.timezone} · ${tr('Instantané')} ${new Date(report.generatedAt * 1000).toISOString()}\n${tr('Les durées sont limitées au mois affiché. Pauses et chronomètres en cours exclus.')} ${report.activeTimers} ${tr('chronomètre(s) actif(s) au moment de l’export.')}`,
      9,
      '#536570',
    );
    heading(tr('Par membre'));
    for (const member of report.members) {
      room(24);
      paragraph(`${member.name} — ${formatDuration(member.seconds)}`, 11);
    }
    heading(tr('Par projet'));
    if (!report.projects.length) paragraph(tr('Aucun temps finalisé pour cette période.'));
    for (const project of report.projects) {
      room(24);
      paragraph(`${project.name} — ${formatDuration(project.seconds)}`, 11);
    }
    heading(tr('Détail des temps'));
    for (const entry of [...report.entries].reverse()) {
      room(90);
      const date =
        entry.workDate ??
        new Intl.DateTimeFormat(
          { fr: 'fr-FR', en: 'en-GB', de: 'de-DE' }[report.language ?? 'fr'],
          {
            timeZone: report.timezone,
            dateStyle: 'short',
            timeStyle: 'short',
          },
        ).format(new Date(entry.segments[0]!.startedAt * 1000));
      doc
        .font('Bold')
        .fontSize(10)
        .fillColor('#142C38')
        .text(
          `${entry.memberName} · ${entry.projectName}${entry.taskName ? ` / ${entry.taskName}` : ''}`,
          44,
          doc.y,
          { width },
        );
      paragraph(
        `${date} · ${formatDuration(entry.reportSeconds)} · version ${entry.version}\n${entry.description || tr('Sans description')}`,
        9,
      );
      doc
        .strokeColor('#D7DEDA')
        .lineWidth(0.5)
        .moveTo(44, doc.y)
        .lineTo(doc.page.width - 44, doc.y)
        .stroke();
      doc.moveDown(0.7);
    }
    heading(tr('Comptes rendus validés'));
    if (!report.summaries.length) paragraph(tr('Aucun compte rendu validé pour ce mois.'));
    for (const summary of report.summaries) {
      room(70);
      paragraph(
        `${report.members.find((m) => m.id === summary.memberId)?.name ?? tr('Membre')} · ${summary.source === 'ai' ? tr('Brouillon IA relu et validé') : tr('Rédaction manuelle validée')}`,
        10,
        '#087F75',
      );
      paragraph(summary.text);
    }
    heading(tr('Notes partagées'));
    if (!report.notes.length) paragraph(tr('Aucune note partagée pour ce mois.'));
    for (const note of report.notes) {
      room(70);
      paragraph(
        `${note.workDate} · ${report.members.find((m) => m.id === note.memberId)?.name ?? 'Membre'} · ${note.projectName ?? 'Projet'}`,
        9,
        '#536570',
      );
      paragraph(note.text);
    }
    paragraph(
      `Minutrel 0.1.0 · ${tr('Données déclarées. Les durées sont calculées par le serveur, indépendamment des textes des comptes rendus.')}`,
      8,
      '#536570',
    );
    const pageRange = doc.bufferedPageRange();
    for (let index = 0; index < pageRange.count; index++) {
      doc.switchToPage(index);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Regular')
        .fontSize(8)
        .fillColor('#536570')
        .text(`Minutrel · ${report.month}`, 44, doc.page.height - 30, {
          width: 300,
          lineBreak: false,
        });
      doc.text(`${index + 1} / ${pageRange.count}`, doc.page.width - 100, doc.page.height - 30, {
        width: 56,
        align: 'right',
        lineBreak: false,
      });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
export async function reportZip(report: MonthlyReport): Promise<Buffer> {
  const files: Record<string, Uint8Array> = {
    'temps.csv': strToU8(reportCsv(report)),
    'totaux-projets.csv': strToU8(
      `\uFEFF${[csvRow(['Projet', 'Secondes', 'Durée']), ...report.projects.map((p) => csvRow([p.name, p.seconds, formatDuration(p.seconds)]))].join('\r\n')}`,
    ),
    'rapport-equipe.pdf': await reportPdf(report),
  };
  for (const member of report.members) {
    const own: MonthlyReport = {
      ...report,
      members: [member],
      totalSeconds: member.seconds,
      entries: report.entries.filter((e) => e.memberId === member.id),
      notes: report.notes.filter((n) => n.memberId === member.id),
      summaries: report.summaries.filter((s) => s.memberId === member.id),
      projects: report.projects
        .map((p) => ({
          ...p,
          seconds: report.entries
            .filter((e) => e.projectId === p.id && e.memberId === member.id)
            .reduce((sum, e) => sum + e.reportSeconds, 0),
        }))
        .filter((p) => p.seconds > 0),
    };
    files[`membres/${member.id}.pdf`] = await reportPdf(own);
  }
  return Buffer.from(zipSync(files, { level: 3 }));
}
export function registerExports(app: FastifyInstance, store: Store) {
  const queue = new SerialQueue();
  app.post('/api/v1/exports', async (r) => {
    const member = authenticate(store, r, true);
    requireRole(member, 'admin');
    const data = parse(
      z
        .object({
          month: z.string(),
          memberIds: z.array(z.uuid()).min(1).max(100).optional(),
          format: z.enum(['csv', 'pdf', 'zip']),
          language: z.enum(['fr', 'en', 'de']).default('fr'),
        })
        .strict(),
      r.body,
    );
    const report = store.tx(() => monthlyReport(store, data.month, data.memberIds, 20000));
    report.language = data.language;
    ensure(
      report.members.length <= 100 && report.entryCount <= 20000,
      'Réduisez la sélection : 100 membres ou 20 000 lignes maximum par export.',
    );
    const exportId = id();
    const expiresAt = store.now() + 86400;
    store.run('DELETE FROM exports WHERE expiresAt<=?', store.now());
    store.run(
      'INSERT INTO exports VALUES (?,?,?,?,?)',
      exportId,
      member.id,
      expiresAt,
      data.format,
      JSON.stringify(report),
    );
    store.audit(member.id, 'report.export_create', exportId, {
      month: data.month,
      format: data.format,
      memberIds: report.members.map((m) => m.id),
      totalSeconds: report.totalSeconds,
    });
    return {
      id: exportId,
      expiresAt,
      url: `/api/v1/exports/${exportId}`,
      filename: `minutrel-${data.month}.${data.format}`,
    };
  });
  app.get('/api/v1/exports/:id', async (r, reply) => {
    const member = authenticate(store, r);
    requireRole(member, 'admin');
    const item = store.get<{ format: 'csv' | 'pdf' | 'zip'; snapshot: string; expiresAt: number }>(
      'SELECT * FROM exports WHERE id=? AND memberId=? AND expiresAt>?',
      routeId(r),
      member.id,
      store.now(),
    );
    ensure(item, 'Export expiré ou introuvable.', 404);
    const snapshot = JSON.parse(item.snapshot) as MonthlyReport;
    const content =
      item.format === 'csv'
        ? Buffer.from(reportCsv(snapshot))
        : await queue.run(() =>
            item.format === 'pdf' ? reportPdf(snapshot) : reportZip(snapshot),
          );
    requireRole(authenticate(store, r), 'admin');
    ensure(item.expiresAt > store.now(), 'Cet export a expiré.', 410);
    store.audit(member.id, 'report.download', routeId(r), { format: item.format });
    reply.header(
      'Content-Disposition',
      `attachment; filename="minutrel-${snapshot.month}.${item.format}"`,
    );
    return reply
      .type(
        { csv: 'text/csv; charset=utf-8', pdf: 'application/pdf', zip: 'application/zip' }[
          item.format
        ],
      )
      .send(content);
  });
}
