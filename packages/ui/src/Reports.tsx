// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr, locale } from './i18n.ts';
import { getLanguage } from './i18n.ts';
import { useEffect, useState } from 'react';
import type { Member, MonthlyReport, Session } from '@minutrel/contracts';
import { Avatar, Empty, Icon, shortDuration, type Actions } from './components.tsx';
import { download, request } from './transport.ts';
import { TimeTable } from './Times.tsx';

export function ProjectBreakdown({ report }: { report: MonthlyReport }) {
  return (
    <div className="breakdown">
      {report.projects.length ? (
        report.projects.map((p) => (
          <div key={p.id} className="breakdown-row">
            <div className="breakdown-label">
              <span>
                <span className="project-dot" style={{ background: p.color }} />
                {p.name}
              </span>
              <strong>{shortDuration(p.seconds)}</strong>
            </div>
            <div className="bar-track">
              <div
                style={{
                  width: `${report.totalSeconds ? (p.seconds / report.totalSeconds) * 100 : 0}%`,
                  background: p.color,
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="quiet">{tr('Vos projets apparaîtront après le premier temps enregistré.')}</p>
      )}
    </div>
  );
}
export function Reports({
  session,
  members,
  initialMonth,
  revision,
  actions,
  local,
}: {
  session: Session;
  members: Member[];
  initialMonth: string;
  revision: number;
  actions: Actions;
  local: boolean;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string[]>([]);
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const administrator = session.member.role === 'admin';
  const memberFilter = selected.join(',');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void request<MonthlyReport>(
      `/reports/monthly?month=${month}${memberFilter ? `&memberIds=${memberFilter}` : ''}${approvedOnly ? '&approvedOnly=true' : ''}`,
    )
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : tr('Chargement impossible.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, memberFilter, revision, approvedOnly]);
  const exportReport = async (format: 'csv' | 'pdf' | 'zip') => {
    await actions.act(async () => {
      const item = await request<{ url: string; filename: string }>('/exports', 'POST', {
        month,
        format,
        language: getLanguage(),
        ...(selected.length ? { memberIds: selected } : {}),
        ...(approvedOnly ? { approvedOnly } : {}),
      });
      await download(item.url, item.filename);
    }, tr('Téléchargement préparé.'));
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr('LE TRAVAIL, EN PERSPECTIVE')}</p>
          <h1>
            {administrator ? tr('Les rapports') : tr('Mon rapport')}
            <span className="title-dot">.</span>
          </h1>
          <p className="quiet">
            {tr('Un mois de travail, des chiffres précis, une vue partagée.')}
          </p>
        </div>
        {administrator && (
          <div className="button-group">
            <button
              className="button secondary"
              disabled={loading || !!error || actions.pending}
              onClick={() => void exportReport('csv')}
            >
              <Icon name="download" />
              {tr('CSV')}
            </button>
            <button
              className="button secondary"
              disabled={loading || !!error || actions.pending}
              onClick={() => void exportReport('pdf')}
            >
              <Icon name="download" />
              {tr('PDF')}
            </button>
            <button
              className="button primary"
              disabled={loading || !!error || actions.pending}
              onClick={() => void exportReport('zip')}
            >
              <Icon name="download" />
              {tr('Dossier ZIP')}
            </button>
          </div>
        )}
      </div>
      <div className="toolbar">
        <label className="inline-field">
          {tr('Période')}
          <input
            type="month"
            value={month}
            required
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </label>
        {administrator && (
          <details className="member-filter">
            <summary>
              {selected.length
                ? tr('{0} membre(s) sélectionné(s)', selected.length)
                : tr('Toute l’équipe')}
            </summary>
            <div className="member-filter-menu">
              <button className="text-button" onClick={() => setSelected([])}>
                {tr('Toute l’équipe')}
              </button>
              {members.map((m) => (
                <label className="check-row" key={m.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, m.id]
                          : selected.filter((mid) => mid !== m.id),
                      )
                    }
                  />
                  {m.name}
                  {!m.enabled && tr(' (désactivé)')}
                </label>
              ))}
            </div>
          </details>
        )}
        {!local && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={approvedOnly}
              onChange={(e) => setApprovedOnly(e.target.checked)}
            />
            {tr('Temps approuvés uniquement')}
          </label>
        )}
        <span className="quiet toolbar-end">{session.workspace.timezone}</span>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading">{tr('Préparation du rapport…')}</p>
      ) : (
        report &&
        !error && (
          <>
            <div className="stats-grid">
              <article className="stat-card">
                <span>{report.approvedOnly ? tr('Temps approuvé') : tr('Temps finalisé')}</span>
                <strong>{shortDuration(report.totalSeconds)}</strong>
                <small>
                  {report.totalSeconds.toLocaleString(locale())} {tr('secondes exactes')}
                </small>
              </article>
              <article className="stat-card">
                <span>{tr('Projets accompagnés')}</span>
                <strong>{report.projects.length.toString().padStart(2, '0')}</strong>
                <small>{tr('sur la période')}</small>
              </article>
              <article className="stat-card">
                <span>{tr('Contributions enregistrées')}</span>
                <strong>{report.entryCount.toString().padStart(2, '0')}</strong>
                <small>{tr('pauses exclues')}</small>
              </article>
            </div>
            {report.activeTimers > 0 && (
              <p className="notice">
                {report.activeTimers}{' '}
                {tr(
                  'chronomètre(s) encore actif(s). Leurs temps seront inclus après finalisation.',
                )}
              </p>
            )}
            <div className="two-column">
              <section className="panel padded">
                <div className="section-heading">
                  <h2>{tr('Le temps par projet')}</h2>
                  <Icon name="projects" />
                </div>
                <ProjectBreakdown report={report} />
              </section>
              <section className="panel padded">
                <div className="section-heading">
                  <h2>{administrator ? tr('L’équipe ce mois-ci') : tr('Ma contribution')}</h2>
                  <Icon name="team" />
                </div>
                <div className="member-totals">
                  {report.members.map((m) => (
                    <div key={m.id}>
                      <Avatar name={m.name} small />
                      <span>{m.name}</span>
                      <strong>{shortDuration(m.seconds)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            {!report.approvedOnly && (
              <section className="panel padded">
                <div className="section-heading">
                  <h2>{tr('Le travail effectué')}</h2>
                  <span className="quiet">{tr('Comptes rendus validés & notes partagées')}</span>
                </div>
                {!report.summaries.length && !report.notes.length ? (
                  <p className="quiet">
                    {tr(
                      'Les notes partagées et les comptes rendus validés apparaîtront ici. Les temps peuvent être exportés dès maintenant.',
                    )}
                  </p>
                ) : (
                  <div className="report-notes">
                    {report.summaries.map((s) => (
                      <article key={s.id}>
                        <span className="eyebrow">
                          {report.members.find((m) => m.id === s.memberId)?.name}{' '}
                          {tr('· COMPTE RENDU VALIDÉ')}
                        </span>
                        <p className="prose">{s.text}</p>
                      </article>
                    ))}
                    {report.notes.map((n) => (
                      <article key={n.id}>
                        <span className="quiet">
                          {n.workDate} · {report.members.find((m) => m.id === n.memberId)?.name}
                        </span>
                        <p className="prose">{n.text}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
            <section className="panel">
              <div className="section-heading padded-heading">
                <h2>{tr('Les temps du mois')}</h2>
                <span className="quiet">
                  {report.entryCount} {tr('entrée(s)')}
                </span>
              </div>
              {report.entries.length ? (
                <TimeTable
                  entries={report.entries.slice(0, 100)}
                  timezone={report.timezone}
                  withMember={administrator}
                />
              ) : (
                <Empty
                  title={tr('Le mois est encore ouvert')}
                  detail={tr('Les temps finalisés apparaîtront dans ce rapport.')}
                />
              )}
              {report.entryCount > 100 && (
                <p className="micro padded">
                  {tr(
                    'Aperçu limité aux 100 premières entrées. Les exports contiennent l’ensemble de la sélection.',
                  )}
                </p>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
