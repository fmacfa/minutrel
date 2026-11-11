// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, type FormEvent } from 'react';
import type { Session, Timesheet, TimesheetDetail, TimesheetStatus } from '@minutrel/contracts';
import { addDays, dateInZone, mondayOf, validDate } from '@minutrel/domain/reports';
import { Badge, clockText, Field, formData, val, type Actions } from './components.tsx';
import { t as tr } from './i18n.ts';
import { syncStatus } from './local.ts';
import { calendarLabel, PageControls } from './Schedule.tsx';
import { TimeTable } from './Times.tsx';
import { request } from './transport.ts';
import { useResource } from './useResource.ts';

const statusName = (status: TimesheetStatus) =>
  ({
    draft: tr('Brouillon'),
    submitted: tr('Soumise'),
    approved: tr('Approuvée'),
    returned: tr('À corriger'),
  })[status];
const statusTone = (status: TimesheetStatus) =>
  ({ draft: '', submitted: 'yellow', approved: 'green', returned: 'yellow' })[status];

function changeSheet(
  sheet: Timesheet,
  status: 'submitted' | 'approved' | 'returned',
  reason?: string,
) {
  return request(`/timesheets/${sheet.memberId}`, 'PATCH', {
    weekStart: sheet.weekStart,
    version: sheet.version,
    status,
    ...(reason ? { reason } : {}),
  });
}

function ReturnSheet({ sheet, actions }: { sheet: Timesheet; actions: Actions }) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    const reason = val(formData(event), 'reason').trim();
    if (
      await actions.act(
        () => changeSheet(sheet, 'returned', reason),
        tr('Feuille renvoyée pour correction.'),
      )
    )
      actions.close();
  };
  return (
    <form className="stack-form" onSubmit={(e) => void submit(e)}>
      <Field label={tr('Correction attendue')}>
        <textarea name="reason" required maxLength={2000} rows={4} autoFocus />
      </Field>
      <div className="form-footer">
        <button type="button" className="button secondary" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit">
          {tr('Renvoyer pour correction')}
        </button>
      </div>
    </form>
  );
}

export function Timesheets({
  session,
  actions,
  revision,
  goBack,
}: {
  session: Session;
  actions: Actions;
  revision: number;
  goBack: () => void;
}) {
  const current = mondayOf(dateInZone(session.serverNow, session.workspace.timezone));
  const [weekStart, setWeekStart] = useState(current);
  const [memberId, setMemberId] = useState(session.member.id);
  const [offset, setOffset] = useState(0);
  const list = useResource<Timesheet[]>(`/timesheets?weekStart=${weekStart}`, revision);
  const selected = list?.data?.find((sheet) => sheet.memberId === memberId);
  const detail = useResource<TimesheetDetail>(
    selected ? `/timesheets/${selected.memberId}?weekStart=${weekStart}&offset=${offset}` : null,
    revision,
  );
  const sheet = detail?.data?.sheet ?? selected;
  const own = sheet?.memberId === session.member.id;
  const canReview = session.member.role !== 'contributor';
  const pendingSync = syncStatus().pending > 0;
  const changeWeek = (day: string) => {
    setWeekStart(mondayOf(day));
    setOffset(0);
  };
  return (
    <div className="planning-page">
      <button className="text-button back-button" onClick={goBack}>
        <span aria-hidden="true">‹</span> {tr('Les temps')}
      </button>
      <div className="page-heading">
        <div>
          <h1>{tr('Feuilles de temps')}</h1>
          <p className="quiet">{tr('Soumettez vos heures de la semaine pour validation.')}</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="schedule-window">
          <button
            className="button secondary"
            aria-label={tr('Semaine précédente')}
            onClick={() => changeWeek(addDays(weekStart, -7))}
          >
            ‹
          </button>
          <label className="inline-field">
            {tr('Semaine du')}
            <input
              type="date"
              value={weekStart}
              max={addDays(current, 6)}
              onChange={(e) => {
                if (e.target.validity.valid && validDate(e.target.value))
                  changeWeek(e.target.value);
              }}
            />
          </label>
          <button
            className="button secondary"
            aria-label={tr('Semaine suivante')}
            disabled={weekStart >= current}
            onClick={() => changeWeek(addDays(weekStart, 7))}
          >
            ›
          </button>
        </div>
        <span className="quiet">
          {calendarLabel(weekStart, true)} – {calendarLabel(addDays(weekStart, 6), true)} ·{' '}
          {session.workspace.timezone}
        </span>
      </div>
      {!list && <p className="loading">{tr('Chargement…')}</p>}
      {list?.error && (
        <p className="notice error" role="alert">
          {list.error}
        </p>
      )}
      {list?.data && canReview && (
        <section className="panel table-scroll" aria-label={tr('Feuilles de l’équipe')}>
          <table className="time-table sheets-table">
            <thead>
              <tr>
                <th scope="col">{tr('Membre')}</th>
                <th scope="col">{tr('Statut')}</th>
                <th scope="col" className="numeric">
                  {tr('Durée')}
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr
                  key={item.memberId}
                  className={item.memberId === memberId ? 'selected-sheet' : undefined}
                >
                  <th scope="row">
                    <button
                      className="text-button"
                      aria-pressed={item.memberId === memberId}
                      onClick={() => {
                        setMemberId(item.memberId);
                        setOffset(0);
                      }}
                    >
                      {item.memberName}
                      {item.memberId === session.member.id ? ` · ${tr('Moi')}` : ''}
                    </button>
                  </th>
                  <td>
                    <Badge tone={statusTone(item.status)}>{statusName(item.status)}</Badge>
                  </td>
                  <td className="numeric duration">{clockText(item.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {list?.data && !sheet && (
        <p className="notice">{tr('Aucune feuille pour ce membre cette semaine.')}</p>
      )}
      {sheet && (
        <section className="panel">
          <div className="padded-heading sheet-heading">
            <div>
              <div className="section-heading">
                <h2>{sheet.memberName}</h2>
                <Badge tone={statusTone(sheet.status)}>{statusName(sheet.status)}</Badge>
              </div>
              <p className="duration">{clockText(sheet.seconds)}</p>
            </div>
            <div className="button-group">
              {own && (sheet.status === 'draft' || sheet.status === 'returned') && (
                <button
                  className="button primary"
                  disabled={actions.pending || sheet.hasActiveTime || pendingSync || !detail?.data}
                  onClick={() =>
                    void actions.act(() => changeSheet(sheet, 'submitted'), tr('Feuille soumise.'))
                  }
                >
                  {tr('Soumettre la feuille')}
                </button>
              )}
              {canReview && (sheet.status === 'submitted' || sheet.status === 'approved') && (
                <button
                  className="button secondary"
                  disabled={actions.pending || !detail?.data}
                  onClick={() =>
                    actions.open(
                      tr('Renvoyer pour correction'),
                      <ReturnSheet sheet={sheet} actions={actions} />,
                    )
                  }
                >
                  {tr('Renvoyer pour correction')}
                </button>
              )}
              {canReview && sheet.status === 'submitted' && (
                <button
                  className="button primary"
                  disabled={actions.pending || !detail?.data}
                  onClick={() =>
                    void actions.act(() => changeSheet(sheet, 'approved'), tr('Feuille approuvée.'))
                  }
                >
                  {tr('Approuver la feuille')}
                </button>
              )}
            </div>
          </div>
          {own && (sheet.status === 'draft' || sheet.status === 'returned') && (
            <p className="sheet-note quiet">
              {tr('La soumission verrouille les temps de la semaine jusqu’à sa réouverture.')}
            </p>
          )}
          {own && pendingSync && (
            <p className="sheet-note quiet">
              {tr('Synchronisez vos temps avant de soumettre la feuille.')}
            </p>
          )}
          {sheet.hasActiveTime && (
            <p className="sheet-note quiet">
              {tr('Terminez le chronomètre de cette semaine avant de la soumettre.')}
            </p>
          )}
          {sheet.reviewerName && (
            <p className="sheet-note quiet">{tr('Feuille examinée par {0}', sheet.reviewerName)}</p>
          )}
          {sheet.reason && <p className="sheet-note notice prose">{sheet.reason}</p>}
          {!detail && <p className="loading">{tr('Chargement des temps…')}</p>}
          {detail?.error && (
            <p className="sheet-note notice error" role="alert">
              {detail.error}
            </p>
          )}
          {detail?.data && (
            <>
              {detail.data.entries.length ? (
                <TimeTable entries={detail.data.entries} timezone={session.workspace.timezone} />
              ) : (
                <p className="loading">{tr('Aucun temps finalisé pour cette période.')}</p>
              )}
              <PageControls offset={offset} count={detail.data.entryCount} onChange={setOffset} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
