// SPDX-License-Identifier: AGPL-3.0-or-later
import { messages } from './locales/messages.ts';
import { invoke, isTauri } from '@tauri-apps/api/core';
export type Language = 'fr' | 'en' | 'de';
function stored(): Language {
  try {
    const value = localStorage.getItem('minutrel-language');
    if (value === 'en' || value === 'de') return value;
  } catch {
    /* Storage may be disabled. */
  }
  return 'fr';
}
const language = stored();
export const getLanguage = () => language;
export const locale = () => ({ fr: 'fr-FR', en: 'en-GB', de: 'de-DE' })[language];
export function t(text: string, ...values: unknown[]): string {
  const translated =
    language === 'fr' ? text : (messages[text]?.[language === 'en' ? 0 : 1] ?? text);
  return translated.replace(/\{(\d+)\}/g, (match, index) =>
    Number(index) < values.length ? String(values[Number(index)]) : match,
  );
}
export async function changeLanguage(value: Language) {
  if (isTauri()) await invoke('set_language', { language: value });
  localStorage.setItem('minutrel-language', value);
  window.location.reload();
}
if (typeof document !== 'undefined') {
  document.documentElement.lang = language;
  document.title = `Minutrel — ${t('Le temps de vos projets, ensemble.')}`;
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === 'minutrel-language' && event.newValue !== language) window.location.reload();
  });
