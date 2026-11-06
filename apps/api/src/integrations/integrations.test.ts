// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../app.ts';
import { callProvider, validateProviderUrl, boundedJson, SerialQueue } from './ai.ts';
import type { Project, Member, TimeEntry } from '@minutrel/contracts';
let app: ReturnType<typeof createApp>;
let token: string;
let member: Member;
let project: Project;
const now = Math.floor(Date.parse('2026-11-05T16:00:00Z') / 1000);
const mockFetch = vi.fn<typeof fetch>();
const call = async <T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  payload?: Record<string, unknown>,
  credential = token,
) => {
  const res = await app.inject({
    method,
    url: `/api/v1${path}`,
    payload,
    headers: { authorization: `Bearer ${credential}`, 'idempotency-key': crypto.randomUUID() },
  });
  return { code: res.statusCode, data: res.json<T>(), raw: res.body };
};
beforeEach(async () => {
  mockFetch.mockReset();
  app = createApp({
    path: ':memory:',
    setupToken: 'installation',
    now: () => now,
    fetcher: mockFetch,
  });
  const setup = await call<{ token: string; member: Member }>('POST', '/setup', {
    setupToken: 'installation',
    workspaceName: 'Atelier',
    name: 'Alex',
    email: 'alex@minutrel.test',
    password: 'Une phrase secrète solide',
    native: true,
  });
  token = setup.data.token;
  member = setup.data.member;
  project = (
    await call<Project>('POST', '/projects', { name: 'Projet personnel', memberIds: [member.id] })
  ).data;
});
afterEach(async () => {
  await app.close();
});

describe('Connexions IA facultatives', () => {
  it('restreint les destinataires et les redirections', () => {
    expect(validateProviderUrl('http://ollama:11434/v1/', 'openai-compatible')).toBe(
      'http://ollama:11434/v1',
    );
    expect(validateProviderUrl('https://api.anthropic.com/v1', 'anthropic')).toBe(
      'https://api.anthropic.com/v1',
    );
    for (const url of [
      'http://169.254.169.254/v1',
      'http://ollama:11434/v1?secret=x',
      'http://a:b@ollama/v1',
      'file:///v1',
      'http://ollama/other',
    ])
      expect(() => validateProviderUrl(url, 'openai-compatible')).toThrow();
    expect(() => validateProviderUrl('http://ollama/v1', 'anthropic')).toThrow();
  });
  it('chiffre une clé sans jamais la renvoyer et laisse les heures intactes', async () => {
    const added = await call<{ id: string; hasSecret: boolean }>('POST', '/providers', {
      name: 'Ollama local',
      kind: 'openai-compatible',
      baseUrl: 'http://ollama:11434/v1',
      model: 'modele-test',
      enabled: true,
      apiKey: 'secret-fournisseur-test',
    });
    expect(added.code).toBe(200);
    expect(added.data.hasSecret).toBe(true);
    expect(added.raw).not.toContain('secret-fournisseur-test');
    const stored = app.store.get<{ secret: string }>(
      'SELECT secret FROM providers WHERE id=?',
      added.data.id,
    )!;
    expect(stored.secret).not.toContain('secret-fournisseur-test');
    expect(app.store.decrypt(stored.secret)).toBe('secret-fournisseur-test');
    const time = await call<TimeEntry>('POST', '/time-entries', {
      projectId: project.id,
      kind: 'duration',
      workDate: '2026-11-04',
      duration: '1h30',
      description: 'Préparation de la présentation',
    });
    expect(time.code).toBe(200);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'La présentation a été préparée.' } }] }),
        { status: 200 },
      ),
    );
    const generated = await call<{ id: string; status: string; text: string; entryIds: string[] }>(
      'POST',
      '/summaries/generate',
      { providerId: added.data.id, month: '2026-11', consent: true },
    );
    expect(generated.code, generated.raw).toBe(200);
    expect(generated.data.status).toBe('draft');
    expect(generated.data.entryIds).toEqual([time.data.id]);
    const invocation = mockFetch.mock.calls[0]!;
    expect(invocation[0]).toBe('http://ollama:11434/v1/chat/completions');
    expect(invocation[1]?.redirect).toBe('error');
    expect(invocation[1]?.body).not.toContain('duration_seconds');
    const report = await call<{ totalSeconds: number; summaries: unknown[] }>(
      'GET',
      '/reports/monthly?month=2026-11',
    );
    expect(report.data.totalSeconds).toBe(5400);
    expect(report.data.summaries).toEqual([]);
    const approved = await call('PATCH', `/summaries/${generated.data.id}`, {
      text: generated.data.text,
      status: 'approved',
    });
    expect(approved.code).toBe(200);
    expect(
      (await call<{ summaries: unknown[] }>('GET', '/reports/monthly?month=2026-11')).data
        .summaries,
    ).toHaveLength(1);
    const badChange = await call('PATCH', `/providers/${added.data.id}`, {
      name: 'Autre',
      kind: 'openai-compatible',
      baseUrl: 'http://vllm:8000/v1',
      model: 'autre',
      enabled: true,
    });
    expect(badChange.code).toBe(400);
    const disable = await call('PATCH', `/providers/${added.data.id}`, {
      name: 'Ollama local',
      kind: 'openai-compatible',
      baseUrl: 'http://ollama:11434/v1',
      model: 'modele-test',
      enabled: false,
      clearSecret: true,
    });
    expect(disable.code).toBe(200);
    expect(
      (
        await call('POST', '/summaries/generate', {
          providerId: added.data.id,
          month: '2026-11',
          consent: true,
        })
      ).code,
    ).toBe(400);
    expect((await call('DELETE', `/providers/${added.data.id}`)).code).toBe(200);
  });
  it('utilise Messages pour Claude et gère les fournisseurs en erreur', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'Synthèse Claude.' }] })),
      );
    expect(
      await callProvider(
        { kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'modele-configure' },
        'clé-test',
        '{}',
        fetcher,
      ),
    ).toBe('Synthèse Claude.');
    const options = fetcher.mock.calls[0]![1]!;
    expect(options.headers).toMatchObject({
      'x-api-key': 'clé-test',
      'anthropic-version': '2026-10-21',
    });
    expect(fetcher.mock.calls[0]![0]).toBe('https://api.anthropic.com/v1/messages');
    await expect(
      callProvider(
        { kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'x' },
        null,
        '{}',
        fetcher,
      ),
    ).rejects.toThrow('clé Claude');
    fetcher.mockRejectedValue(new Error('network'));
    await expect(
      callProvider(
        { kind: 'openai-compatible', baseUrl: 'http://ollama/v1', model: 'x' },
        null,
        '{}',
        fetcher,
      ),
    ).rejects.toThrow('injoignable');
    await expect(boundedJson(new Response('impossible', { status: 503 }))).rejects.toThrow('503');
    await expect(boundedJson(new Response('not json'))).rejects.toThrow('JSON');
    await expect(boundedJson(new Response('123456'), 3)).rejects.toThrow('taille');
  });
  it('sérialise les tâches sans laisser une erreur bloquer la file', async () => {
    const queue = new SerialQueue();
    const order: string[] = [];
    let release: () => void = () => {};
    const first = queue.run(async () => {
      order.push('a');
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      order.push('b');
      throw new Error('échec prévu');
    });
    const firstResult = first.catch(() => undefined);
    const second = queue.run(async () => {
      order.push('c');
      return 42;
    });
    expect(order).toEqual(['a']);
    release();
    await firstResult;
    expect(await second).toBe(42);
    expect(order).toEqual(['a', 'b', 'c']);
  });
});
describe('MCP réel via le SDK officiel', () => {
  it('n’expose que les outils autorisés et conserve les brouillons privés', async () => {
    await call('POST', '/projects', { name: 'Projet non affecté', memberIds: [] });
    const created = await call<{ id: string; token: string }>('POST', '/mcp-tokens', {
      name: 'Codex',
      scopes: ['projects.read', 'time.read_own', 'work.read_own', 'work.draft_own'],
    });
    expect(created.code).toBe(200);
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const client = new Client({ name: 'recette-minutrel', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${address}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${created.data.token}` } },
    });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name).sort()).toEqual(
        [
          'minutrel_list_projects',
          'minutrel_get_my_timer',
          'minutrel_list_my_times',
          'minutrel_get_my_work_summary',
          'minutrel_create_work_note_draft',
        ].sort(),
      );
      const read = await client.callTool({ name: 'minutrel_list_projects', arguments: {} });
      const text = (read.content as { type: string; text: string }[])[0]!.text;
      expect(text).toContain('Projet personnel');
      expect(text).not.toContain('Projet non affecté');
      expect(
        (await client.callTool({ name: 'minutrel_get_my_timer', arguments: {} })).isError,
      ).not.toBe(true);
      expect(
        (await client.callTool({ name: 'minutrel_list_my_times', arguments: { month: '2026-11' } }))
          .isError,
      ).not.toBe(true);
      const draft = await client.callTool({
        name: 'minutrel_create_work_note_draft',
        arguments: {
          projectId: project.id,
          workDate: '2026-11-05',
          text: 'Le prototype a été vérifié.',
        },
      });
      expect(draft.isError).not.toBe(true);
      const notes = await call<{ shared: boolean; source: string }[]>('GET', '/notes');
      expect(notes.data).toHaveLength(1);
      expect(notes.data[0]).toMatchObject({ shared: false, source: 'assistant' });
      const overview = await client.callTool({
        name: 'minutrel_get_my_work_summary',
        arguments: { month: '2026-11' },
      });
      expect(overview.isError).not.toBe(true);
      expect(JSON.stringify(overview.content)).toContain('prototype');
      expect(
        (await call<{ notes: unknown[] }>('GET', '/reports/monthly?month=2026-11')).data.notes,
      ).toEqual([]);
      const forbidden = await client.callTool({
        name: 'minutrel_start_my_timer',
        arguments: { projectId: project.id },
      });
      expect(forbidden.isError).toBe(true);
      await call('DELETE', `/mcp-tokens/${created.data.id}`);
      await expect(client.listTools()).rejects.toThrow();
    } finally {
      await client.close();
    }
  });
  it('permet le chronomètre uniquement avec le droit explicite et refuse le jeton sur REST', async () => {
    const credential = (
      await call<{ token: string }>('POST', '/mcp-tokens', {
        name: 'Assistant autorisé',
        scopes: ['timer.write_own', 'time.read_own'],
      })
    ).data.token;
    expect((await call('GET', '/members', undefined, credential)).code).toBe(401);
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const client = new Client({ name: 'recette', version: '1' });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${address}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${credential}` } },
        }),
      );
      expect((await client.listTools()).tools.map((t) => t.name)).toContain(
        'minutrel_resume_my_timer',
      );
      const started = await client.callTool({
        name: 'minutrel_start_my_timer',
        arguments: { projectId: project.id, idempotencyKey: 'mcp-start-unique' },
      });
      expect(started.isError).not.toBe(true);
      expect((await call<{ timer: TimeEntry }>('GET', '/timer')).data.timer.projectId).toBe(
        project.id,
      );
      const paused = await client.callTool({
        name: 'minutrel_pause_my_timer',
        arguments: { version: 1, idempotencyKey: 'mcp-pause-unique' },
      });
      expect(paused.isError).not.toBe(true);
      const resumed = await client.callTool({
        name: 'minutrel_resume_my_timer',
        arguments: { version: 2, idempotencyKey: 'mcp-resume-unique' },
      });
      expect(resumed.isError).not.toBe(true);
      expect(
        (
          await client.callTool({
            name: 'minutrel_stop_my_timer',
            arguments: { version: 3, idempotencyKey: 'mcp-stop-unique' },
          })
        ).isError,
      ).not.toBe(true);
    } finally {
      await client.close();
    }
  });
});
