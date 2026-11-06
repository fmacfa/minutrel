// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { useState, type FormEvent } from 'react';
import type { Member, Project, Session } from '@minutrel/contracts';
import {
  Avatar,
  Badge,
  Empty,
  Field,
  Icon,
  formData,
  val,
  shortDuration,
  type Actions,
} from './components.tsx';
import { request } from './transport.ts';

function ProjectForm({
  project,
  members,
  actions,
}: {
  project?: Project;
  members: Member[];
  actions: Actions;
}) {
  const [ids, setIds] = useState(project?.memberIds ?? []);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    const f = formData(e);
    const ok = await actions.act(
      () =>
        request(project ? `/projects/${project.id}` : '/projects', project ? 'PATCH' : 'POST', {
          name: val(f, 'name'),
          description: val(f, 'description'),
          color: val(f, 'color'),
          memberIds: ids,
          ...(project ? { archived: f.has('archived'), version: project.version } : {}),
        }),
      project ? tr('Projet mis à jour.') : tr('Projet créé.'),
    );
    if (ok) actions.close();
  };
  return (
    <form className="stack-form" onSubmit={(e) => void submit(e)}>
      <Field label={tr('Nom du projet')}>
        <input name="name" defaultValue={project?.name} required maxLength={200} autoFocus />
      </Field>
      <Field label={tr('Description')}>
        <textarea
          name="description"
          defaultValue={project?.description}
          maxLength={2000}
          rows={3}
        />
      </Field>
      <Field label={tr('Couleur')}>
        <input name="color" type="color" defaultValue={project?.color ?? '#087f75'} />
      </Field>
      <div className="field">
        <span>{tr('Membres affectés')}</span>
        <div className="checklist">
          {members
            .filter((m) => m.enabled || ids.includes(m.id))
            .map((m) => (
              <label key={m.id} className="check-row">
                <input
                  type="checkbox"
                  checked={ids.includes(m.id)}
                  onChange={(e) =>
                    setIds(e.target.checked ? [...ids, m.id] : ids.filter((i) => i !== m.id))
                  }
                  disabled={!m.enabled && !ids.includes(m.id)}
                />
                <Avatar name={m.name} small />
                <span>
                  {m.name}
                  {!m.enabled && tr(' (désactivé)')}
                </span>
              </label>
            ))}
        </div>
      </div>
      {project && (
        <label className="check-row">
          <input name="archived" type="checkbox" defaultChecked={project.archived} />
          {tr('Archiver ce projet')}
        </label>
      )}
      <div className="form-footer">
        <button className="button secondary" type="button" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit">
          {tr('Enregistrer')}
        </button>
      </div>
    </form>
  );
}
function Tasks({ project, actions }: { project: Project; actions: Actions }) {
  const [name, setName] = useState('');
  return (
    <div>
      <p className="quiet">{tr('Les tâches sont facultatives et appartiennent à ce projet.')}</p>
      <div className="task-list">
        {project.tasks.map((t) => (
          <div className="task-row" key={t.id}>
            <span>{t.name}</span>
            <Badge>{t.archived ? tr('Archivée') : tr('Active')}</Badge>
            <button
              className="text-button"
              onClick={async () => {
                if (
                  await actions.act(
                    () =>
                      request(`/tasks/${t.id}`, 'PATCH', { name: t.name, archived: !t.archived }),
                    tr('Tâche mise à jour.'),
                  )
                )
                  actions.close();
              }}
            >
              {t.archived ? tr('Réactiver') : tr('Archiver')}
            </button>
          </div>
        ))}
      </div>
      <form
        className="input-action"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await actions.act(
              () => request(`/projects/${project.id}/tasks`, 'POST', { name }),
              tr('Tâche créée.'),
            )
          )
            actions.close();
        }}
      >
        <input
          aria-label={tr('Nom de la nouvelle tâche')}
          placeholder={tr('Nouvelle tâche')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          required
          disabled={project.archived}
        />
        <button className="button primary" type="submit" disabled={project.archived}>
          <Icon name="plus" />
          {tr('Ajouter')}
        </button>
      </form>
    </div>
  );
}
export function Projects({
  projects,
  members,
  session,
  totals,
  actions,
}: {
  projects: Project[];
  members: Member[];
  session: Session;
  totals: { id: string; seconds: number }[];
  actions: Actions;
}) {
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const manage = session.member.role !== 'contributor';
  const visible = projects.filter(
    (p) =>
      p.archived === archived &&
      p.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr('UN CADRE POUR CHAQUE MINUTE')}</p>
          <h1>
            {tr('Vos projets')}
            <span className="title-dot">.</span>
          </h1>
          <p className="quiet">{tr('Les espaces où le travail prend forme.')}</p>
        </div>
        {manage && (
          <button
            className="button primary"
            onClick={() =>
              actions.open(
                tr('Nouveau projet'),
                <ProjectForm members={members} actions={actions} />,
              )
            }
          >
            <Icon name="plus" />
            {tr('Nouveau projet')}
          </button>
        )}
      </div>
      <div className="toolbar">
        <div className="segmented">
          <button className={!archived ? 'selected' : ''} onClick={() => setArchived(false)}>
            {tr('Actifs')}
          </button>
          <button className={archived ? 'selected' : ''} onClick={() => setArchived(true)}>
            {tr('Archivés')}
          </button>
        </div>
        <input
          className="search-input"
          aria-label={tr('Rechercher un projet')}
          placeholder={tr('Rechercher un projet…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {visible.length ? (
        <div className="project-grid">
          {visible.map((p) => (
            <article className="project-card" key={p.id}>
              <div className="project-card-top">
                <span
                  className="project-tile"
                  style={{ background: `${p.color}16`, color: p.color }}
                >
                  <Icon name="projects" size={24} />
                </span>
                {manage && (
                  <button
                    className="icon-button"
                    onClick={() =>
                      actions.open(
                        tr('Modifier le projet'),
                        <ProjectForm project={p} members={members} actions={actions} />,
                      )
                    }
                    aria-label={tr('Modifier {0}', p.name)}
                  >
                    <Icon name="edit" size={18} />
                  </button>
                )}
              </div>
              <h2>{p.name}</h2>
              <p className="project-description quiet">
                {p.description || tr('Un espace pour avancer ensemble.')}
              </p>
              <div className="project-meta">
                <span>
                  <strong>{shortDuration(totals.find((t) => t.id === p.id)?.seconds ?? 0)}</strong>{' '}
                  {tr('ce mois')}
                </span>
                <span>
                  {p.tasks.filter((t) => !t.archived).length} {tr('tâche(s)')}
                </span>
              </div>
              <div className="project-card-footer">
                <div className="avatar-group">
                  {p.memberIds.slice(0, 4).map((memberId) => (
                    <Avatar
                      key={memberId}
                      name={
                        members.find((m) => m.id === memberId)?.name ??
                        (session.member.id === memberId ? session.member.name : tr('Membre'))
                      }
                      small
                    />
                  ))}
                  <span className="quiet">
                    {p.memberIds.length} {tr('membre(s)')}
                  </span>
                </div>
                {manage && (
                  <button
                    className="text-button"
                    onClick={() =>
                      actions.open(
                        tr('Tâches · {0}', p.name),
                        <Tasks project={p} actions={actions} />,
                      )
                    }
                  >
                    {tr('Tâches')}
                    <Icon name="chevron" size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            search
              ? tr('Aucun projet trouvé')
              : archived
                ? tr('Aucun projet archivé')
                : tr('Tout commence par un projet')
          }
          detail={
            manage
              ? tr('Créez un projet et affectez les membres qui y participent.')
              : tr('Votre responsable vous affectera vos premiers projets.')
          }
        />
      )}
    </>
  );
}
