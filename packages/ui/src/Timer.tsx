// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { useEffect, useState } from 'react';
import type { Project, TimeEntry } from '@minutrel/contracts';
import { Icon, clockText, type Actions } from './components.tsx';
import { request } from './transport.ts';
import { syncStatus } from './local.ts';

export function elapsed(timer: TimeEntry | null, now: number): number {
  if (!timer) return 0;
  const segment = timer.segments.find((s) => s.endedAt === null);
  return (
    timer.seconds +
    (timer.state === 'running' && segment ? Math.max(0, now - segment.startedAt) : 0)
  );
}
export function LiveCounter({ timer, offset }: { timer: TimeEntry | null; offset: number }) {
  const [time, setTime] = useState(() => Date.now() / 1000 + offset);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      if (interval) clearInterval(interval);
      setTime(Date.now() / 1000 + offset);
      if (timer?.state === 'running' && document.visibilityState === 'visible')
        interval = setInterval(() => setTime(Date.now() / 1000 + offset), 1000);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, [timer?.id, timer?.state, offset]);
  return <>{clockText(elapsed(timer, time))}</>;
}
export function TimerPanel({
  projects,
  timer,
  offset,
  actions,
  compact = false,
  offline = false,
}: {
  projects: Project[];
  timer: TimeEntry | null;
  offset: number;
  actions: Actions;
  compact?: boolean;
  offline?: boolean;
}) {
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [description, setDescription] = useState('');
  const available = projects.filter((p) => !p.archived);
  useEffect(() => {
    if (!available.some((p) => p.id === projectId)) {
      setProjectId(available[0]?.id ?? '');
      setTaskId('');
    }
  }, [projects, projectId]);
  const selected = available.find((p) => p.id === projectId);
  const command = async (action: 'start' | 'pause' | 'resume' | 'stop') => {
    const ok = await actions.act(
      () =>
        request(
          `/timer/${action}`,
          'POST',
          action === 'start'
            ? { projectId, taskId: taskId || null, description }
            : { version: timer!.version },
        ),
      action === 'stop' ? tr('Temps enregistré.') : undefined,
    );
    if (ok && action === 'stop') setDescription('');
  };
  return (
    <section
      className={`timer-panel ${compact ? 'compact' : ''} ${timer?.state === 'running' ? 'is-running' : ''}`}
      aria-label={tr('Chronomètre')}
    >
      <div className="timer-topline">
        <span className="eyebrow">
          <span className={`status-dot ${timer?.state === 'running' ? 'pulse' : ''}`} />
          {timer
            ? timer.state === 'paused'
              ? tr('Chronomètre en pause')
              : tr('Vous êtes en train de travailler')
            : tr('Un projet, un peu de temps')}
        </span>
        {!compact && (
          <span className="quiet">
            {syncStatus().local
              ? tr('Stockage personnel sur cet ordinateur')
              : syncStatus().pending
                ? tr('En attente d’envoi')
                : tr('Synchronisé avec votre équipe')}
          </span>
        )}
      </div>
      {timer ? (
        <>
          <div className="timer-project">
            <span className="project-dot" style={{ background: timer.projectColor }} />
            <strong>{timer.projectName}</strong>
            {timer.taskName && <span className="quiet"> / {timer.taskName}</span>}
          </div>
          {timer.description && <p className="timer-description">{timer.description}</p>}
        </>
      ) : (
        <div className="timer-fields">
          <label className="visually-hidden" htmlFor={compact ? 'quick-project' : 'timer-project'}>
            {tr('Projet à chronométrer')}
          </label>
          <select
            id={compact ? 'quick-project' : 'timer-project'}
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setTaskId('');
            }}
            disabled={actions.pending || offline || !available.length}
          >
            <option value="" disabled>
              {available.length ? tr('Choisir un projet') : tr('Aucun projet disponible')}
            </option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {!!selected?.tasks.filter((t) => !t.archived).length && (
            <>
              <label className="visually-hidden" htmlFor={compact ? 'quick-task' : 'timer-task'}>
                {tr('Sous-catégorie facultative')}
              </label>
              <select
                id={compact ? 'quick-task' : 'timer-task'}
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={actions.pending || offline}
              >
                <option value="">{tr('Sans sous-catégorie')}</option>
                {selected.tasks
                  .filter((t) => !t.archived)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </>
          )}
          {!compact && (
            <input
              aria-label={tr('Description du travail')}
              placeholder={tr('Sur quoi allez-vous travailler ?')}
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              disabled={actions.pending || offline}
            />
          )}
        </div>
      )}
      <div className="timer-bottom">
        <div className="timer-count" role="timer" aria-label={tr('Temps écoulé')} aria-live="off">
          <LiveCounter timer={timer} offset={offset} />
        </div>
        <div className="timer-controls">
          {timer ? (
            <>
              <button
                className="button secondary"
                disabled={actions.pending || offline}
                onClick={() => void command(timer.state === 'paused' ? 'resume' : 'pause')}
              >
                <Icon name={timer.state === 'paused' ? 'play' : 'pause'} />
                {compact ? '' : timer.state === 'paused' ? tr('Reprendre') : tr('Pause')}
                <span className="visually-hidden">
                  {compact ? (timer.state === 'paused' ? tr('Reprendre') : tr('Pause')) : ''}
                </span>
              </button>
              <button
                className="button primary"
                disabled={actions.pending || offline}
                onClick={() => void command('stop')}
              >
                <Icon name="stop" />
                {compact ? (
                  <span className="visually-hidden">{tr('Arrêter et enregistrer')}</span>
                ) : (
                  tr('Terminer')
                )}
              </button>
            </>
          ) : (
            <button
              className="button primary start-button"
              disabled={!projectId || actions.pending || offline}
              onClick={() => void command('start')}
            >
              <Icon name="play" />
              {tr('Démarrer')}
            </button>
          )}
        </div>
      </div>
      {compact && !timer && (
        <p className="micro">{tr('Choisissez un projet Minutrel pour démarrer.')}</p>
      )}
    </section>
  );
}
