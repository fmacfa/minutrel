// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, type CSSProperties, type FormEvent } from 'react';
import type {
  ActionStatus,
  Member,
  Project,
  ProjectAction,
  ProjectOverview,
  Session,
} from '@minutrel/contracts';
import { formatDuration, parseDuration } from '@minutrel/domain';
import { dateInZone, daysBetween, scheduledSpan } from '@minutrel/domain/reports';
import {
  Badge,
  clockText,
  Empty,
  Field,
  formData,
  Icon,
  val,
  type Actions,
} from './components.tsx';
import { t as tr } from './i18n.ts';
import {
  calendarLabel,
  PageControls,
  periodLabel,
  scheduleLabel,
  ScheduleWindow,
  useSchedule,
} from './Schedule.tsx';
import { TimeTable } from './Times.tsx';
import { request } from './transport.ts';
import { useResource } from './useResource.ts';

const statuses: ActionStatus[] = ['todo', 'in_progress', 'done'];
const statusLabel = (status: ActionStatus) =>
  ({ todo: tr('À faire'), in_progress: tr('En cours de réalisation'), done: tr('Terminée') })[
    status
  ];
const statusTone = (status: ActionStatus) =>
  ({ todo: '', in_progress: 'yellow', done: 'green' })[status];

function ActionForm({
  project,
  members,
  action,
  actions,
}: {
  project: Project;
  members: Member[];
  action?: ProjectAction;
  actions: Actions;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    const f = formData(event);
    const ok = await actions.act(
      async () => {
        const estimate = val(f, 'estimate').trim();
        const current = action?.estimateSeconds;
        return request(
          action ? `/project-actions/${action.id}` : `/projects/${project.id}/actions`,
          action ? 'PATCH' : 'POST',
          {
            title: val(f, 'title'),
            taskId: val(f, 'taskId') || null,
            assigneeId: val(f, 'assigneeId') || null,
            startOn: val(f, 'startOn') || null,
            dueOn: val(f, 'dueOn') || null,
            status: val(f, 'status'),
            estimateSeconds: estimate
              ? current && estimate === formatDuration(current)
                ? current
                : parseDuration(estimate)
              : null,
            ...(action ? { version: action.version } : {}),
          },
          key,
        );
      },
      action ? tr('Action mise à jour.') : tr('Action créée.'),
    );
    if (ok) actions.close();
  };
  return (
    <form className="stack-form" onSubmit={(e) => void submit(e)}>
      <Field label={tr('Intitulé de l’action')}>
        <input name="title" required maxLength={200} defaultValue={action?.title} autoFocus />
      </Field>
      <div className="form-grid">
        <Field label={tr('Sous-catégorie facultative')}>
          <select name="taskId" defaultValue={action?.taskId ?? ''}>
            <option value="">{tr('Sans sous-catégorie')}</option>
            {project.tasks
              .filter((t) => !t.archived || t.id === action?.taskId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={tr('Responsable de l’action')}>
          <select name="assigneeId" defaultValue={action?.assigneeId ?? ''}>
            <option value="">{tr('Sans responsable')}</option>
            {members
              .filter(
                (m) =>
                  (m.enabled && project.memberIds.includes(m.id)) || m.id === action?.assigneeId,
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={tr('Début prévu')}>
          <input type="date" name="startOn" defaultValue={action?.startOn ?? ''} />
        </Field>
        <Field label={tr('Fin prévue')}>
          <input type="date" name="dueOn" defaultValue={action?.dueOn ?? ''} />
        </Field>
        <Field label={tr('Temps estimé')} hint={tr('Facultatif · Ex. 40 h ou 120 min')}>
          <input
            name="estimate"
            maxLength={60}
            defaultValue={action?.estimateSeconds ? formatDuration(action.estimateSeconds) : ''}
          />
        </Field>
        <Field label={tr('Statut')}>
          <select name="status" defaultValue={action?.status ?? 'todo'}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-footer">
        <button type="button" className="button secondary" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" disabled={actions.pending}>
          {tr('Enregistrer')}
        </button>
      </div>
    </form>
  );
}

function Overview({
  project,
  session,
  members,
  initialMonth,
  revision,
  local,
}: {
  project: Project;
  session: Session;
  members: Member[];
  initialMonth: string;
  revision: number;
  local: boolean;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [byMonth, setByMonth] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [offset, setOffset] = useState(0);
  const query = new URLSearchParams({ offset: String(offset) });
  if (byMonth) query.set('month', month);
  if (taskId) query.set('taskId', taskId);
  if (memberId) query.set('memberId', memberId);
  const result = useResource<ProjectOverview>(
    `/projects/${project.id}/overview?${query}`,
    revision,
  );
  const data = result?.data;
  const full = local || data?.scope === 'team';
  const budget = project.budgetSeconds;
  const remaining = (budget ?? 0) - (data?.totalSeconds ?? 0);
  const categoryName = (id: string | null) =>
    project.tasks.find((t) => t.id === id)?.name ?? tr('Sans sous-catégorie');
  return (
    <>
      {result?.error && (
        <p className="notice error" role="alert">
          {result.error}
        </p>
      )}
      <div className="stats-grid planning-stats">
        <article className="stat-card">
          <span>{tr('Budget horaire')}</span>
          <strong>{budget ? clockText(budget) : '—'}</strong>
        </article>
        <article className="stat-card">
          <span>{full ? tr('Temps enregistré') : tr('Mes temps')}</span>
          <strong>{data ? clockText(data.totalSeconds) : '—'}</strong>
        </article>
        {full && budget && data ? (
          <article className="stat-card">
            <span>{remaining < 0 ? tr('Dépassement du budget') : tr('Budget restant')}</span>
            <strong>{clockText(Math.abs(remaining))}</strong>
          </article>
        ) : null}
        <article className="stat-card">
          <span>{tr('Échéance du projet')}</span>
          <strong>{project.dueOn ? calendarLabel(project.dueOn, true) : '—'}</strong>
        </article>
      </div>
      {data?.scope === 'personal' && !local && (
        <p className="quiet">{tr('Cette vue affiche uniquement vos temps.')}</p>
      )}
      <div className="toolbar">
        <label className="inline-field">
          {tr('Période')}
          <select
            value={byMonth ? 'month' : 'all'}
            onChange={(e) => {
              setByMonth(e.target.value === 'month');
              setOffset(0);
            }}
          >
            <option value="all">{tr('Depuis le début')}</option>
            <option value="month">{tr('Par mois')}</option>
          </select>
        </label>
        {byMonth && (
          <input
            aria-label={tr('Mois')}
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setOffset(0);
              }
            }}
          />
        )}
        <label className="inline-field">
          {tr('Sous-catégorie')}
          <select
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">{tr('Toutes')}</option>
            <option value="none">{tr('Sans sous-catégorie')}</option>
            {project.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {!local && session.member.role !== 'contributor' && (
          <label className="inline-field">
            {tr('Membre')}
            <select
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">{tr('Toute l’équipe')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!result && <p className="loading">{tr('Chargement des temps…')}</p>}
      {data && (
        <>
          {!!data.categories.length && (
            <section className="panel padded">
              <div className="section-heading">
                <h2>{tr('Temps par sous-catégorie')}</h2>
              </div>
              <div className="category-totals">
                {data.categories.map((c) => (
                  <button
                    key={c.taskId ?? 'none'}
                    className="button secondary"
                    aria-pressed={(c.taskId ?? 'none') === taskId}
                    onClick={() => {
                      setTaskId(taskId === (c.taskId ?? 'none') ? '' : (c.taskId ?? 'none'));
                      setOffset(0);
                    }}
                  >
                    {categoryName(c.taskId)}{' '}
                    <strong className="duration">{clockText(c.seconds)}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="panel">
            <div className="section-heading padded-heading">
              <h2>{tr('Le travail effectué')}</h2>
              <span className="duration">{clockText(data.filteredSeconds)}</span>
            </div>
            {data.entries.length ? (
              <TimeTable
                entries={data.entries}
                timezone={session.workspace.timezone}
                withMember={data.scope === 'team'}
              />
            ) : (
              <p className="loading">{tr('Aucun temps finalisé pour cette période.')}</p>
            )}
            <PageControls offset={offset} count={data.entryCount} onChange={setOffset} />
          </section>
        </>
      )}
    </>
  );
}

function Gantt({ actions, today }: { actions: ProjectAction[]; today: string }) {
  const schedule = useSchedule(today);
  const { start, end } = schedule.selection;
  const dayCount = daysBetween(start, end);
  const periods = schedule.periods;
  const gridLines = periods.slice(1).map((period) => {
    const position = `${(daysBetween(start, period.start) / dayCount) * 100}%`;
    return `transparent ${position}, var(--color-border) ${position}, var(--color-border) calc(${position} + 1px), transparent calc(${position} + 1px)`;
  });
  const timelineStyle = {
    minWidth: Math.max(690, 220 + periods.length * 76),
    '--gantt-columns': periods.map((period) => `minmax(0, ${period.days}fr)`).join(' '),
    '--gantt-grid': gridLines.length
      ? `linear-gradient(to right, ${gridLines.join(', ')})`
      : 'none',
  } as CSSProperties;
  const rows = actions.flatMap((action) => {
    const span = scheduledSpan(action);
    if (!span || span.start >= end || span.end <= start) return [];
    const left = Math.max(0, daysBetween(start, span.start));
    const right = Math.min(dayCount, daysBetween(start, span.end));
    return [
      { action, span, left: (left / dayCount) * 100, width: ((right - left) / dayCount) * 100 },
    ];
  });
  const undated = actions.filter((a) => !a.startOn && !a.dueOn);
  return (
    <>
      <div className="toolbar">
        <ScheduleWindow schedule={schedule} />
        <div className="status-legend">
          {statuses.map((s) => (
            <Badge key={s} tone={statusTone(s)}>
              {statusLabel(s)}
            </Badge>
          ))}
        </div>
      </div>
      {rows.length ? (
        <section className="panel table-scroll" tabIndex={0} aria-label={tr('Diagramme de Gantt')}>
          <table className="time-table gantt-table" style={timelineStyle}>
            <colgroup>
              <col className="gantt-name" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{tr('Action')}</th>
                <th scope="col" className="gantt-date-header">
                  <div className="gantt-dates">
                    {periods.map((period) => (
                      <span key={period.start} title={scheduleLabel(period)}>
                        {periodLabel(period)}
                      </span>
                    ))}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ action, span, left, width }) => {
                const dates = scheduleLabel(span);
                return (
                  <tr key={action.id}>
                    <th scope="row">
                      <strong>{action.title}</strong>
                      <small className="cell-secondary">
                        {action.assigneeName ?? tr('Sans responsable')}
                      </small>
                      <small className="cell-secondary">{dates}</small>
                    </th>
                    <td className="gantt-timeline">
                      <div
                        className="gantt-bar"
                        data-status={action.status}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${action.title} · ${dates} · ${statusLabel(action.status)}`}
                      />
                      <span className="visually-hidden">{statusLabel(action.status)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="notice">{tr('Aucune action planifiée sur cette période.')}</p>
      )}
      {!!undated.length && (
        <section className="panel padded">
          <h2>{tr('Actions sans dates')}</h2>
          <ul className="planning-list">
            {undated.map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function ProjectPlanning({
  project,
  members,
  session,
  initialMonth,
  local,
  revision,
  actions,
  goBack,
  edit,
  categories,
}: {
  project: Project;
  members: Member[];
  session: Session;
  initialMonth: string;
  local: boolean;
  revision: number;
  actions: Actions;
  goBack: () => void;
  edit?: () => void;
  categories?: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'actions' | 'gantt'>('overview');
  const result = useResource<ProjectAction[]>(
    tab !== 'overview' ? `/project-actions?projectId=${project.id}` : null,
    revision,
  );
  const manage = !!edit && !project.archived;
  const openAction = (action?: ProjectAction) =>
    actions.open(
      action ? tr('Modifier l’action') : tr('Nouvelle action'),
      <ActionForm project={project} members={members} action={action} actions={actions} />,
    );
  return (
    <div className="planning-page">
      <button className="text-button back-button" onClick={goBack}>
        <span aria-hidden="true">‹</span> {tr('Tous les projets')}
      </button>
      <div className="page-heading">
        <div>
          <h1>{project.name}</h1>
          {project.description && <p className="quiet project-intro">{project.description}</p>}
        </div>
        {edit && (
          <div className="button-group">
            <button className="button secondary" onClick={edit}>
              {tr('Modifier le projet')}
            </button>
            {categories && (
              <button className="button secondary" onClick={categories}>
                {tr('Sous-catégories')}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="toolbar planning-nav">
        <div className="segmented" aria-label={tr('Vues du projet')}>
          <button
            aria-pressed={tab === 'overview'}
            className={tab === 'overview' ? 'selected' : ''}
            onClick={() => setTab('overview')}
          >
            {tr('Fiche projet')}
          </button>
          <button
            aria-pressed={tab === 'actions'}
            className={tab === 'actions' ? 'selected' : ''}
            onClick={() => setTab('actions')}
          >
            {tr('Actions')}
          </button>
          <button
            aria-pressed={tab === 'gantt'}
            className={tab === 'gantt' ? 'selected' : ''}
            onClick={() => setTab('gantt')}
          >
            {tr('Gantt')}
          </button>
        </div>
        {manage && tab === 'actions' && (
          <button className="button primary" onClick={() => openAction()}>
            <Icon name="plus" />
            {tr('Nouvelle action')}
          </button>
        )}
      </div>
      {tab === 'overview' && (
        <Overview
          project={project}
          session={session}
          members={members}
          initialMonth={initialMonth}
          revision={revision}
          local={local}
        />
      )}
      {tab !== 'overview' && !result && <p className="loading">{tr('Chargement…')}</p>}
      {result?.error && (
        <p className="notice error" role="alert">
          {result.error}
        </p>
      )}
      {tab === 'actions' &&
        result?.data &&
        (result.data.length ? (
          <div className="action-grid">
            {result.data.map((a) => (
              <article className="panel padded action-card" key={a.id}>
                <div className="section-heading">
                  <h2>{a.title}</h2>
                  <Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge>
                </div>
                {a.taskId && (
                  <p className="quiet">{project.tasks.find((t) => t.id === a.taskId)?.name}</p>
                )}
                <dl>
                  <dt>{tr('Responsable de l’action')}</dt>
                  <dd>{a.assigneeName ?? tr('Sans responsable')}</dd>
                  <dt>{tr('Début prévu')}</dt>
                  <dd>{a.startOn ? calendarLabel(a.startOn, true) : '—'}</dd>
                  <dt>{tr('Fin prévue')}</dt>
                  <dd>{a.dueOn ? calendarLabel(a.dueOn, true) : '—'}</dd>
                  <dt>{tr('Temps estimé')}</dt>
                  <dd>{a.estimateSeconds ? formatDuration(a.estimateSeconds) : '—'}</dd>
                </dl>
                {manage ? (
                  <button className="button secondary" onClick={() => openAction(a)}>
                    {tr('Modifier l’action')}
                  </button>
                ) : (
                  !project.archived &&
                  a.assigneeId === session.member.id && (
                    <label className="inline-field">
                      {tr('Statut')}
                      <select
                        aria-label={tr('Statut de {0}', a.title)}
                        value={a.status}
                        disabled={actions.pending}
                        onChange={(e) => {
                          const status = e.target.value;
                          void actions.act(
                            () =>
                              request(`/project-actions/${a.id}`, 'PATCH', {
                                status,
                                version: a.version,
                              }),
                            tr('Action mise à jour.'),
                          );
                        }}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={tr('Aucune action')}
            detail={tr('Les actions de ce projet apparaîtront ici.')}
          />
        ))}
      {tab === 'gantt' && result?.data && (
        <Gantt
          actions={result.data}
          today={dateInZone(session.serverNow, session.workspace.timezone)}
        />
      )}
    </div>
  );
}
