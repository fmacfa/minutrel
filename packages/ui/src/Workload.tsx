// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import type { Member, Project, ProjectAction } from '@minutrel/contracts';
import { dateInZone, plannedSeconds, scheduledSpan } from '@minutrel/domain/reports';
import { shortDuration } from './components.tsx';
import { formatMoney, formatRate } from './HourlyRate.tsx';
import { t as tr } from './i18n.ts';
import { periodLabel, scheduleLabel, ScheduleWindow, useSchedule } from './Schedule.tsx';
import { useResource } from './useResource.ts';

export function Workload({
  projects,
  members,
  today,
  timezone,
  revision,
  goBack,
}: {
  projects: Project[];
  members: Member[];
  today: number;
  timezone: string;
  revision: number;
  goBack: () => void;
}) {
  const schedule = useSchedule(dateInZone(today, timezone));
  const { start, end } = schedule.selection;
  const periods = schedule.periods;
  const [projectId, setProjectId] = useState('');
  const [capacity, setCapacity] = useState('');
  const result = useResource<ProjectAction[]>('/project-actions', revision);
  const activeProjects = new Map(projects.filter((p) => !p.archived).map((p) => [p.id, p.name]));
  const activeActions = (result?.data ?? []).filter(
    (a) =>
      a.status !== 'done' &&
      activeProjects.has(a.projectId) &&
      (!projectId || a.projectId === projectId),
  );
  const rows = new Map<string | null, { name: string; seconds: number[] }>();
  const incomplete: ProjectAction[] = [];
  for (const a of activeActions) {
    const span = scheduledSpan(a);
    if (!span || !a.estimateSeconds) {
      incomplete.push(a);
      continue;
    }
    if (span.start >= end || span.end <= start) continue;
    const row = rows.get(a.assigneeId) ?? {
      name: a.assigneeName ?? tr('Sans responsable'),
      seconds: periods.map(() => 0),
    };
    periods.forEach((period, i) => {
      row.seconds[i]! += plannedSeconds(span, a.estimateSeconds!, period.start, period.end);
    });
    if (row.seconds.some(Boolean)) rows.set(a.assigneeId, row);
  }
  const weeklyCapacity = Math.round(Number(capacity) * 3600);
  const rates = new Map(members.map((member) => [member.id, member.hourlyRate]));
  const showAmounts = [...rows.keys()].some((id) => id && rates.get(id));
  return (
    <div className="planning-page">
      <button className="text-button back-button" onClick={goBack}>
        <span aria-hidden="true">‹</span> {tr('Tous les projets')}
      </button>
      <div className="page-heading">
        <div>
          <h1>{tr('Plan de charge')}</h1>
          <p className="quiet">
            {tr('Les estimations des actions ouvertes sont réparties du lundi au vendredi.')}
          </p>
        </div>
      </div>
      <div className="toolbar">
        <ScheduleWindow schedule={schedule} />
        <label className="inline-field">
          {tr('Projet')}
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{tr('Tous les projets')}</option>
            {[...activeProjects].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          {tr('Capacité par personne (h/semaine)')}
          <input
            className="capacity-input"
            type="number"
            min="0"
            step="any"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </label>
      </div>
      {!result && <p className="loading">{tr('Chargement…')}</p>}
      {result?.error && (
        <p className="notice error" role="alert">
          {result.error}
        </p>
      )}
      {showAmounts && (
        <p className="quiet">
          {tr('Les montants sont estimés à partir des taux horaires et des heures prévues.')}
        </p>
      )}
      {result?.data &&
        (rows.size ? (
          <section
            className="panel table-scroll"
            tabIndex={0}
            aria-label={tr('Charge par personne')}
          >
            <table
              className="time-table workload-table"
              style={{ minWidth: Math.max(690, 200 + periods.length * 88) }}
            >
              <thead>
                <tr>
                  <th scope="col">{tr('Responsable de l’action')}</th>
                  {periods.map((period) => (
                    <th
                      scope="col"
                      key={period.start}
                      title={scheduleLabel(period)}
                      className="numeric"
                    >
                      {periodLabel(period)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort(([a, first], [b, second]) =>
                    a === null ? 1 : b === null ? -1 : first.name.localeCompare(second.name),
                  )
                  .map(([id, row]) => {
                    const rate = id ? rates.get(id) : undefined;
                    return (
                      <tr key={id ?? 'unassigned'}>
                        <th scope="row">
                          {row.name}
                          {rate && <small className="cell-secondary">{formatRate(rate)}</small>}
                        </th>
                        {row.seconds.map((seconds, i) => {
                          const period = periods[i]!;
                          const over =
                            id !== null &&
                            weeklyCapacity > 0 &&
                            seconds > (weeklyCapacity * period.workdays) / 5;
                          return (
                            <td key={period.start} className="numeric">
                              <strong className={`duration${over ? ' capacity-over' : ''}`}>
                                {seconds ? shortDuration(Math.round(seconds / 60) * 60) : '—'}
                              </strong>
                              {rate && seconds > 0 && (
                                <small className="cell-secondary" title={tr('Montant estimé')}>
                                  {formatMoney(
                                    (BigInt(seconds) * BigInt(rate.amountMinor) + 1800n) / 3600n,
                                    rate.currency,
                                  )}
                                </small>
                              )}
                              {over && (
                                <small className="cell-secondary">{tr('Capacité dépassée')}</small>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="notice">{tr('Aucune charge estimée sur cette période.')}</p>
        ))}
      {!!incomplete.length && (
        <section className="panel padded">
          <h2>{tr('Actions à planifier')}</h2>
          <ul className="planning-list">
            {incomplete.map((a) => (
              <li key={a.id}>
                <strong>{a.title}</strong>
                <span className="quiet">
                  {activeProjects.get(a.projectId)} · {a.assigneeName ?? tr('Sans responsable')} ·{' '}
                  {a.startOn || a.dueOn ? tr('Sans estimation') : tr('Sans dates')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
