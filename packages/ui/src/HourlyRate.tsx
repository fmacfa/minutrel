// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  hourlyRateCurrencies,
  validHourlyRate,
  type HourlyRate,
  type Member,
} from '@minutrel/contracts';
import { Field, formData, val, type Actions } from './components.tsx';
import { locale, t as tr } from './i18n.ts';
import { request } from './transport.ts';

const moneyFormats = new Map<string, Intl.NumberFormat>();
export function formatMoney(amountMinor: number | bigint, currency: HourlyRate['currency']) {
  const language = locale();
  const key = `${language}:${currency}`;
  let formatter = moneyFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(language, { style: 'currency', currency });
    moneyFormats.set(key, formatter);
  }
  return formatter.format(Number(amountMinor) / 100);
}
export const formatRate = (rate: HourlyRate) =>
  tr('{0}/h', formatMoney(rate.amountMinor, rate.currency));

function readRate(form: FormData): HourlyRate | null {
  const amount = val(form, 'rate').trim();
  if (!amount) return null;
  const parts = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(amount);
  const candidate = parts && {
    amountMinor: Number(parts[1]) * 100 + Number((parts[2] ?? '').padEnd(2, '0')),
    currency: val(form, 'currency'),
  };
  if (!validHourlyRate(candidate)) throw new Error(tr('Indiquez un taux horaire valide.'));
  return candidate;
}

function HourlyRateForm({ member, actions }: { member: Member; actions: Actions }) {
  return (
    <form
      className="stack-form"
      onSubmit={async (event) => {
        const form = formData(event);
        const ok = await actions.act(
          async () =>
            request(`/members/${member.id}/hourly-rate`, 'PATCH', { hourlyRate: readRate(form) }),
          tr('Taux horaire enregistré.'),
        );
        if (ok) actions.close();
      }}
    >
      <Field label={tr('Taux horaire')} hint={tr('Laisser vide pour retirer le taux.')}>
        <input
          name="rate"
          inputMode="decimal"
          maxLength={10}
          defaultValue={member.hourlyRate ? (member.hourlyRate.amountMinor / 100).toFixed(2) : ''}
          autoFocus
        />
      </Field>
      <Field label={tr('Devise')}>
        <select name="currency" defaultValue={member.hourlyRate?.currency ?? 'EUR'}>
          {hourlyRateCurrencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-footer">
        <button type="button" className="button secondary" onClick={actions.close}>
          {tr('Annuler')}
        </button>
        <button type="submit" className="button primary">
          {tr('Enregistrer')}
        </button>
      </div>
    </form>
  );
}

export function HourlyRateButton({ member, actions }: { member: Member; actions: Actions }) {
  const title = tr('Modifier le taux horaire de {0}', member.name);
  return (
    <button
      className="text-button"
      type="button"
      aria-label={title}
      onClick={() => actions.open(title, <HourlyRateForm member={member} actions={actions} />)}
    >
      {member.hourlyRate ? formatRate(member.hourlyRate) : tr('Définir le taux')}
    </button>
  );
}
