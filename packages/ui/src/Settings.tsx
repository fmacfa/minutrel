// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr, locale } from './i18n.ts';
import { useEffect, useState } from 'react';
import type { Session } from '@minutrel/contracts';
import { Badge, Field, Icon, formData, val, type Actions } from './components.tsx';
import { download, native, request } from './transport.ts';
import { roleNames } from './Team.tsx';
import { syncStatus } from './local.ts';
import { LocalSettings } from './LocalSettings.tsx';
import type { Project } from '@minutrel/contracts';

interface Audit {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: number;
  detail: string;
}
const actionNames: Record<string, string> = {
  'workspace.setup': tr('Création de l’espace'),
  'workspace.update': tr('Modification de l’espace'),
  'member.create': tr('Création d’un compte'),
  'member.update': tr('Modification des droits'),
  'member.password': tr('Changement du mot de passe'),
  'member.password_reset': tr('Réinitialisation du mot de passe'),
  'time.correct': tr('Correction d’un temps'),
  'time.description': tr('Correction d’une description'),
  'time.delete': tr('Suppression d’un temps'),
  'time.create': tr('Saisie manuelle'),
  'timer.start': tr('Démarrage du chronomètre'),
  'timer.pause': tr('Mise en pause'),
  'timer.resume': tr('Reprise du chronomètre'),
  'timer.stop': tr('Finalisation du temps'),
  'timer.admin_resolve': tr('Intervention administrateur'),
  'project.create': tr('Création d’un projet'),
  'project.update': tr('Modification d’un projet'),
  'report.export_create': tr('Préparation d’un rapport'),
  'report.download': tr('Téléchargement d’un rapport'),
  'mcp.token_create': tr('Création d’un accès assistant'),
  'mcp.token_revoke': tr('Révocation d’un accès assistant'),
  'provider.create': tr('Ajout d’un fournisseur IA'),
  'provider.update': tr('Configuration d’un fournisseur IA'),
  'summary.review': tr('Relecture d’un compte rendu'),
  'summary.generate': tr('Préparation d’un brouillon IA'),
  'workspace.import': tr('Import des données'),
};
export function Settings({
  session,
  serverUrl,
  persistent,
  actions,
  signedOut,
  revision,
  projects,
}: {
  session: Session;
  serverUrl: string;
  persistent: boolean;
  actions: Actions;
  signedOut: () => void;
  revision: number;
  projects: Project[];
}) {
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const local = syncStatus().local;
  useEffect(() => {
    if (session.member.role !== 'admin') return;
    let active = true;
    void request<Audit[]>('/audit')
      .then((items) => {
        if (active) setAudit(items);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [session.member.role, revision]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr('VOTRE ESPACE, VOS CHOIX')}</p>
          <h1>
            {tr('Les paramètres')}
            <span className="title-dot">.</span>
          </h1>
          <p className="quiet">{tr('L’essentiel pour garder un espace qui vous ressemble.')}</p>
        </div>
      </div>
      {native && <LocalSettings projects={projects} actions={actions} />}
      <div className="two-column">
        <section className="panel padded">
          <div className="section-heading">
            <h2>{tr('Votre compte')}</h2>
            <Badge tone="green">{roleNames[session.member.role]}</Badge>
          </div>
          <p>
            <strong>{session.member.name}</strong>
            <br />
            <span className="quiet">{session.member.email}</span>
          </p>
          <hr />
          {local ? (
            <p className="micro">
              {tr(
                'Cet espace personnel est protégé par votre session système. Il ne crée aucun compte en ligne.',
              )}
            </p>
          ) : (
            <>
              <h3>{tr('Changer le mot de passe')}</h3>
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  const f = formData(e);
                  if (
                    await actions.act(
                      () =>
                        request('/me/password', 'POST', {
                          currentPassword: val(f, 'currentPassword'),
                          password: val(f, 'password'),
                        }),
                      tr('Mot de passe changé. Reconnectez-vous.'),
                    )
                  )
                    signedOut();
                }}
              >
                <Field label={tr('Mot de passe actuel')}>
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={256}
                  />
                </Field>
                <Field label={tr('Nouveau mot de passe')}>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={256}
                  />
                </Field>
                <button className="button secondary" type="submit">
                  {tr('Changer mon mot de passe')}
                </button>
              </form>
            </>
          )}
        </section>
        <section className="panel padded">
          <div className="section-heading">
            <h2>{tr('Votre espace')}</h2>
            <Icon name="projects" />
          </div>
          {session.member.role === 'admin' ? (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                const f = formData(e);
                await actions.act(
                  () =>
                    request('/workspace', 'PATCH', {
                      name: val(f, 'name'),
                      timezone: val(f, 'timezone'),
                    }),
                  tr('Espace mis à jour.'),
                );
              }}
            >
              <Field label={tr('Nom de l’espace')}>
                <input
                  name="name"
                  defaultValue={session.workspace.name}
                  key={session.workspace.name}
                  required
                  maxLength={200}
                />
              </Field>
              <Field
                label={tr('Fuseau de l’équipe')}
                hint={tr(
                  'Le fuseau reste fixe après la première saisie pour préserver les rapports.',
                )}
              >
                <input
                  name="timezone"
                  defaultValue={session.workspace.timezone}
                  required
                  maxLength={100}
                />
              </Field>
              <button className="button secondary" type="submit">
                {tr('Enregistrer')}
              </button>
            </form>
          ) : (
            <p>
              {session.workspace.name}
              <br />
              <span className="quiet">
                {tr('Fuseau : ')}
                {session.workspace.timezone}
              </span>
            </p>
          )}
          <hr />
          <h3>{tr('Connexion au serveur')}</h3>
          <p className="server-address">
            {local ? tr('Stockage personnel sur cet ordinateur') : serverUrl}
          </p>
          {!local && (
            <p className="micro">
              {tr('Les versions web et ordinateur utilisent ce même espace et les mêmes données.')}
            </p>
          )}
          {native && !local && (
            <p className="micro">
              {persistent
                ? tr('Votre session est conservée dans le trousseau sécurisé de l’ordinateur.')
                : tr(
                    'Le trousseau est indisponible. Votre session reste en mémoire jusqu’à la fermeture.',
                  )}
            </p>
          )}
        </section>
      </div>
      {session.member.role === 'admin' && (
        <>
          {!local && (
            <section className="panel padded">
              <div className="section-heading">
                <div>
                  <h2>{tr('Emporter vos données')}</h2>
                  <p className="quiet">
                    {tr(
                      'Exportez les projets, les affectations, les temps finalisés et le travail partagé.',
                    )}
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    void actions.act(
                      () => download('/api/v1/workspace/export', 'minutrel-espace.json'),
                      tr('Export de l’espace téléchargé.'),
                    )
                  }
                >
                  <Icon name="download" />
                  {tr('Exporter en JSON')}
                </button>
              </div>
              <p className="micro">
                {tr(
                  'Les chronomètres doivent être finalisés avant cet export. Pour une sauvegarde complète du serveur, suivez la procédure fournie dans le dossier du projet.',
                )}
              </p>
            </section>
          )}
          <section className="panel">
            <div className="section-heading padded-heading">
              <h2>{tr('Journal de gestion')}</h2>
              <span className="quiet">{tr('Dernières opérations')}</span>
            </div>
            {error && <p className="notice error">{error}</p>}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{tr('Opération')}</th>
                    <th>{tr('Par')}</th>
                    <th>{tr('Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 30).map((item) => (
                    <tr key={item.id}>
                      <td>
                        {actionNames[item.action] ??
                          (item.action.startsWith('note.')
                            ? tr('Mise à jour d’une note')
                            : item.action.startsWith('task.')
                              ? tr('Gestion d’une sous-catégorie')
                              : tr('Mise à jour de l’espace'))}
                      </td>
                      <td>{item.actorName ?? tr('Système')}</td>
                      <td>{new Date(item.createdAt * 1000).toLocaleString(locale())}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
