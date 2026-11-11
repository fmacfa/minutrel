// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr, locale } from './i18n.ts';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import type {
  Member,
  MonthlyReport,
  Project,
  Provider,
  Session,
  TimeEntry,
  WorkNote,
  WorkSummary,
} from '@minutrel/contracts';
import {
  ApiError,
  connection,
  native,
  onSessionChange,
  request,
  setCsrf,
  showMain,
  subscribe,
  toggleWidget,
  type Connection,
} from './transport.ts';
import {
  Avatar,
  Dialog,
  Empty,
  Icon,
  Logo,
  WidgetFrame,
  shortDuration,
  type Actions,
  type IconName,
} from './components.tsx';
import { Auth } from './Auth.tsx';
import { TimerPanel, LiveCounter } from './Timer.tsx';
import { Projects } from './Projects.tsx';
import { Times, ManualForm, TimeTable, dateString } from './Times.tsx';
import { ProjectBreakdown, Reports } from './Reports.tsx';
import { Team, roleNames } from './Team.tsx';
import { Integrations } from './Integrations.tsx';
import { Work } from './Work.tsx';
import { Settings } from './Settings.tsx';
import { leavePersonal, syncStatus } from './local.ts';
import { LanguagePicker } from './LanguagePicker.tsx';
const Timesheets = lazy(() => import('./Timesheets.tsx').then((m) => ({ default: m.Timesheets })));

type Page =
  | 'dashboard'
  | 'times'
  | 'timesheets'
  | 'projects'
  | 'work'
  | 'reports'
  | 'team'
  | 'integrations'
  | 'settings';
const pages: { id: Page; name: string; icon: IconName }[] = [
  { id: 'dashboard', name: tr('Vue d’ensemble'), icon: 'clock' },
  { id: 'times', name: tr('Les temps'), icon: 'report' },
  { id: 'projects', name: tr('Les projets'), icon: 'projects' },
  { id: 'work', name: tr('Le fil du travail'), icon: 'edit' },
  { id: 'reports', name: tr('Les rapports'), icon: 'report' },
  { id: 'team', name: tr('L’équipe'), icon: 'team' },
  { id: 'integrations', name: tr('Les connexions'), icon: 'spark' },
  { id: 'settings', name: tr('Paramètres'), icon: 'settings' },
];
interface Data {
  projects: Project[];
  members: Member[];
  timer: TimeEntry | null;
  times: TimeEntry[];
  report: MonthlyReport | null;
  notes: WorkNote[];
  summaries: WorkSummary[];
  providers: Provider[];
}
const emptyData: Data = {
  projects: [],
  members: [],
  timer: null,
  times: [],
  report: null,
  notes: [],
  summaries: [],
  providers: [],
};

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [conn, setConn] = useState<Connection>({
    serverUrl: '',
    authenticated: false,
    persistent: true,
    widget: false,
  });
  const [setup, setSetup] = useState(false);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');
  const [data, setData] = useState<Data>(emptyData);
  const [page, setPage] = useState<Page>('dashboard');
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(true);
  const connectedRef = useRef(true);
  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState<{ title: string; content: ReactNode } | null>(null);
  const [pip, setPip] = useState<Window | null>(null);
  const [now, setNow] = useState(Date.now() / 1000);
  const serverOffset = useRef(0);
  const busy = useRef(false);
  const generation = useRef(0);
  const refreshing = useRef(false);
  const reloadNeeded = useRef(false);
  const scheduled = useRef<ReturnType<typeof setTimeout> | null>(null);
  const month = dateString(now, session?.workspace.timezone ?? 'Europe/Paris').slice(0, 7);
  const signedOut = useCallback(() => {
    generation.current++;
    setSession(null);
    setData(emptyData);
    setCsrf('');
    setModal(null);
    setNotice(null);
    setPage('dashboard');
    if (native) void invoke('clear_session');
  }, []);
  const signedIn = (s: Session) => {
    generation.current++;
    setCsrf(s.csrf);
    setSession(s);
    serverOffset.current = s.serverNow - Date.now() / 1000;
    setConnected(true);
    setBootError('');
  };
  const boot = useCallback(async () => {
    setBootError('');
    setReady(false);
    try {
      const c = await connection();
      setConn(c);
      const initial = await request<{ required: boolean }>('/setup');
      setSetup(initial.required);
      if (!initial.required) {
        try {
          const s = await request<Session>('/me');
          signedIn(s);
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401)) throw e;
          setSession(null);
          setData(emptyData);
          setCsrf('');
        }
      }
    } catch (e) {
      setBootError(
        e instanceof Error ? e.message : tr('Le serveur est indisponible. Vérifiez son adresse.'),
      );
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, session?.member.id]);
  useEffect(() => {
    if (!native) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    void onSessionChange(() => {
      if (active) void boot();
    }).then((stop) => {
      if (active) cleanup = stop;
      else stop();
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [boot]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      if (timer) clearInterval(timer);
      setNow(Date.now() / 1000 + serverOffset.current);
      if (document.visibilityState === 'visible')
        timer = setInterval(() => setNow(Date.now() / 1000 + serverOffset.current), 60000);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const refresh: () => Promise<void> = useCallback(async () => {
    if (!session) return;
    if (refreshing.current) {
      reloadNeeded.current = true;
      return;
    }
    refreshing.current = true;
    const stamp = generation.current;
    try {
      const s = await request<Session>('/me');
      if (conn.widget) {
        const [projects, timerResult] = await Promise.all([
          request<Project[]>('/projects'),
          request<{ timer: TimeEntry | null; serverNow: number }>('/timer'),
        ]);
        if (stamp !== generation.current) return;
        setSession(s);
        setCsrf(s.csrf);
        serverOffset.current = timerResult.serverNow - Date.now() / 1000;
        setNow(timerResult.serverNow);
        setData({ ...emptyData, projects, timer: timerResult.timer });
        setConnected(!native || !syncStatus().offline);
        return;
      }
      const [projects, members, timerResult, times, report, notes, summaries, providers] =
        await Promise.all([
          request<Project[]>('/projects'),
          s.member.role === 'contributor'
            ? Promise.resolve([s.member])
            : request<Member[]>('/members'),
          request<{ timer: TimeEntry | null; serverNow: number }>('/timer'),
          request<{ items: TimeEntry[] }>(`/time-entries?memberId=me&month=${month}`),
          request<MonthlyReport>(`/reports/monthly?month=${month}&memberIds=${s.member.id}`),
          request<WorkNote[]>('/notes'),
          request<WorkSummary[]>('/summaries'),
          request<Provider[]>('/providers'),
        ]);
      if (stamp !== generation.current) return;
      setSession(s);
      setCsrf(s.csrf);
      serverOffset.current = timerResult.serverNow - Date.now() / 1000;
      setNow(timerResult.serverNow);
      setData({
        projects,
        members,
        timer: timerResult.timer,
        times: times.items,
        report,
        notes,
        summaries,
        providers,
      });
      setConnected(!native || !syncStatus().offline);
      setRevision((v) => v + 1);
    } catch (e) {
      if (stamp !== generation.current) return;
      if (e instanceof ApiError && e.status === 401) {
        signedOut();
        setNotice({ text: tr('Votre session a expiré. Reconnectez-vous.'), error: true });
      } else {
        setConnected(false);
        setNotice({
          text: e instanceof Error ? e.message : tr('Le serveur est indisponible.'),
          error: true,
        });
      }
    } finally {
      refreshing.current = false;
      if (reloadNeeded.current && stamp === generation.current) {
        reloadNeeded.current = false;
        if (scheduled.current) clearTimeout(scheduled.current);
        scheduled.current = setTimeout(() => {
          void refresh();
        }, 100);
      }
    }
  }, [session?.member.id, month, signedOut, conn.widget]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    let stop: (() => void) | undefined;
    void refresh();
    const schedule = () => {
      if (scheduled.current) clearTimeout(scheduled.current);
      scheduled.current = setTimeout(() => {
        if (active) void refresh();
      }, 180);
    };
    void subscribe(schedule, (online) => {
      if (active) {
        setConnected(online);
        if (!online) schedule();
      }
    })
      .then((cleanup) => {
        if (active) stop = cleanup;
        else cleanup();
      })
      .catch(() => {
        if (active) setConnected(false);
      });
    return () => {
      active = false;
      stop?.();
      if (scheduled.current) clearTimeout(scheduled.current);
    };
  }, [session?.member.id, refresh]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const t = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  const act: Actions['act'] = async (operation, success, background = false) => {
    if (!background && busy.current) return false;
    if (!connectedRef.current && !native) {
      setNotice({
        text: tr('La connexion est interrompue. Actualisez avant de modifier vos données.'),
        error: true,
      });
      return false;
    }
    if (!background) {
      busy.current = true;
      setPending(true);
    }
    setNotice(null);
    try {
      const stamp = generation.current;
      await operation();
      if (stamp === generation.current) await refresh();
      if (success) setNotice({ text: success, error: false });
      return true;
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : String(e), error: true });
      if (e instanceof ApiError && e.status === 409) await refresh();
      return false;
    } finally {
      if (!background) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const actions: Actions = {
    act,
    pending,
    refresh,
    open: (title, content) => {
      setNotice(null);
      setModal({ title, content });
    },
    close: () => setModal(null),
  };
  const logout = async () => {
    if (conn.local) {
      await leavePersonal();
      await boot();
      return;
    }
    await act(async () => {
      await request('/auth/logout', 'POST', {});
      signedOut();
    });
  };
  const openWidget = async () => {
    if (native) {
      try {
        await toggleWidget();
      } catch (error) {
        setNotice({ text: String(error), error: true });
      }
      return;
    }
    const api = (
      window as unknown as {
        documentPictureInPicture?: {
          requestWindow: (options: { width: number; height: number }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture;
    if (!api) return;
    try {
      if (pip && !pip.closed) {
        pip.focus();
        return;
      }
      const child = await api.requestWindow({ width: 380, height: 320 });
      child.document.title = tr('Minutrel — Chronomètre');
      document.querySelectorAll('link[rel="stylesheet"],style').forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        if (clone instanceof HTMLLinkElement) clone.href = (node as HTMLLinkElement).href;
        child.document.head.appendChild(clone);
      });
      child.document.documentElement.lang = locale().slice(0, 2);
      child.addEventListener('pagehide', () => setPip(null), { once: true });
      setPip(child);
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message : tr('La fenêtre compacte n’a pas pu être ouverte.'),
        error: true,
      });
    }
  };
  const supportsWidget = native || 'documentPictureInPicture' in window;
  const notification = notice && (
    <div
      className={`notice ${notice.error ? 'error' : 'success'}`}
      role={notice.error ? 'alert' : 'status'}
    >
      <span>{tr(notice.text)}</span>
      <button
        className="icon-button"
        aria-label={tr('Fermer la notification')}
        onClick={() => setNotice(null)}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
  if (!ready)
    return (
      <div className="boot">
        <Logo />
        <p>{tr('Ouverture de votre espace…')}</p>
      </div>
    );
  if (!session) {
    if (conn.widget)
      return (
        <WidgetFrame>
          <Logo />
          <p>{tr('Ouvrez Minutrel pour vous connecter au serveur de votre équipe.')}</p>
          <button className="button primary" onClick={() => void showMain()}>
            {tr('Ouvrir Minutrel')}
          </button>
        </WidgetFrame>
      );
    return (
      <>
        {notification}
        <Auth setup={setup} error={bootError} connection={conn} reload={boot} signedIn={signedIn} />
      </>
    );
  }
  if (conn.widget)
    return (
      <WidgetFrame>
        <div className="widget-toolbar" data-tauri-drag-region>
          <button className="text-button" onClick={() => void showMain()}>
            <Logo compact />
            Minutrel
          </button>
          <button
            className="icon-button"
            aria-label={tr('Masquer le widget')}
            onClick={() => void toggleWidget()}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        {!connected && (
          <p className="micro error-text">
            {native
              ? tr('Hors connexion · temps conservé sur cet ordinateur.')
              : tr('Connexion interrompue · le temps continue sur le serveur.')}
          </p>
        )}
        {notification}
        <TimerPanel
          projects={data.projects}
          timer={data.timer}
          offset={serverOffset.current}
          actions={actions}
          compact
          offline={!connected && !native}
        />
      </WidgetFrame>
    );
  const localStatus = syncStatus();
  const shownPages = pages.filter(
    (p) =>
      (p.id !== 'team' || session.member.role !== 'contributor') &&
      (!conn.local || !['team', 'integrations'].includes(p.id)),
  );
  const currentPage =
    (page === 'timesheets' && !conn.local) || shownPages.some((p) => p.id === page)
      ? page
      : 'dashboard';
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        {tr('Aller au contenu')}
      </a>
      <aside className="sidebar">
        <Logo />
        <div className="workspace-label">
          <span className="workspace-initial">{session.workspace.name[0]?.toUpperCase()}</span>
          <span>
            {session.workspace.name}
            <small>{conn.local ? tr('Sur cet ordinateur') : tr('Votre espace d’équipe')}</small>
          </span>
        </div>
        <nav aria-label={tr('Navigation principale')}>
          {shownPages.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${currentPage === p.id ? 'active' : ''} ${p.id === 'settings' ? 'nav-settings' : ''}`}
              onClick={() => setPage(p.id)}
              aria-current={currentPage === p.id ? 'page' : undefined}
            >
              <Icon name={p.icon} size={20} />
              {p.name}
              {p.id === 'work' && data.summaries.some((s) => s.status === 'draft') && (
                <span className="nav-indicator" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-status">
            <span className={`status-dot ${connected ? '' : 'offline'}`} />
            <span>
              {conn.local
                ? tr('Espace local')
                : localStatus.conflict
                  ? tr('Conflit à résoudre')
                  : localStatus.pending
                    ? tr('En attente d’envoi')
                    : connected
                      ? tr('Espace synchronisé')
                      : tr('Hors connexion')}
            </span>
            <small>V0.1</small>
          </div>
          <button className="account-button" onClick={() => setPage('settings')}>
            <Avatar name={session.member.name} />
            <span>
              <strong>{session.member.name}</strong>
              <small>{roleNames[session.member.role]}</small>
            </span>
            <Icon name="settings" size={17} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <span className="breadcrumb">
            {tr('Mon espace ')}
            <span>/</span>{' '}
            <strong>
              {currentPage === 'timesheets'
                ? tr('Feuilles de temps')
                : pages.find((p) => p.id === currentPage)?.name}
            </strong>
          </span>
          <div className="topbar-actions">
            <LanguagePicker />
            {pending && <span className="micro">{tr('Enregistrement…')}</span>}
            {supportsWidget && (
              <button
                className="button quiet-button"
                aria-label={tr('Mini chrono')}
                onClick={() => void openWidget()}
              >
                <Icon name="widget" size={18} />
                <span>{tr('Mini chrono')}</span>
              </button>
            )}
            <button
              className="icon-button"
              aria-label={tr('Se déconnecter')}
              onClick={() => {
                if (conn.local) {
                  void logout();
                  return;
                }
                if (data.timer)
                  actions.open(
                    tr('Se déconnecter'),
                    <div className="stack-form">
                      <p>
                        {tr(
                          'Votre chronomètre continuera sur le serveur après déconnexion. Vous pourrez le retrouver depuis un autre appareil.',
                        )}
                      </p>
                      <div className="form-footer">
                        <button className="button secondary" onClick={actions.close}>
                          {tr('Rester connecté')}
                        </button>
                        <button className="button primary" onClick={() => void logout()}>
                          {tr('Continuer et me déconnecter')}
                        </button>
                      </div>
                    </div>,
                  );
                else void logout();
              }}
            >
              <Icon name="logout" size={19} />
            </button>
          </div>
        </header>
        <main id="main" className="page-content" tabIndex={-1}>
          {notification}
          {native && !conn.local && (localStatus.pending > 0 || localStatus.conflict) && (
            <div className="notice" role="status">
              <span>
                {localStatus.conflict
                  ? tr('Synchronisation à résoudre. Vos temps locaux sont conservés.')
                  : tr('{0} temps en attente d’envoi.', localStatus.pending)}
              </span>
              <button className="button secondary" onClick={() => setPage('settings')}>
                {tr('Voir la synchronisation')}
              </button>
            </div>
          )}
          {!connected && (
            <div className="notice error">
              <span>
                {native
                  ? tr(
                      'Hors connexion. Vos actions de chronomètre sont conservées sur cet ordinateur. Les vues utilisent votre cache personnel ; le rapport d’équipe nécessite le serveur.',
                    )
                  : tr(
                      'Connexion interrompue. Vos temps déjà enregistrés sont conservés ; le chronomètre continue sur le serveur.',
                    )}
              </span>
              <button className="button secondary" onClick={() => void refresh()}>
                {tr('Actualiser')}
              </button>
            </div>
          )}
          {currentPage === 'dashboard' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {tr('BONJOUR, ')}
                    {session.member.name.split(' ')[0]?.toLocaleUpperCase('fr')}
                  </p>
                  <h1>
                    {tr('Gardez le fil')}
                    <span className="title-dot">.</span>
                  </h1>
                  <p className="quiet">
                    {tr('Un projet à la fois. Chaque minute au bon endroit.')}
                  </p>
                </div>
                <div className="date-display">
                  <span>
                    {new Intl.DateTimeFormat(locale(), {
                      weekday: 'long',
                      timeZone: session.workspace.timezone,
                    }).format(new Date(now * 1000))}
                  </span>
                  <strong>
                    {new Intl.DateTimeFormat(locale(), {
                      day: 'numeric',
                      month: 'long',
                      timeZone: session.workspace.timezone,
                    }).format(new Date(now * 1000))}
                  </strong>
                </div>
              </div>
              <TimerPanel
                projects={data.projects}
                timer={data.timer}
                offset={serverOffset.current}
                actions={actions}
                offline={!connected && !native}
                revision={revision}
              />
              <div className="section-heading month-heading">
                <h2>{tr('Votre mois, en un regard')}</h2>
                <span className="quiet">
                  {month} · {session.workspace.timezone}
                </span>
              </div>
              <div className="stats-grid">
                <article className="stat-card">
                  <div>
                    <span>{tr('Temps enregistré')}</span>
                    <Icon name="clock" />
                  </div>
                  <strong>{shortDuration(data.report?.totalSeconds ?? 0)}</strong>
                  <small>{tr('vos temps finalisés ce mois-ci')}</small>
                </article>
                <article className="stat-card">
                  <div>
                    <span>{tr('Projets accompagnés')}</span>
                    <Icon name="projects" />
                  </div>
                  <strong>{String(data.report?.projects.length ?? 0).padStart(2, '0')}</strong>
                  <small>{tr('où vous avez contribué')}</small>
                </article>
                <article className="stat-card">
                  <div>
                    <span>{tr('Sessions de travail')}</span>
                    <Icon name="check" />
                  </div>
                  <strong>{String(data.report?.entryCount ?? 0).padStart(2, '0')}</strong>
                  <small>{tr('chaque contribution compte')}</small>
                </article>
              </div>
              <div className="two-column dashboard-lower">
                <section className="panel padded">
                  <div className="section-heading">
                    <h2>{tr('Le temps par projet')}</h2>
                    <button className="text-button" onClick={() => setPage('reports')}>
                      {tr('Voir le rapport')}
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  {data.report && <ProjectBreakdown report={data.report} />}
                </section>
                <section className="work-prompt">
                  <span className="prompt-icon">
                    <Icon name="edit" size={23} />
                  </span>
                  <div>
                    <span className="eyebrow">{tr('LE FIL DU TRAVAIL')}</span>
                    <h2>
                      {tr('Donnez du sens')} <br />
                      {tr('à vos minutes.')}
                    </h2>
                    <p>
                      {tr(
                        'Une avancée, un livrable, une idée à garder. Notez l’essentiel pour préparer votre compte rendu.',
                      )}
                    </p>
                    <button className="text-button" onClick={() => setPage('work')}>
                      {tr('Ouvrir mes notes')}
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="section-heading padded-heading">
                  <h2>{tr('Vos derniers temps')}</h2>
                  <button
                    className="text-button"
                    disabled={!data.projects.some((p) => !p.archived)}
                    onClick={() =>
                      actions.open(
                        tr('Ajouter un temps'),
                        <ManualForm projects={data.projects} session={session} actions={actions} />,
                      )
                    }
                  >
                    <Icon name="plus" size={17} />
                    {tr('Ajouter un temps')}
                  </button>
                </div>
                {data.times.filter((t) => t.state === 'finished').length ? (
                  <TimeTable
                    entries={data.times.filter((t) => t.state === 'finished').slice(0, 6)}
                    timezone={session.workspace.timezone}
                  />
                ) : (
                  <Empty
                    title={tr('Votre première minute vous attend')}
                    detail={
                      data.projects.length
                        ? tr('Choisissez un projet ci-dessus et démarrez votre chronomètre.')
                        : session.member.role === 'contributor'
                          ? tr('Votre responsable vous affectera vos projets.')
                          : tr('Créez votre premier projet pour commencer.')
                    }
                    action={
                      session.member.role !== 'contributor' && !data.projects.length ? (
                        <button className="button secondary" onClick={() => setPage('projects')}>
                          {tr('Créer un projet')}
                          <Icon name="arrow" size={16} />
                        </button>
                      ) : undefined
                    }
                  />
                )}
              </section>
            </>
          )}
          {currentPage === 'times' && (
            <Times
              session={session}
              projects={data.projects}
              members={data.members}
              actions={actions}
              revision={revision}
              initialMonth={month}
              openTimesheets={conn.local ? undefined : () => setPage('timesheets')}
            />
          )}
          {currentPage === 'timesheets' && (
            <Suspense fallback={<p className="loading">{tr('Chargement…')}</p>}>
              <Timesheets
                session={session}
                actions={actions}
                revision={revision}
                goBack={() => setPage('times')}
              />
            </Suspense>
          )}
          {currentPage === 'projects' && (
            <Projects
              session={session}
              projects={data.projects}
              members={data.members}
              actions={actions}
              totals={data.report?.projects ?? []}
              initialMonth={month}
              revision={revision}
              local={Boolean(conn.local)}
            />
          )}
          {currentPage === 'work' && (
            <Work
              session={session}
              notes={data.notes}
              summaries={data.summaries}
              projects={data.projects}
              providers={data.providers}
              actions={actions}
              initialMonth={month}
            />
          )}
          {currentPage === 'reports' && (
            <Reports
              session={session}
              members={data.members}
              initialMonth={month}
              revision={revision}
              actions={actions}
              local={Boolean(conn.local)}
            />
          )}
          {currentPage === 'team' && (
            <Team session={session} members={data.members} actions={actions} />
          )}
          {currentPage === 'integrations' && (
            <Integrations
              session={session}
              providers={data.providers}
              revision={revision}
              serverUrl={conn.serverUrl}
              actions={actions}
            />
          )}
          {currentPage === 'settings' && (
            <Settings
              session={session}
              serverUrl={conn.serverUrl}
              persistent={conn.persistent}
              actions={actions}
              signedOut={signedOut}
              revision={revision}
              projects={data.projects}
            />
          )}
          <footer className="page-footer">
            <span>{tr('Le temps de vos projets, ensemble.')}</span>
            <span>{tr('Minutrel · V0.1 · Logiciel libre')}</span>
          </footer>
        </main>
        {data.timer && currentPage !== 'dashboard' && (
          <div className="persistent-timer">
            <button className="persistent-timer-title" onClick={() => setPage('dashboard')}>
              <span className={`status-dot ${data.timer.state === 'running' ? 'pulse' : ''}`} />
              <span>
                {data.timer.projectName}
                <small>{data.timer.state === 'paused' ? tr('En pause') : tr('En cours')}</small>
              </span>
            </button>
            <strong>
              <LiveCounter timer={data.timer} offset={serverOffset.current} />
            </strong>
            <button
              className="icon-button"
              aria-label={data.timer.state === 'paused' ? tr('Reprendre') : tr('Mettre en pause')}
              disabled={pending || !connected}
              onClick={() =>
                void act(() =>
                  request(`/timer/${data.timer!.state === 'paused' ? 'resume' : 'pause'}`, 'POST', {
                    version: data.timer!.version,
                  }),
                )
              }
            >
              <Icon name={data.timer.state === 'paused' ? 'play' : 'pause'} />
            </button>
            <button
              className="button primary"
              disabled={pending || !connected}
              onClick={() =>
                void act(
                  () => request('/timer/stop', 'POST', { version: data.timer!.version }),
                  tr('Temps enregistré.'),
                )
              }
            >
              <Icon name="stop" size={16} />
              {tr('Terminer')}
            </button>
          </div>
        )}
      </div>
      {modal && (
        <Dialog title={modal.title} close={actions.close}>
          {notice?.error && notification}
          {modal.content}
        </Dialog>
      )}
      {pip &&
        !pip.closed &&
        createPortal(
          <main className="widget-shell">
            <Logo />
            {!connected && <p className="micro error-text">{tr('Connexion interrompue')}</p>}
            <TimerPanel
              projects={data.projects}
              timer={data.timer}
              offset={serverOffset.current}
              actions={actions}
              compact
              offline={!connected}
            />
          </main>,
          pip.document.body,
        )}
    </div>
  );
}
