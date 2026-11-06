// SPDX-License-Identifier: AGPL-3.0-or-later
import { changeLanguage, getLanguage, type Language } from './i18n.ts';
export function LanguagePicker() {
  return (
    <select
      className="language-picker"
      aria-label="Langue / Language / Sprache"
      value={getLanguage()}
      onChange={(e) => changeLanguage(e.target.value as Language)}
    >
      <option value="fr">Français</option>
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>
  );
}
