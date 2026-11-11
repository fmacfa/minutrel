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
let generation = 0;
let loaded: Engine | undefined;
let loading: Promise<Engine> | undefined;
const engine = () =>
  (loading ??= import('./local-engine.ts').then((module) => {
    loaded = module;
    module.setMode(mode, generation);
    return module;
  }));
export const syncStatus = (): SyncStatus =>
  loaded?.syncStatus() ?? { local: mode, offline: false, pending: 0, conflict: '' };
export function setMode(local: boolean, activeGeneration = generation) {
  mode = local;
  generation = activeGeneration;
  loaded?.setMode(local, generation);
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
export async function flush(remote: Parameters<Engine['flush']>[0]) {
  const expected = generation;
  return (await engine()).flush(remote, expected);
}
export async function importPersonal(
  remote: Parameters<Engine['importPersonal']>[0],
  mapping: Parameters<Engine['importPersonal']>[1],
) {
  const expected = generation;
  return (await engine()).importPersonal(remote, mapping, expected);
}
