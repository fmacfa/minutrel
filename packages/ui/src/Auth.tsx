// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { useState, type FormEvent } from 'react';
import type { Session } from '@minutrel/contracts';
import { Field, Icon, Logo, formData, val } from './components.tsx';
import { configureServer, native, remoteRequest, request, type Connection } from './transport.ts';
import { startPersonal } from './local.ts';
import { LanguagePicker } from './LanguagePicker.tsx';

export function Auth({
  setup,
  error,
  connection,
  reload,
  signedIn,
}: {
  setup: boolean;
  error: string;
  connection: Connection;
  reload: () => Promise<void>;
  signedIn: (session: Session) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [verified, setVerified] = useState(false);
  const [server, setServer] = useState(connection.serverUrl);
  const serverChanged = native && server.trim().replace(/\/$/, '') !== connection.serverUrl;
  const creating = setup && !serverChanged && !error;
  const showProblem = (reason: unknown) =>
    setProblem(reason instanceof Error ? reason.message : tr(String(reason)));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    const f = formData(event);
    if (busy) return;
    setBusy(true);
    setProblem('');
    try {
      const team = native ? await configureServer(server) : undefined;
      if (team) {
        setServer(team.selected.serverUrl);
        if (team.selected.authenticated || team.required !== creating) {
          await reload();
          return;
        }
      }
      const data = {
        email: val(f, 'email'),
        password: val(f, 'password'),
        native,
        ...(creating
          ? {
              name: val(f, 'name'),
              workspaceName: val(f, 'workspace'),
              timezone: val(f, 'timezone'),
              setupToken: val(f, 'setupToken'),
            }
          : {}),
      };
      const route = creating ? '/setup' : '/auth/login';
      const session = team
        ? await remoteRequest<Session>(route, 'POST', data, undefined, team.selected.generation)
        : await request<Session>(route, 'POST', data);
      if (native) await reload();
      else signedIn(session);
    } catch (e) {
      showProblem(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Logo />
        <div>
          <span className="eyebrow">{tr('LE TEMPS DE VOS PROJETS, ENSEMBLE.')}</span>
          <h1>
            {tr('Faites de la place')}
            <br />
            {tr('au travail')}
            <br />
            <span>{tr('qui compte.')}</span>
          </h1>
          <p>
            {tr('Un suivi du temps simple. Des projets partagés.')}
            <br />
            {tr('Et une équipe qui avance au même rythme.')}
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="art-orbit" />
            <div className="art-clock">
              01<span>:</span>28<span>:</span>42
            </div>
            <div className="art-label">
              <span className="status-dot" />
              {tr('Chaque minute trouve sa place')}
            </div>
          </div>
        </div>
        <div className="auth-footer">
          <span>{tr('Libre & autohébergé')}</span>
          <span>V0.1</span>
        </div>
      </aside>
      <main className="auth-main">
        <LanguagePicker />
        <div className="auth-card">
          <span className="mobile-logo">
            <Logo />
          </span>
          <span className="eyebrow">{tr('VOTRE ESPACE MINUTREL')}</span>
          <h2>{creating ? tr('Bienvenue chez vous.') : tr('Bon retour.')}</h2>
          <p className="quiet">
            {creating
              ? tr('Créez votre espace et son premier compte administrateur.')
              : tr('Retrouvez vos projets et reprenez le fil de votre journée.')}
          </p>
          {native && (
            <div className="connection-form">
              <p>{tr('Sans serveur ni compte en ligne')}</p>
              <button
                className="button secondary full"
                disabled={busy}
                onClick={() => void startPersonal().then(reload).catch(showProblem)}
              >
                {tr('Utiliser sur cet ordinateur')}
              </button>
            </div>
          )}
          {native && (
            <form
              className="connection-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                setProblem('');
                setVerified(false);
                try {
                  const { selected } = await configureServer(server);
                  setServer(selected.serverUrl);
                  await reload();
                  setVerified(true);
                } catch (err) {
                  showProblem(err);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label={tr('Serveur de votre équipe')}>
                <div className="input-action">
                  <input
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={server}
                    onChange={(e) => {
                      setServer(e.target.value);
                      setProblem('');
                      setVerified(false);
                    }}
                    placeholder="https://temps.votre-equipe.fr"
                    required
                    disabled={busy}
                  />
                  <button className="button secondary" type="submit" disabled={busy}>
                    {tr('Vérifier')}
                  </button>
                </div>
              </Field>
              <small className="quiet">
                {tr(
                  'Collez l’adresse que vous utilisez pour accéder à votre espace d’équipe dans le navigateur.',
                )}
              </small>
              {verified && !error && <p role="status">{tr('Serveur d’équipe vérifié.')}</p>}
              {!connection.persistent && (
                <small className="quiet">
                  {tr(
                    'Le trousseau de cet ordinateur est indisponible. La connexion restera limitée à cette session.',
                  )}
                </small>
              )}
            </form>
          )}
          {(problem || (error && !serverChanged)) && (
            <div className="notice error" role="alert">
              <p>{problem || error}</p>
              {!native && error && (
                <button className="button secondary" type="button" onClick={() => void reload()}>
                  {tr('Réessayer')}
                </button>
              )}
            </div>
          )}
          {(native || !error) && (
            <form onSubmit={(e) => void submit(e)} className="stack-form">
              <fieldset disabled={busy}>
                {creating && (
                  <>
                    <Field label={tr('Nom de l’espace')}>
                      <input
                        name="workspace"
                        autoComplete="organization"
                        required
                        maxLength={200}
                        placeholder={tr('Atelier, Studio, Équipe…')}
                      />
                    </Field>
                    <Field label={tr('Votre nom')}>
                      <input
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={200}
                        placeholder={tr('Prénom Nom')}
                      />
                    </Field>
                  </>
                )}
                <Field label={tr('Adresse e-mail')}>
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                    placeholder="vous@votre-equipe.fr"
                  />
                </Field>
                <Field
                  label={tr('Mot de passe')}
                  hint={creating ? tr('Au moins 12 caractères.') : undefined}
                >
                  <input
                    name="password"
                    type="password"
                    autoComplete={creating ? 'new-password' : 'current-password'}
                    required
                    minLength={creating ? 12 : undefined}
                    maxLength={256}
                  />
                </Field>
                {creating && (
                  <>
                    <Field
                      label={tr('Fuseau de l’équipe')}
                      hint={tr('Les rapports mensuels suivront ce fuseau.')}
                    >
                      <input name="timezone" required defaultValue="Europe/Paris" maxLength={100} />
                    </Field>
                    <Field
                      label={tr('Secret d’installation')}
                      hint={tr(
                        'Présent dans data/setup-token sur le serveur, ou défini par APP_SETUP_TOKEN.',
                      )}
                    >
                      <input
                        name="setupToken"
                        type="password"
                        autoComplete="off"
                        required
                        maxLength={256}
                      />
                    </Field>
                  </>
                )}
                <button className="button primary full" type="submit">
                  {busy
                    ? 'Connexion…'
                    : creating
                      ? tr('Créer mon espace')
                      : tr('Entrer dans mon espace')}
                  <Icon name="arrow" />
                </button>
              </fieldset>
            </form>
          )}
          {!creating && (
            <p className="auth-help">
              {tr('Besoin d’un accès ou d’un nouveau mot de passe ?')}
              <br />
              {tr('Contactez l’administrateur de votre équipe.')}
            </p>
          )}
          <p className="micro">{tr('Vos données restent sur le serveur de votre équipe.')}</p>
        </div>
        <div className="auth-bottom">{tr('Minutrel · Logiciel libre AGPL-3.0-or-later')}</div>
      </main>
    </div>
  );
}
