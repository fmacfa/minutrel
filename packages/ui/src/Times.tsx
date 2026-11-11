// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr, locale } from './i18n.ts';
import { useEffect, useState, type FormEvent } from 'react';
import type { Project, Member, ReportEntry, TimeEntry, Session } from '@minutrel/contracts';
import {
  Badge,
  Empty,
  Field,
  Icon,
  clockText,
  formData,
  val,
  type Actions,
} from './components.tsx';
import { request } from './transport.ts';
import { ActionPicker } from './ActionPicker.tsx';

export function dateString(seconds: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(seconds * 1000));
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}`;
}
export function ManualForm({
  projects,
  session,
  actions,
  entry,
}: {
  projects: Project[];
  session: Session;
  actions: Actions;
  entry?: TimeEntry;
}) {
  const [projectId, setProjectId] = useState(
    entry?.projectId ?? projects.find((p) => !p.archived)?.id ?? '',
  );
  const [kind, setKind] = useState<'description' | 'duration' | 'interval'>(
    entry ? 'description' : 'duration',
  );
  const project = projects.find((p) => p.id === projectId);
  const [taskId, setTaskId] = useState(entry?.taskId ?? '');
  const [actionId, setActionId] = useState(entry?.actionId ?? '');
  const [submissionKey] = useState(() => crypto.randomUUID());
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    const f = formData(e);
    const common = {
      description: val(f, 'description'),
      ...(entry ? { version: entry.version, reason: val(f, 'reason') } : {}),
    };
    const input =
      kind === 'description'
        ? common
        : {
            ...common,
            projectId,
            taskId: taskId || null,
            ...(actionId || entry?.actionId ? { actionId: actionId || null } : {}),
            kind,
            ...(kind === 'duration'
              ? { duration: val(f, 'duration'), workDate: val(f, 'workDate') }
              : {
                  startedAt: `${val(f, 'startedAt')}:00${val(f, 'offset')}`,
                  endedAt: `${val(f, 'endedAt')}:00${val(f, 'offset')}`,
                  allowOverlap: f.has('allowOverlap'),
                }),
          };
    const ok = await actions.act(
      () =>
        request(
          entry
            ? `/time-entries/${entry.id}${kind === 'description' ? '/description' : ''}`
            : '/time-entries',
          entry ? 'PATCH' : 'POST',
          input,
          submissionKey,
        ),
      entry ? tr('Correction enregistrée.') : tr('Temps ajouté.'),
    );
    if (ok) actions.close();
  };
  return (
    <form className="stack-form" onSubmit={(e) => void submit(e)}>
      <div className="segmented">
        {entry && (
          <button
            type="button"
            className={kind === 'description' ? 'selected' : ''}
            onClick={() => setKind('description')}
          >
            {tr('Description')}
          </button>
        )}
        <button
          type="button"
          className={kind === 'duration' ? 'selected' : ''}
          onClick={() => setKind('duration')}
        >
          {tr('Durée')}
        </button>
        <button
          type="button"
          className={kind === 'interval' ? 'selected' : ''}
          onClick={() => setKind('interval')}
        >
          {tr('Début et fin')}
        </button>
      </div>
      {entry && kind !== 'description' && (
        <p className="notice">
          {tr(
            'La correction remplacera les segments d’origine par cette saisie. L’ancienne valeur restera dans le journal des corrections.',
          )}
        </p>
      )}
      {kind !== 'description' && (
        <>
          <Field label={tr('Projet')}>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setTaskId('');
                setActionId('');
              }}
              required
            >
              <option value="" disabled>
                {tr('Choisir un projet')}
              </option>
              {projects
                .filter((p) => !p.archived || p.id === entry?.projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          {!!project?.tasks.length && (
            <Field label={tr('Sous-catégorie facultative')}>
              <select
                value={taskId}
                onChange={(e) => {
                  setTaskId(e.target.value);
                  setActionId('');
                }}
              >
                <option value="">{tr('Sans sous-catégorie')}</option>
                {project.tasks
                  .filter((t) => !t.archived || t.id === entry?.taskId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <ActionPicker
            projectId={projectId}
            taskId={taskId}
            value={actionId}
            onChange={setActionId}
            existingTitle={entry?.actionName}
          />
          {kind === 'duration' ? (
            <div className="form-grid">
              <Field label={tr('Date de travail')} hint={session.workspace.timezone}>
                <input
                  name="workDate"
                  type="date"
                  defaultValue={
                    entry?.workDate ??
                    dateString(entry?.createdAt ?? session.serverNow, session.workspace.timezone)
                  }
                  required
                />
              </Field>
              <Field label={tr('Durée')} hint={tr('Exemples : 1h30, 90 min, 1,5 h')}>
                <input
                  name="duration"
                  defaultValue={entry ? tr('{0} min', entry.seconds / 60) : ''}
                  placeholder="1h30"
                  required
                  maxLength={60}
                />
              </Field>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <Field label={tr('Début')}>
                  <input
                    name="startedAt"
                    type="datetime-local"
                    defaultValue={
                      entry?.segments[0]
                        ? new Date(entry.segments[0].startedAt * 1000).toISOString().slice(0, 16)
                        : undefined
                    }
                    required
                  />
                </Field>
                <Field label={tr('Fin')}>
                  <input
                    name="endedAt"
                    type="datetime-local"
                    defaultValue={
                      entry?.segments.at(-1)?.endedAt
                        ? new Date(entry.segments.at(-1)!.endedAt! * 1000)
                            .toISOString()
                            .slice(0, 16)
                        : undefined
                    }
                    required
                  />
                </Field>
              </div>
              <Field
                label={tr('Décalage UTC de ces horaires')}
                hint={tr(
                  'Exemples : +01:00 (Paris en hiver), +02:00 (Paris en été). Les rapports utilisent le fuseau de l’équipe.',
                )}
              >
                <input
                  name="offset"
                  defaultValue="+00:00"
                  pattern="[+-][0-9]{2}:[0-9]{2}"
                  required
                />
              </Field>
              <label className="check-row">
                <input name="allowOverlap" type="checkbox" />
                {tr('Je confirme un éventuel chevauchement avec un autre temps.')}
              </label>
            </>
          )}
        </>
      )}
      <Field label={tr('Description du travail')}>
        <textarea
          name="description"
          defaultValue={entry?.description}
          rows={3}
          maxLength={2000}
          placeholder={tr('Ce que vous avez fait, en quelques mots…')}
        />
      </Field>
      {entry && (
        <Field label={tr('Motif de la correction')}>
          <input
            name="reason"
            required
            minLength={5}
            maxLength={2000}
            placeholder={tr('Pourquoi ce temps doit-il être corrigé ?')}
          />
        </Field>
      )}
      <div className="form-footer">
        <button className="button secondary" type="button" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit">
          {entry ? tr('Enregistrer la correction') : tr('Ajouter ce temps')}
        </button>
      </div>
    </form>
  );
}
function DeleteForm({ entry, actions }: { entry: TimeEntry; actions: Actions }) {
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        const f = formData(e);
        if (
          await actions.act(
            () =>
              request(`/time-entries/${entry.id}`, 'DELETE', {
                version: entry.version,
                reason: val(f, 'reason'),
              }),
            tr('Temps supprimé des rapports.'),
          )
        )
          actions.close();
      }}
    >
      <p>
        {tr('Retirer les ')}
        <strong>{clockText(entry.seconds)}</strong> {tr('de « ')}
        {entry.projectName}{' '}
        {tr('» des rapports ? L’opération sera consignée dans le journal des corrections.')}
      </p>
      <Field label={tr('Motif')}>
        <input name="reason" minLength={5} maxLength={2000} required autoFocus />
      </Field>
      <div className="form-footer">
        <button type="button" className="button secondary" onClick={actions.close}>
          {tr('Conserver')}
        </button>
        <button className="button danger" type="submit">
          {tr('Supprimer ce temps')}
        </button>
      </div>
    </form>
  );
}
export function TimeTable({
  entries,
  timezone,
  edit,
  remove,
  withMember = false,
}: {
  entries: (TimeEntry | ReportEntry)[];
  timezone: string;
  edit?: (entry: TimeEntry) => void;
  remove?: (entry: TimeEntry) => void;
  withMember?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="time-table">
        <thead>
          <tr>
            <th>{tr('Projet & travail effectué')}</th>
            {withMember && <th>{tr('Membre')}</th>}
            <th>{tr('Date')}</th>
            <th className="numeric">{tr('Durée')}</th>
            {edit && (
              <th>
                <span className="visually-hidden">{tr('Actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>
                <div className="table-project">
                  <span className="project-dot" style={{ background: e.projectColor }} />
                  <strong>{e.projectName}</strong>
                  {e.taskName && <span className="quiet">/ {e.taskName}</span>}
                  {e.actionName && <span className="quiet">/ {e.actionName}</span>}
                </div>
                <p className="table-description">
                  {e.description || <span className="quiet">{tr('Sans description')}</span>}
                </p>
              </td>
              {withMember && <td>{e.memberName}</td>}
              <td>
                <span className="nowrap">
                  {e.workDate
                    ? new Intl.DateTimeFormat(locale(), {
                        dateStyle: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${e.workDate}T00:00:00Z`))
                    : new Intl.DateTimeFormat(locale(), {
                        dateStyle: 'short',
                        timeZone: timezone,
                      }).format(new Date((e.segments[0]?.startedAt ?? e.createdAt) * 1000))}
                </span>
                <small className="cell-secondary">
                  {e.kind === 'timer'
                    ? tr('Chronomètre')
                    : e.kind === 'duration'
                      ? tr('Durée manuelle')
                      : tr('Intervalle')}
                </small>
              </td>
              <td className="numeric">
                <strong className="duration">
                  {clockText('reportSeconds' in e ? e.reportSeconds : e.seconds)}
                </strong>
                {e.state !== 'finished' && (
                  <Badge tone="green">
                    {e.state === 'paused' ? tr('En pause') : tr('En cours')}
                  </Badge>
                )}
              </td>
              {edit && (
                <td className="row-actions">
                  {e.state === 'finished' && (
                    <>
                      <button
                        className="icon-button"
                        onClick={() => edit(e)}
                        aria-label={tr('Corriger {0}', e.projectName)}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                      {remove && (
                        <button
                          className="icon-button delete-button"
                          onClick={() => remove(e)}
                          aria-label={tr('Supprimer le temps {0}', e.projectName)}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      )}
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Times({
  session,
  projects,
  members,
  actions,
  revision,
  initialMonth,
  openTimesheets,
}: {
  session: Session;
  projects: Project[];
  members: Member[];
  actions: Actions;
  revision: number;
  initialMonth: string;
  openTimesheets?: () => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [memberId, setMemberId] = useState('me');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ items: TimeEntry[]; total: number }>({ items: [], total: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void request<{ items: TimeEntry[]; total: number }>(
      `/time-entries?month=${month}&memberId=${memberId}&offset=${offset}`,
    )
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, memberId, offset, revision]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr('UNE TRACE DE VOTRE TRAVAIL')}</p>
          <h1>
            {tr('Les temps')}
            <span className="title-dot">.</span>
          </h1>
          <p className="quiet">{tr('Chaque session, au bon endroit.')}</p>
        </div>
        <div className="button-group">
          {openTimesheets && (
            <button className="button secondary" onClick={openTimesheets}>
              {tr('Feuilles de temps')}
            </button>
          )}
          <button
            className="button primary"
            disabled={!projects.some((p) => !p.archived)}
            onClick={() =>
              actions.open(
                tr('Ajouter un temps'),
                <ManualForm projects={projects} session={session} actions={actions} />,
              )
            }
          >
            <Icon name="plus" />
            {tr('Ajouter un temps')}
          </button>
        </div>
      </div>
      <div className="toolbar">
        <label className="inline-field">
          {tr('Mois')}
          <input
            type="month"
            value={month}
            required
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setOffset(0);
              }
            }}
          />
        </label>
        {session.member.role !== 'contributor' && (
          <label className="inline-field">
            {tr('Membre')}
            <select
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                setOffset(0);
              }}
            >
              <option value="me">{tr('Mes temps')}</option>
              {members
                .filter((m) => m.id !== session.member.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <span className="quiet toolbar-end">
          {data.total} {tr('entrée(s) · ')}
          {session.workspace.timezone}
        </span>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        {loading ? (
          <p className="loading">{tr('Chargement des temps…')}</p>
        ) : data.items.length ? (
          <TimeTable
            entries={data.items}
            timezone={session.workspace.timezone}
            withMember={memberId !== 'me'}
            edit={(entry) =>
              actions.open(
                tr('Corriger ce temps'),
                <ManualForm
                  projects={projects}
                  session={session}
                  entry={entry}
                  actions={actions}
                />,
              )
            }
            remove={(entry) =>
              actions.open(tr('Supprimer ce temps'), <DeleteForm entry={entry} actions={actions} />)
            }
          />
        ) : (
          <Empty
            title={tr('Pas encore de temps pour ce mois')}
            detail={tr('Lancez un chronomètre ou ajoutez une durée manuellement.')}
          />
        )}
      </section>
      {data.total > 50 && (
        <div className="pagination">
          <button
            className="button secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            {tr('Précédent')}
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 50, data.total)} {tr('sur')}
            {data.total}
          </span>
          <button
            className="button secondary"
            disabled={offset + 50 >= data.total}
            onClick={() => setOffset(offset + 50)}
          >
            {tr('Suivant')}
          </button>
        </div>
      )}
    </>
  );
}
