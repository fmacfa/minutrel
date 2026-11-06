# Monthly work reports

In **Reports**, an administrator chooses the month and members, or the whole team. Disabled members remain selectable for their history. Other roles use their personal report. In standalone mode, reports cover local personal work.

## Figures

Reports sum the exact seconds of completed entries, excluding breaks and removed entries. Active timers are shown separately. Intervals are clipped to the month’s boundaries in the workspace time zone, including daylight-saving changes. Manual durations belong to their declared work date.

Reports include the total, project/member aggregates, entry count and a preview of 100 entries. Totals cover the full period, not only the preview. Collective exports accept up to 100 members and 20,000 entries; reduce larger selections.

## Work descriptions

Descriptions accompany entries. Notes appear only after their author shares them, and monthly summaries only after approval. Private notes and unapproved AI drafts are excluded from collective reports.

AI can optionally draft text from the member’s consented descriptions and notes. It cannot write to time entries, and figures never come from the AI response. Manual summaries remain available.

## Downloads

- **CSV:** UTF-8 with BOM and a semicolon separator, exact seconds, readable durations, versions, descriptions and shared work. Cells that could be interpreted as spreadsheet formulas are neutralised.
- **PDF:** totals, member/project breakdown, details, approved summaries, shared notes and pagination.
- **Team ZIP:** entry CSV, project totals, collective PDF and individual member PDFs identified by stable member UUIDs.
- **Personal local ZIP:** personal CSV, PDF and report JSON.

A server export first creates a private snapshot. Later corrections do not change its contents. Download access lasts 24 hours and belongs to its creator, whose administrator permission is checked again at download time. Expired snapshots are purged when another export is created.

The audit trail records export creation/download, period, format, selected members and total without copying note text. PDF generation is serialised to limit memory peaks. For a final collective report, wait for all members to synchronise and finish their timers.

A [sample report PDF](../output/pdf/minutrel-rapport-demo-2026-11.pdf) uses fictional data and French labels. Tests compare CSV/PDF/ZIP from one snapshot and check that private drafts are excluded.
