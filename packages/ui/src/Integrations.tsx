// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr, locale } from './i18n.ts';
import { useEffect, useState } from 'react';
import { mcpScopes, type McpToken, type Provider, type Session } from '@minutrel/contracts';
import { Badge, Empty, Field, Icon, formData, val, type Actions } from './components.tsx';
import { request } from './transport.ts';

const scopeLabels = {
  'projects.read': tr('Lire mes projets'),
  'time.read_own': tr('Lire mes temps et mon chronomètre'),
  'work.read_own': tr('Lire mes notes et comptes rendus'),
  'work.draft_own': tr('Proposer des brouillons privés'),
  'timer.write_own': tr('Démarrer, mettre en pause et arrêter mon temps'),
};
function TokenForm({ actions }: { actions: Actions }) {
  const [selected, setSelected] = useState<string[]>([
    'projects.read',
    'time.read_own',
    'work.read_own',
    'work.draft_own',
  ]);
  const [token, setToken] = useState('');
  if (token)
    return (
      <div className="stack-form">
        <p>
          {tr('Copiez cet accès personnel maintenant. Il ne sera plus affiché après fermeture.')}
        </p>
        <Field label={tr('Jeton MCP personnel')}>
          <textarea
            className="code-input"
            readOnly
            value={token}
            rows={3}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </Field>
        <p className="micro">
          {tr('Placez-le dans la variable MINUTREL_MCP_TOKEN de votre assistant.')}
        </p>
        <div className="form-footer">
          <button className="button primary" onClick={actions.close}>
            {tr('J’ai conservé mon jeton')}
          </button>
        </div>
      </div>
    );
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        const f = formData(e);
        await actions.act(async () => {
          const created = await request<{ token: string }>('/mcp-tokens', 'POST', {
            name: val(f, 'name'),
            days: Number(val(f, 'days')),
            scopes: selected,
          });
          setToken(created.token);
        });
      }}
    >
      <Field label={tr('Nom de l’accès')}>
        <input
          name="name"
          required
          maxLength={200}
          placeholder={tr('Codex sur mon ordinateur')}
          autoFocus
        />
      </Field>
      <Field label={tr('Durée de validité')}>
        <select name="days" defaultValue="30">
          <option value="7">{tr('7 jours')}</option>
          <option value="30">{tr('30 jours')}</option>
          <option value="90">{tr('90 jours')}</option>
          <option value="365">{tr('1 an')}</option>
        </select>
      </Field>
      <div className="field">
        <span>{tr('Droits accordés à cet assistant')}</span>
        <div className="checklist">
          {mcpScopes.map((scope) => (
            <label className="check-row" key={scope}>
              <input
                type="checkbox"
                checked={selected.includes(scope)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, scope] : selected.filter((s) => s !== scope),
                  )
                }
              />
              <span>{scopeLabels[scope]}</span>
            </label>
          ))}
        </div>
      </div>
      <p className="micro">
        {tr('Cet accès reste limité à vos données, y compris si vous êtes administrateur.')}
      </p>
      <div className="form-footer">
        <button className="button secondary" type="button" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button className="button primary" type="submit" disabled={!selected.length}>
          {tr('Créer l’accès')}
        </button>
      </div>
    </form>
  );
}
function ProviderForm({ provider, actions }: { provider?: Provider; actions: Actions }) {
  const [kind, setKind] = useState<Provider['kind']>(provider?.kind ?? 'openai-compatible');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? 'http://ollama:11434/v1');
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        const f = formData(e);
        if (
          await actions.act(
            () =>
              request(
                provider ? `/providers/${provider.id}` : '/providers',
                provider ? 'PATCH' : 'POST',
                {
                  name: val(f, 'name'),
                  kind,
                  baseUrl,
                  model: val(f, 'model'),
                  enabled: f.has('enabled'),
                  apiKey: val(f, 'apiKey') || undefined,
                  clearSecret: f.has('clearSecret'),
                },
              ),
            tr('Fournisseur enregistré.'),
          )
        )
          actions.close();
      }}
    >
      <Field label={tr('Nom du fournisseur')}>
        <input
          name="name"
          defaultValue={provider?.name}
          required
          maxLength={100}
          placeholder={tr('Ollama de l’équipe')}
          autoFocus
        />
      </Field>
      <Field label={tr('Type d’API')}>
        <select
          value={kind}
          onChange={(e) => {
            const value = e.target.value as Provider['kind'];
            setKind(value);
            setBaseUrl(
              value === 'anthropic' ? 'https://api.anthropic.com/v1' : 'http://ollama:11434/v1',
            );
          }}
        >
          <option value="openai-compatible">{tr('Ollama / vLLM (compatible OpenAI)')}</option>
          <option value="anthropic">{tr('Claude (API Messages)')}</option>
        </select>
      </Field>
      <Field
        label={tr('Adresse du serveur IA')}
        hint={tr('L’hôte doit être autorisé par APP_AI_ALLOWED_HOSTS sur le serveur Minutrel.')}
      >
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          required
          maxLength={500}
        />
      </Field>
      <Field
        label={tr('Identifiant du modèle')}
        hint={tr('Le modèle doit déjà être disponible sur le fournisseur.')}
      >
        <input
          name="model"
          defaultValue={provider?.model}
          required
          maxLength={200}
          placeholder={tr('Nom exact du modèle')}
        />
      </Field>
      <Field
        label={
          provider?.hasSecret
            ? tr('Nouvelle clé (laisser vide pour conserver)')
            : tr('Clé du fournisseur (si nécessaire)')
        }
      >
        <input name="apiKey" type="password" autoComplete="new-password" maxLength={1000} />
      </Field>
      {provider?.hasSecret && (
        <label className="check-row">
          <input type="checkbox" name="clearSecret" />
          {tr('Effacer la clé enregistrée')}
        </label>
      )}
      <label className="check-row">
        <input type="checkbox" name="enabled" defaultChecked={provider?.enabled} />
        {tr('Activer ce fournisseur pour les comptes rendus')}
      </label>
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
export function Integrations({
  session,
  providers,
  revision,
  serverUrl,
  actions,
}: {
  session: Session;
  providers: Provider[];
  revision: number;
  serverUrl: string;
  actions: Actions;
}) {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [error, setError] = useState('');
  const [client, setClient] = useState('codex');
  useEffect(() => {
    let active = true;
    void request<McpToken[]>('/mcp-tokens')
      .then((t) => {
        if (active) {
          setTokens(t);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const endpoint = `${serverUrl.replace(/\/$/, '')}/mcp`;
  const snippet =
    client === 'codex'
      ? tr(
          '[mcp_servers.minutrel]\nurl = {0}\nbearer_token_env_var = "MINUTREL_MCP_TOKEN"\nenabled_tools = ["minutrel_list_projects", "minutrel_get_my_timer", "minutrel_list_my_times", "minutrel_create_work_note_draft", "minutrel_get_my_work_summary"]',
          JSON.stringify(endpoint),
        )
      : JSON.stringify(
          {
            mcpServers: {
              minutrel: {
                type: 'http',
                url: endpoint,
                headers: { Authorization: tr('Bearer ${MINUTREL_MCP_TOKEN}') },
              },
            },
          },
          null,
          2,
        );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr('LES BONS OUTILS, À VOTRE RYTHME')}</p>
          <h1>
            {tr('Les connexions')}
            <span className="title-dot">.</span>
          </h1>
          <p className="quiet">
            {tr('Reliez vos assistants à votre travail, avec des droits précis.')}
          </p>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <section className="panel padded">
        <div className="section-heading">
          <div>
            <h2>{tr('Codex & Claude Code')}</h2>
            <p className="quiet">
              {tr('Un accès MCP personnel pour consulter votre activité et proposer des notes.')}
            </p>
          </div>
          <button
            className="button primary"
            onClick={() =>
              actions.open(tr('Nouvel accès assistant'), <TokenForm actions={actions} />)
            }
          >
            <Icon name="plus" />
            {tr('Créer un accès')}
          </button>
        </div>
        {tokens.length ? (
          <div className="integration-list">
            {tokens.map((t) => (
              <div key={t.id} className="integration-row">
                <span className="integration-icon">
                  <Icon name="link" />
                </span>
                <div className="grow">
                  <strong>{t.name}</strong>
                  <small className="cell-secondary">
                    {tr('Expire le ')}
                    {new Date(t.expiresAt * 1000).toLocaleDateString(locale())} · {t.scopes.length}{' '}
                    {tr('droit(s)')}
                  </small>
                </div>
                <button
                  className="text-button destructive"
                  onClick={() =>
                    actions.open(
                      tr('Révoquer cet accès'),
                      <div className="stack-form">
                        <p>
                          {tr('Retirer immédiatement l’accès « ')}
                          {t.name} {tr('» à vos données Minutrel ?')}
                        </p>
                        <div className="form-footer">
                          <button className="button secondary" onClick={actions.close}>
                            {tr('Conserver')}
                          </button>
                          <button
                            className="button danger"
                            onClick={async () => {
                              if (
                                await actions.act(
                                  () => request(`/mcp-tokens/${t.id}`, 'DELETE'),
                                  tr('Accès révoqué.'),
                                )
                              )
                                actions.close();
                            }}
                          >
                            {tr('Révoquer')}
                          </button>
                        </div>
                      </div>,
                    )
                  }
                >
                  {tr('Révoquer')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="quiet">{tr('Vous n’avez encore accordé aucun accès à un assistant.')}</p>
        )}
        <details className="configuration">
          <summary>{tr('Configurer mon assistant')}</summary>
          <div className="segmented">
            <button
              className={client === 'codex' ? 'selected' : ''}
              onClick={() => setClient('codex')}
            >
              Codex
            </button>
            <button
              className={client === 'claude' ? 'selected' : ''}
              onClick={() => setClient('claude')}
            >
              {tr('Claude Code')}
            </button>
          </div>
          <p className="micro">
            {tr(
              'Définissez MINUTREL_MCP_TOKEN avec le jeton créé, puis ajoutez cette configuration à votre assistant.',
            )}
          </p>
          <pre className="code-block">
            <code>{snippet}</code>
          </pre>
          <p className="micro">
            {tr(
              'Pour Codex : ~/.codex/config.toml. Pour Claude Code : .mcp.json dans le projet. Aucun accès aux dossiers de votre ordinateur n’est nécessaire.',
            )}
          </p>
        </details>
      </section>
      <section className="panel padded">
        <div className="section-heading">
          <div>
            <h2>{tr('Moteurs de comptes rendus')}</h2>
            <p className="quiet">
              {tr(
                'Ollama, vLLM ou Claude peuvent préparer un texte que vous relirez avant de le partager.',
              )}
            </p>
          </div>
          {session.member.role === 'admin' && (
            <button
              className="button secondary"
              onClick={() =>
                actions.open(tr('Ajouter un fournisseur IA'), <ProviderForm actions={actions} />)
              }
            >
              <Icon name="plus" />
              {tr('Ajouter')}
            </button>
          )}
        </div>
        {providers.length ? (
          <div className="integration-list">
            {providers.map((p) => (
              <div className="integration-row" key={p.id}>
                <span className="integration-icon">
                  <Icon name="spark" />
                </span>
                <div className="grow">
                  <strong>{p.name}</strong>
                  <small className="cell-secondary">
                    {p.model} · {p.kind === 'anthropic' ? 'Claude' : tr('Compatible OpenAI')}
                  </small>
                </div>
                <Badge tone={p.enabled ? 'green' : ''}>
                  {p.enabled ? tr('Actif') : tr('Désactivé')}
                </Badge>
                {session.member.role === 'admin' && (
                  <button
                    className="icon-button"
                    aria-label={tr('Configurer {0}', p.name)}
                    onClick={() =>
                      actions.open(
                        tr('Configurer le fournisseur'),
                        <ProviderForm provider={p} actions={actions} />,
                      )
                    }
                  >
                    <Icon name="settings" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={tr('À vous de choisir votre moteur')}
            detail={tr(
              'Un administrateur peut configurer un fournisseur. Minutrel fonctionne aussi sans IA.',
            )}
          />
        )}
      </section>
    </>
  );
}
