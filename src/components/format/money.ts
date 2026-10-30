// `formatMoney`: the one way an amount is shown — the server's minor unit of its currency (1250 is 12,50 €; ¥1,250 has
// no cents) in the business's currency, with the symbol a till of that country prints («zł», «€»); until the business
// is known, the amount alone. What is no number stays as it came.

/** A currency and how many decimals its minor unit has (EUR 2, JPY 0). */
export interface Money {
  currency: string;
  decimals: number;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, money: Money | undefined): Intl.NumberFormat {
  const id = `${locale}|${money?.currency ?? ''}|${money?.decimals ?? ''}`;
  let found = formatters.get(id);
  if (!found) {
    const digits = { minimumFractionDigits: money?.decimals ?? 2, maximumFractionDigits: money?.decimals ?? 2 };
    found = new Intl.NumberFormat(
      locale,
      money ? { style: 'currency', currency: money.currency, currencyDisplay: 'narrowSymbol', ...digits } : digits,
    );
    formatters.set(id, found);
  }
  return found;
}

export function formatMoney(minor: unknown, locale: string, money?: Money): string {
  const number = typeof minor === 'number' ? minor : typeof minor === 'string' && minor.trim() !== '' ? Number(minor) : NaN;
  if (Number.isNaN(number)) return String(minor);
  return formatter(locale, money).format(number / 10 ** (money?.decimals ?? 2));
}
