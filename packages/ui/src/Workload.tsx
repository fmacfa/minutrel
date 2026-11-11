// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import type { Project, ProjectAction } from '@minutrel/contracts';
import {
  addDays,
  dateInZone,
  mondayOf,
  plannedSeconds,
  scheduledSpan,
} from '@minutrel/domain/reports';
import { shortDuration } from './components.tsx';
import { t as tr } from './i18n.ts';
import { calendarLabel, ScheduleWindow, scheduleWeeks, weekStarts } from './Schedule.tsx';
import { useResource } from './useResource.ts';

export function Workload({
  projects,
  today,
  timezone,
  revision,
  goBack,
}: {
  projects: Project[];
  today: number;
  timezone: string;
  revision: number;
  goBack: () => void;
}) {
  const [start, setStart] = useState(() => mondayOf(dateInZone(today, timezone)));
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
  const weeks = weekStarts(start);
  const end = addDays(start, scheduleWeeks * 7);
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
      seconds: weeks.map(() => 0),
    };
    weeks.forEach((week, i) => {
      row.seconds[i]! += plannedSeconds(span, a.estimateSeconds!, week, addDays(week, 7));
    });
    if (row.seconds.some(Boolean)) rows.set(a.assigneeId, row);
  }
  const maxSeconds = Math.round(Number(capacity) * 3600);
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
        <ScheduleWindow start={start} onChange={setStart} />
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
      {result?.data &&
        (rows.size ? (
          <section
            className="panel table-scroll"
            tabIndex={0}
            aria-label={tr('Charge hebdomadaire par personne')}
          >
            <table className="time-table workload-table">
              <thead>
                <tr>
                  <th scope="col">{tr('Responsable de l’action')}</th>
                  {weeks.map((week) => (
                    <th scope="col" key={week} className="numeric">
                      {calendarLabel(week)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort(([a, first], [b, second]) =>
                    a === null ? 1 : b === null ? -1 : first.name.localeCompare(second.name),
                  )
                  .map(([id, row]) => (
                    <tr key={id ?? 'unassigned'}>
                      <th scope="row">{row.name}</th>
                      {row.seconds.map((seconds, i) => {
                        const over = id !== null && maxSeconds > 0 && seconds > maxSeconds;
                        return (
                          <td key={weeks[i]} className="numeric">
                            <strong className={`duration${over ? ' capacity-over' : ''}`}>
                              {seconds ? shortDuration(Math.round(seconds / 60) * 60) : '—'}
                            </strong>
                            {over && (
                              <small className="cell-secondary">{tr('Capacité dépassée')}</small>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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
