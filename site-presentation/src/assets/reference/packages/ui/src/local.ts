// SPDX-License-Identifier: AGPL-3.0-or-later
// Le navigateur d’équipe ne charge pas le moteur de stockage personnel.
type Engine = typeof import('./local-engine.ts');
export interface SyncStatus {
  local: boolean;
  offline: boolean;
  pending: number;
  conflict: string;
}
let mode = false;
let loaded: Engine | undefined;
let loading: Promise<Engine> | undefined;
const engine = () =>
  (loading ??= import('./local-engine.ts').then((module) => {
    loaded = module;
    module.setMode(mode);
    return module;
  }));
export const syncStatus = (): SyncStatus =>
  loaded?.syncStatus() ?? { local: mode, offline: false, pending: 0, conflict: '' };
export function setMode(local: boolean) {
  mode = local;
  loaded?.setMode(local);
}
export async function nativeRequest<T>(...args: Parameters<Engine['nativeRequest']>): Promise<T> {
  return (await engine()).nativeRequest<T>(...args);
}
export async function startPersonal(name?: string) {
  return (await engine()).startPersonal(name);
}
export async function leavePersonal() {
  return (await engine()).leavePersonal();
}
export async function pendingBackup() {
  return (await engine()).pendingBackup();
}
export async function archiveConflict() {
  return (await engine()).archiveConflict();
}
export async function flush(...args: Parameters<Engine['flush']>) {
  return (await engine()).flush(...args);
}
export async function importPersonal(...args: Parameters<Engine['importPersonal']>) {
  return (await engine()).importPersonal(...args);
}
