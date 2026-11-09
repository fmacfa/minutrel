// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Project } from '@minutrel/contracts';
import {
  archiveConflict,
  flush,
  importPersonal,
  leavePersonal,
  pendingBackup,
  startPersonal,
  syncStatus,
} from './local.ts';
import { remoteRequest } from './transport.ts';
import { Field, type Actions } from './components.tsx';
import type { LocalData } from './local-core.ts';

function Transfer({ projects, actions }: { projects: Project[]; actions: Actions }) {
  const [local, setLocal] = useState<LocalData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  return (
    <div className="stack-form">
      <p>
        {tr(
          'Les temps finalisés de votre espace personnel seront copiés dans votre compte d’équipe. Les originaux restent sur cet ordinateur. Les notes privées ne sont pas transférées.',
        )}
      </p>
      {!local ? (
        <button
          className="button secondary"
          onClick={() =>
            void actions.act(async () => {
              const env = await invoke<{ data: LocalData | null }>('offline_read', {
                personal: true,
              });
              setLocal(env.data);
              if (!env.data) throw new Error(tr('Aucun espace local à transférer.'));
            })
          }
        >
          {tr('Lire mon espace local')}
        </button>
      ) : (
        <>
          {local.projects.map((p) => (
            <Field label={p.name} key={p.id}>
              <select
                value={mapping[p.id] ?? ''}
                onChange={(e) => setMapping({ ...mapping, [p.id]: e.target.value })}
              >
                <option value="">{tr('Ne pas transférer ce projet')}</option>
                {projects
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
          <p className="micro">
            {tr(
              'Les sous-catégories ne sont pas recréées. Un conflit ou un chevauchement interrompt le transfert ; les temps déjà reçus sont reconnus au prochain essai.',
            )}
          </p>
          <button
            className="button primary"
            disabled={!Object.values(mapping).some(Boolean)}
            onClick={() =>
              void actions.act(async () => {
                const count = await importPersonal(remoteRequest, mapping);
                if (!count)
                  throw new Error(tr('Aucun temps finalisé dans les projets sélectionnés.'));
                actions.close();
              }, tr('Temps locaux transférés.'))
            }
          >
            {tr('Transférer les temps sélectionnés')}
          </button>
        </>
      )}
    </div>
  );
}
export function LocalSettings({ projects, actions }: { projects: Project[]; actions: Actions }) {
  const status = syncStatus();
  return (
    <section className="panel padded">
      <h2>{status.local ? tr('Sur cet ordinateur') : tr('Connexion et synchronisation')}</h2>
      <p>
        {status.local
          ? tr(
              'Votre espace fonctionne sans compte en ligne ni serveur. Les données restent dans le dossier privé de l’application.',
            )
          : tr(
              'Vos chronomètres sont enregistrés localement avant envoi. La file est conservée après fermeture du logiciel.',
            )}
      </p>
      <div className="button-group">
        {status.local ? (
          <button className="button primary" onClick={() => void leavePersonal()}>
            {tr('Ouvrir un espace d’équipe')}
          </button>
        ) : (
          <>
            <button
              className="button secondary"
              onClick={() =>
                void actions.act(() => flush(remoteRequest), tr('Synchronisation vérifiée.'))
              }
            >
              {tr('Synchroniser')}
            </button>
            <button
              className="button secondary"
              onClick={() =>
                actions.open(
                  tr('Transférer mon travail local'),
                  <Transfer projects={projects} actions={actions} />,
                )
              }
            >
              {tr('Transférer mon travail local')}
            </button>
            <button className="button secondary" onClick={() => void startPersonal()}>
              {tr('Ouvrir mon espace personnel')}
            </button>
          </>
        )}
        <button
          className="button secondary"
          onClick={() =>
            void actions.act(
              async () =>
                invoke('save_local_file', {
                  filename: 'minutrel-copie-locale.json',
                  bytes: Array.from(new TextEncoder().encode(await pendingBackup())),
                }),
              tr('Copie locale préparée.'),
            )
          }
        >
          {tr('Exporter la copie locale')}
        </button>
      </div>
      {status.conflict && (
        <div className="notice error" role="alert">
          <div>
            <strong>{tr('Synchronisation à résoudre')}</strong>
            <p>{status.conflict}</p>
            <p>
              {tr(
                'Vos actions restent sur cet ordinateur. Terminez le temps local, exportez la copie, puis archivez la file pour reprendre l’état du serveur. Vous pourrez réintroduire les durées après vérification.',
              )}
            </p>
            <button
              className="button secondary"
              onClick={() =>
                void actions.act(
                  archiveConflict,
                  tr('Actions locales archivées ; état du serveur rechargé.'),
                )
              }
            >
              {tr('Archiver la file et conserver le serveur')}
            </button>
          </div>
        </div>
      )}
      <p className="micro">
        {tr(
          'La copie locale contient vos notes privées. Conservez-la dans un emplacement personnel protégé. Une copie de l’état précédent est également conservée lors de chaque écriture.',
        )}
      </p>
    </section>
  );
}
