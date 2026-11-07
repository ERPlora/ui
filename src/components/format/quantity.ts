// `formatQuantity`: the one way a quantity is shown (units, kilos, sessions) — a number, or the text of a decimal as the
// server sends one («2.500»), in the person's language with up to three decimals and none it does not need, the
// thousands grouped from four digits on as an amount groups them (`formatMoney`). What is no number stays as it came.

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string): Intl.NumberFormat {
  let found = formatters.get(locale);
  if (!found) {
    found = new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: 'always' });
    formatters.set(locale, found);
  }
  return found;
}

export function formatQuantity(quantity: unknown, locale: string): string {
  const number =
    typeof quantity === 'number' ? quantity : typeof quantity === 'string' && quantity.trim() !== '' ? Number(quantity) : NaN;
  if (!Number.isFinite(number)) return String(quantity);
  return formatter(locale).format(number);
}
