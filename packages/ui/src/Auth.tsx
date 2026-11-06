// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { useState, type FormEvent } from 'react';
import type { Session } from '@minutrel/contracts';
import { Field, Icon, Logo, formData, val } from './components.tsx';
import { configureServer, native, request, type Connection } from './transport.ts';
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
  const [server, setServer] = useState(connection.serverUrl);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    const f = formData(event);
    if (busy) return;
    setBusy(true);
    setProblem('');
    try {
      const data = {
        email: val(f, 'email'),
        password: val(f, 'password'),
        native,
        ...(setup
          ? {
              name: val(f, 'name'),
              workspaceName: val(f, 'workspace'),
              timezone: val(f, 'timezone'),
              setupToken: val(f, 'setupToken'),
            }
          : {}),
      };
      signedIn(await request<Session>(setup ? '/setup' : '/auth/login', 'POST', data));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : tr('Connexion impossible.'));
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
          <h2>{setup ? tr('Bienvenue chez vous.') : tr('Bon retour.')}</h2>
          <p className="quiet">
            {setup
              ? tr('Créez votre espace et son premier compte administrateur.')
              : tr('Retrouvez vos projets et reprenez le fil de votre journée.')}
          </p>
          {native && (
            <div className="connection-form">
              <p>{tr('Sans serveur ni compte en ligne')}</p>
              <button
                className="button secondary full"
                onClick={() =>
                  void startPersonal()
                    .then(reload)
                    .catch((e) => setProblem(String(e)))
                }
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
                setBusy(true);
                try {
                  await configureServer(server);
                  await reload();
                } catch (err) {
                  setProblem(String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label={tr('Serveur de votre équipe')}>
                <div className="input-action">
                  <input
                    type="url"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    placeholder="https://temps.votre-equipe.fr"
                    required
                    disabled={busy}
                  />
                  <button
                    className="icon-button"
                    type="submit"
                    disabled={busy}
                    aria-label={tr('Se connecter à ce serveur')}
                  >
                    <Icon name="arrow" />
                  </button>
                </div>
              </Field>
              {!connection.persistent && (
                <small className="quiet">
                  {tr(
                    'Le trousseau de cet ordinateur est indisponible. La connexion restera limitée à cette session.',
                  )}
                </small>
              )}
            </form>
          )}
          {error ? (
            <div className="notice error" role="alert">
              <p>{error}</p>
              <button className="button secondary" type="button" onClick={() => void reload()}>
                {tr('Réessayer')}
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="stack-form">
              <fieldset disabled={busy}>
                {setup && (
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
                  hint={setup ? tr('Au moins 12 caractères.') : undefined}
                >
                  <input
                    name="password"
                    type="password"
                    autoComplete={setup ? 'new-password' : 'current-password'}
                    required
                    minLength={setup ? 12 : undefined}
                    maxLength={256}
                  />
                </Field>
                {setup && (
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
                {problem && (
                  <p className="notice error" role="alert">
                    {problem}
                  </p>
                )}
                <button className="button primary full" type="submit">
                  {busy
                    ? 'Connexion…'
                    : setup
                      ? tr('Créer mon espace')
                      : tr('Entrer dans mon espace')}
                  <Icon name="arrow" />
                </button>
              </fieldset>
            </form>
          )}
          {!setup && (
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
