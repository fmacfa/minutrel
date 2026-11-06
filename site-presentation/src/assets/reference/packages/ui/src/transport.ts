// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { nativeRequest, pendingBackup, setMode, syncStatus } from './local.ts';

export const native = isTauri();
let csrf = '';
export const setCsrf = (value: string) => {
  csrf = value;
};
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(tr(message));
    this.status = status;
  }
}
export interface Connection {
  serverUrl: string;
  authenticated: boolean;
  persistent: boolean;
  widget: boolean;
  local?: boolean;
}
export async function connection(): Promise<Connection> {
  if (native) {
    const c = await invoke<Connection>('get_connection');
    setMode(Boolean(c.local));
    return c;
  }
  return {
    serverUrl: window.location.origin,
    authenticated: false,
    persistent: true,
    widget: false,
  };
}
export async function configureServer(serverUrl: string) {
  return invoke('configure_server', { serverUrl });
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  return native
    ? nativeRequest<T>(remoteRequest, path, method, body, idempotencyKey)
    : remoteRequest<T>(path, method, body, idempotencyKey);
}
export async function remoteRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Idempotency-Key': idempotencyKey ?? crypto.randomUUID(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const result = native
    ? await invoke<{ status: number; body: string }>('api_request', {
        path: `/api/v1${path}`,
        method,
        body: body === undefined ? null : JSON.stringify(body),
        idempotencyKey: headers['Idempotency-Key'],
      })
    : await fetch(`/api/v1${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.text() }));
  let data: unknown;
  try {
    data = JSON.parse(result.body);
  } catch {
    throw new ApiError(
      result.status,
      tr('Le serveur a renvoyé une réponse illisible. Vérifiez son adresse.'),
    );
  }
  if (result.status < 200 || result.status >= 300)
    throw new ApiError(
      result.status,
      (data as { message?: string }).message ?? tr('L’action a échoué.'),
    );
  return data as T;
}
export async function download(path: string, filename: string) {
  if (path.startsWith('local:')) {
    const { takeLocalFile } = await import('./local-exports.ts');
    const file = takeLocalFile(path);
    return invoke('save_local_file', { filename: file.filename, bytes: Array.from(file.bytes) });
  }
  if (native && syncStatus().local && path === '/api/v1/workspace/export') {
    return invoke('save_local_file', {
      filename,
      bytes: Array.from(new TextEncoder().encode(await pendingBackup())),
    });
  }
  if (native) return invoke('download_file', { path, filename });
  const result = await fetch(path, { credentials: 'same-origin' });
  if (!result.ok) {
    const error = (await result.json()) as { message: string };
    throw new Error(error.message);
  }
  const url = URL.createObjectURL(await result.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function subscribe(
  change: () => void,
  status: (connected: boolean) => void,
): Promise<() => void> {
  if (native) {
    const unlocal = await listen('local-change', () => {
      if (syncStatus().local) status(true);
      change();
    });
    if (syncStatus().local) {
      status(true);
      return unlocal;
    }
    const unlisten = await listen('server-change', () => {
      status(true);
      change();
    });
    const unstatus = await listen<boolean>('server-connection', (e) => status(e.payload));
    await invoke('watch_events');
    return () => {
      unlisten();
      unstatus();
      unlocal();
    };
  }
  const source = new EventSource('/api/v1/events');
  source.addEventListener('connected', () => {
    status(true);
    change();
  });
  source.addEventListener('change', () => {
    status(true);
    change();
  });
  source.onerror = () => status(false);
  return () => source.close();
}
export const toggleWidget = () => invoke('toggle_widget');
export const showMain = () => invoke('show_main');
export async function onSessionChange(callback: () => void): Promise<() => void> {
  return native ? listen('session-changed', callback) : () => {};
}
