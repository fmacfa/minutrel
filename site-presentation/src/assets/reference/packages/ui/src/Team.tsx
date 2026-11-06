// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import type { Member, Session, TimeEntry } from '@minutrel/contracts';
import { Avatar, Badge, Field, Icon, formData, val, type Actions } from './components.tsx';
import { request } from './transport.ts';

export const roleNames = {
  admin: tr('Administrateur'),
  manager: tr('Responsable'),
  contributor: tr('Contributeur'),
};
function MemberForm({ member, actions }: { member?: Member; actions: Actions }) {
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        const f = formData(e);
        const ok = await actions.act(
          () =>
            request(member ? `/members/${member.id}` : '/members', member ? 'PATCH' : 'POST', {
              name: val(f, 'name'),
              email: val(f, 'email'),
              role: val(f, 'role'),
              ...(member ? { enabled: f.has('enabled') } : { password: val(f, 'password') }),
            }),
          member ? tr('Membre mis à jour.') : tr('Compte créé.'),
        );
        if (ok) actions.close();
      }}
    >
      <Field label={tr('Nom')}>
        <input name="name" defaultValue={member?.name} autoFocus required maxLength={200} />
      </Field>
      <Field label={tr('Adresse e-mail')}>
        <input
          name="email"
          type="email"
          defaultValue={member?.email}
          autoComplete="off"
          required
          maxLength={254}
        />
      </Field>
      <Field label={tr('Rôle')}>
        <select name="role" defaultValue={member?.role ?? 'contributor'}>
          {Object.entries(roleNames).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <p className="micro">
        {tr(
          'Le contributeur suit ses temps. Le responsable gère les projets et les temps de l’équipe. L’administrateur gère aussi les accès, les intégrations et les exports mensuels.',
        )}
      </p>
      {member ? (
        <label className="check-row">
          <input type="checkbox" name="enabled" defaultChecked={member.enabled} />
          {tr('Compte actif')}
        </label>
      ) : (
        <Field
          label={tr('Mot de passe initial')}
          hint={tr(
            'Au moins 12 caractères. Transmettez-le au membre qui pourra le changer dans ses paramètres.',
          )}
        >
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            required
          />
        </Field>
      )}
      <div className="form-footer">
        <button type="button" className="button secondary" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit">
          {tr('Enregistrer')}
        </button>
      </div>
    </form>
  );
}
function PasswordForm({ member, actions }: { member: Member; actions: Actions }) {
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        const f = formData(e);
        if (
          await actions.act(
            () =>
              request(`/members/${member.id}/password`, 'POST', { password: val(f, 'password') }),
            tr('Mot de passe remplacé. Les connexions précédentes sont révoquées.'),
          )
        )
          actions.close();
      }}
    >
      <p>
        {tr('Définir un nouveau mot de passe pour ')}
        <strong>{member.name}</strong>.
      </p>
      <Field label={tr('Nouveau mot de passe')}>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
          autoFocus
        />
      </Field>
      <div className="form-footer">
        <button className="button secondary" type="button" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit">
          {tr('Remplacer le mot de passe')}
        </button>
      </div>
    </form>
  );
}
function ResolveTimer({
  member,
  timer,
  actions,
}: {
  member: Member;
  timer: TimeEntry;
  actions: Actions;
}) {
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        const f = formData(e);
        if (
          await actions.act(
            () =>
              request(`/members/${member.id}/timer/stop`, 'POST', {
                version: timer.version,
                reason: val(f, 'reason'),
              }),
            tr('Chronomètre finalisé au nom de l’administrateur.'),
          )
        )
          actions.close();
      }}
    >
      <p>
        {tr('Arrêter le chronomètre de ')}
        <strong>{member.name}</strong> {tr('sur « ')}
        {timer.projectName}{' '}
        {tr(
          '» à l’heure actuelle ? Le temps sera enregistré et cette intervention sera consignée.',
        )}
      </p>
      <Field label={tr('Motif de l’intervention')}>
        <input name="reason" required minLength={5} maxLength={2000} autoFocus />
      </Field>
      <div className="form-footer">
        <button className="button secondary" type="button" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit">
          {tr('Finaliser ce chronomètre')}
        </button>
      </div>
    </form>
  );
}
export function Team({
  session,
  members,
  actions,
}: {
  session: Session;
  members: Member[];
  actions: Actions;
}) {
  const admin = session.member.role === 'admin';
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr('LE TEMPS SE PARTAGE')}</p>
          <h1>
            {tr('Votre équipe')}
            <span className="title-dot">.</span>
          </h1>
          <p className="quiet">{tr('Des rôles clairs, un espace commun.')}</p>
        </div>
        {admin && (
          <button
            className="button primary"
            onClick={() => actions.open(tr('Ajouter un membre'), <MemberForm actions={actions} />)}
          >
            <Icon name="plus" />
            {tr('Ajouter un membre')}
          </button>
        )}
      </div>
      <section className="panel">
        <div className="section-heading padded-heading">
          <h2>
            {members.filter((m) => m.enabled).length} {tr('membre(s) actif(s)')}
          </h2>
          <span className="quiet">{session.workspace.name}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr('Membre')}</th>
                <th>{tr('Rôle')}</th>
                <th>{tr('Accès')}</th>
                {admin && <th>{tr('Gestion')}</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={m.name} />
                      <div>
                        <strong>
                          {m.name}
                          {m.id === session.member.id && (
                            <span className="quiet"> {tr('· vous')}</span>
                          )}
                        </strong>
                        <small className="cell-secondary">{m.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{roleNames[m.role]}</td>
                  <td>
                    <Badge tone={m.enabled ? 'green' : ''}>
                      {m.enabled ? tr('Actif') : tr('Désactivé')}
                    </Badge>
                  </td>
                  {admin && (
                    <td>
                      <div className="button-group">
                        <button
                          className="text-button"
                          onClick={() =>
                            actions.open(
                              tr('Gérer le membre'),
                              <MemberForm member={m} actions={actions} />,
                            )
                          }
                        >
                          {tr('Modifier')}
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            actions.open(
                              tr('Réinitialiser l’accès'),
                              <PasswordForm member={m} actions={actions} />,
                            )
                          }
                        >
                          {tr('Mot de passe')}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={tr('Résoudre le chronomètre de {0}', m.name)}
                          onClick={async () => {
                            await actions.act(async () => {
                              const { timer } = await request<{ timer: TimeEntry | null }>(
                                `/members/${m.id}/timer`,
                              );
                              if (!timer)
                                throw new Error(tr('Ce membre n’a aucun chronomètre actif.'));
                              actions.open(
                                tr('Intervention sur un chronomètre'),
                                <ResolveTimer member={m} timer={timer} actions={actions} />,
                              );
                            });
                          }}
                        >
                          <Icon name="clock" size={17} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
