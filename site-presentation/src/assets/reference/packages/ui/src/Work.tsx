// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { useEffect, useRef, useState } from 'react';
import type { Project, Provider, Session, WorkNote, WorkSummary } from '@minutrel/contracts';
import { Badge, Empty, Field, Icon, formData, val, type Actions } from './components.tsx';
import { request } from './transport.ts';
import { dateString } from './Times.tsx';

function NoteForm({
  note,
  projects,
  session,
  actions,
}: {
  note?: WorkNote;
  projects: Project[];
  session: Session;
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
              request(note ? `/notes/${note.id}` : '/notes', note ? 'PATCH' : 'POST', {
                text: val(f, 'text'),
                shared: f.has('shared'),
                ...(!note ? { projectId: val(f, 'projectId'), workDate: val(f, 'workDate') } : {}),
              }),
            tr('Note enregistrée.'),
          )
        )
          actions.close();
      }}
    >
      {!note && (
        <div className="form-grid">
          <Field label={tr('Projet')}>
            <select name="projectId" required>
              {projects
                .filter((p) => !p.archived)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={tr('Date')}>
            <input
              name="workDate"
              type="date"
              defaultValue={dateString(session.serverNow, session.workspace.timezone)}
              required
            />
          </Field>
        </div>
      )}
      <Field label={tr('Le travail effectué')}>
        <textarea
          name="text"
          rows={7}
          defaultValue={note?.text}
          maxLength={8000}
          required
          autoFocus
          placeholder={tr('Ce qui a avancé, ce qui a été livré, les prochaines étapes…')}
        />
      </Field>
      <label className="check-row">
        <input name="shared" type="checkbox" defaultChecked={note?.shared} />
        {tr('Partager cette note dans les rapports de l’équipe')}
      </label>
      <p className="micro">
        {tr(
          'Une note privée reste visible uniquement par vous et les assistants auxquels vous donnez ce droit.',
        )}
      </p>
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
function SummaryForm({
  summary,
  month,
  actions,
}: {
  summary?: WorkSummary;
  month: string;
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
              request(
                summary ? `/summaries/${summary.id}` : '/summaries',
                summary ? 'PATCH' : 'POST',
                {
                  text: val(f, 'text'),
                  ...(summary ? { status: f.has('approved') ? 'approved' : 'draft' } : { month }),
                },
              ),
            tr('Compte rendu enregistré.'),
          )
        )
          actions.close();
      }}
    >
      <p className="quiet">
        {tr('Votre compte rendu de ')}
        {summary?.month ?? month}
        {tr('. Les totaux de temps sont calculés à partir des saisies, séparément de ce texte.')}
      </p>
      <Field label={tr('Compte rendu')}>
        <textarea
          name="text"
          rows={10}
          defaultValue={summary?.text}
          required
          maxLength={8000}
          autoFocus
        />
      </Field>
      {summary && (
        <label className="check-row">
          <input type="checkbox" name="approved" defaultChecked={summary.status === 'approved'} />
          {tr('J’ai relu ce texte et je le valide pour les rapports')}
        </label>
      )}
      <div className="form-footer">
        <button className="button secondary" type="button" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit">
          {summary ? tr('Enregistrer mon choix') : tr('Créer le brouillon')}
        </button>
      </div>
    </form>
  );
}
function GenerateForm({
  month,
  providers,
  actions,
}: {
  month: string;
  providers: Provider[];
  actions: Actions;
}) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        const f = formData(e);
        setBusy(true);
        try {
          if (
            (await actions.act(
              () =>
                request('/summaries/generate', 'POST', {
                  month,
                  providerId: val(f, 'providerId'),
                  consent: f.has('consent'),
                }),
              tr('Brouillon préparé. Relisez-le avant de le valider.'),
              true,
            )) &&
            mounted.current
          )
            actions.close();
        } finally {
          if (mounted.current) setBusy(false);
        }
      }}
    >
      <p>
        {tr('Préparer un compte rendu de ')}
        <strong>{month}</strong>{' '}
        {tr('à partir de vos descriptions de temps et de vos notes de ce mois.')}
      </p>
      <Field label={tr('Destinataire IA')}>
        <select name="providerId" required disabled={busy}>
          {providers
            .filter((p) => p.enabled)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.model}
              </option>
            ))}
        </select>
      </Field>
      <label className="check-row">
        <input type="checkbox" name="consent" required disabled={busy} />
        {tr(
          'J’autorise l’envoi de mes descriptions et notes, y compris privées, au fournisseur choisi.',
        )}
      </label>
      <p className="micro">
        {tr('Le résultat sera un brouillon privé. Il ne modifiera aucun temps enregistré.')}
      </p>
      <div className="form-footer">
        <button className="button secondary" type="button" onClick={actions.close}>
          {busy ? tr('Fermer pendant la rédaction') : tr('Annuler')}
        </button>
        <button className="button primary" type="submit" disabled={busy}>
          <Icon name="spark" />
          {busy ? tr('Rédaction en cours…') : tr('Préparer le brouillon')}
        </button>
      </div>
    </form>
  );
}
export function Work({
  session,
  notes,
  summaries,
  projects,
  providers,
  actions,
  initialMonth,
}: {
  session: Session;
  notes: WorkNote[];
  summaries: WorkSummary[];
  projects: Project[];
  providers: Provider[];
  actions: Actions;
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const visible = notes.filter((n) => n.workDate.startsWith(`${month}-`));
  const monthlySummaries = summaries.filter((s) => s.month === month);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr('AU-DELÀ DES CHIFFRES')}</p>
          <h1>
            {tr('Le fil du travail')}
            <span className="title-dot">.</span>
          </h1>
          <p className="quiet">
            {tr('Gardez une trace de ce qui avance, puis partagez l’essentiel.')}
          </p>
        </div>
        <button
          className="button primary"
          disabled={!projects.some((p) => !p.archived)}
          onClick={() =>
            actions.open(
              tr('Nouvelle note de travail'),
              <NoteForm projects={projects} session={session} actions={actions} />,
            )
          }
        >
          <Icon name="plus" />
          {tr('Ajouter une note')}
        </button>
      </div>
      <div className="toolbar">
        <label className="inline-field">
          {tr('Mois')}
          <input
            type="month"
            required
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </label>
        <span className="quiet toolbar-end">
          {tr('Les brouillons restent privés jusqu’à votre validation.')}
        </span>
      </div>
      <section className="panel padded">
        <div className="section-heading">
          <div>
            <h2>{tr('Le compte rendu du mois')}</h2>
            <p className="quiet">
              {tr('Rédigez-le vous-même ou partez d’une proposition de votre moteur IA.')}
            </p>
          </div>
          <div className="button-group">
            <button
              className="button secondary"
              onClick={() =>
                actions.open(
                  tr('Rédiger un compte rendu'),
                  <SummaryForm month={month} actions={actions} />,
                )
              }
            >
              <Icon name="edit" />
              {tr('Rédiger')}
            </button>
            <button
              className="button secondary"
              disabled={!providers.some((p) => p.enabled)}
              onClick={() =>
                actions.open(
                  tr('Préparer un compte rendu avec l’IA'),
                  <GenerateForm month={month} providers={providers} actions={actions} />,
                )
              }
            >
              <Icon name="spark" />
              {tr('Préparer avec l’IA')}
            </button>
          </div>
        </div>
        {monthlySummaries.length ? (
          <div className="summary-grid">
            {monthlySummaries.map((s) => (
              <article key={s.id} className="summary-card">
                <div className="section-heading">
                  <Badge tone={s.status === 'approved' ? 'green' : 'yellow'}>
                    {s.status === 'approved' ? tr('Validé & partagé') : tr('Brouillon privé')}
                  </Badge>
                  <span className="micro">
                    {s.source === 'ai' ? tr('Proposition IA') : tr('Rédaction manuelle')}
                  </span>
                </div>
                <p className="prose">{s.text}</p>
                <div className="section-heading">
                  <span className="micro">
                    {s.entryIds.length
                      ? tr('{0} temps source(s)', s.entryIds.length)
                      : tr('Votre texte')}
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      actions.open(
                        tr('Relire le compte rendu'),
                        <SummaryForm summary={s} month={month} actions={actions} />,
                      )
                    }
                  >
                    {tr('Relire et valider')}
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="quiet">
            {tr('Aucun compte rendu pour ce mois. Les rapports de temps restent disponibles.')}
          </p>
        )}
      </section>
      <div className="section-heading">
        <h2>{tr('Vos notes de travail')}</h2>
        <span className="quiet">
          {visible.length} {tr('note(s)')}
        </span>
      </div>
      {visible.length ? (
        <div className="notes-grid">
          {visible.map((n) => (
            <article className="note-card" key={n.id}>
              <div className="section-heading">
                <span className="micro">
                  {n.workDate.split('-').reverse().join('/')} · {n.projectName ?? tr('Projet')}
                </span>
                <Badge tone={n.shared ? 'green' : n.source === 'assistant' ? 'yellow' : ''}>
                  {n.shared
                    ? tr('Partagée')
                    : n.source === 'assistant'
                      ? tr('Proposée par un assistant')
                      : tr('Privée')}
                </Badge>
              </div>
              <p className="prose">{n.text}</p>
              <div className="note-footer">
                <button
                  className="text-button"
                  onClick={() =>
                    actions.open(
                      tr('Relire la note'),
                      <NoteForm note={n} projects={projects} session={session} actions={actions} />,
                    )
                  }
                >
                  {tr('Relire / partager')}
                  <Icon name="arrow" size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={tr('Supprimer cette note')}
                  onClick={() =>
                    actions.open(
                      tr('Supprimer une note'),
                      <div className="stack-form">
                        <p>{tr('Supprimer définitivement cette note de travail ?')}</p>
                        <div className="form-footer">
                          <button className="button secondary" onClick={actions.close}>
                            {tr('Conserver')}
                          </button>
                          <button
                            className="button danger"
                            onClick={async () => {
                              if (
                                await actions.act(
                                  () => request(`/notes/${n.id}`, 'DELETE'),
                                  tr('Note supprimée.'),
                                )
                              )
                                actions.close();
                            }}
                          >
                            {tr('Supprimer')}
                          </button>
                        </div>
                      </div>,
                    )
                  }
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title={tr('Le fil reste à écrire')}
            detail={tr(
              'Notez un résultat, une étape franchie ou faites proposer un brouillon par votre assistant.',
            )}
          />
        </section>
      )}
    </>
  );
}
