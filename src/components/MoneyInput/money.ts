// The reader of `MoneyInput`, the one money field of every form: what a person types or pastes, read into whole minor
// units of the field's money (a price list's, its currency; anything else, the business's). Its code or its symbol
// («PLN», «zł»; «JPY», «¥») and the spaces around are noise, any other currency's is not; with both marks the
// rightmost one is the decimal one; at most the currency's decimals (none in yen). While the money is unknown, two
// decimals and no symbol to take away (never a euro by default). One mark followed by three digits («1.250») can be
// 1.250 zł or 1,25 zł: it is not guessed, the field says so. A price is never negative («-2» says it cannot be); a
// `signed` amount (a supplement) is read with its sign: a leading «-» or «−» is a discount, a leading «+» the screen's
// own sign. On leaving the field it is rewritten in the page format, ungrouped. The forms read the minor units with
// `parseMoney` when they save, and write a stored amount back into the field with `moneyFieldText`.
import { decimalMark, type Money } from '../format';

export type MoneyRead =
  | { ok: true; cents: number | null }
  | { ok: false; reason: 'not_amount' }
  | { ok: false; reason: 'negative' }
  | { ok: false; reason: 'ambiguous'; grouped: number; decimal: number };

export interface MoneyReadOptions {
  /** The field's money; unknown while the business (or the list) has not answered. */
  money?: Money;
  /** A negative amount is read (a supplement), instead of refused (a price). */
  signed?: boolean;
}

/** A reading of a figure without its sign: never empty. */
type FigureRead = Exclude<MoneyRead, { ok: true }> | { ok: true; cents: number };

const NOT_AMOUNT = { ok: false, reason: 'not_amount' } as const;
const NEGATIVE = { ok: false, reason: 'negative' } as const;
/** The decimals of an amount while its currency is unknown. */
const UNKNOWN_DECIMALS = 2;
/** Far above any price, still exact in a double. */
const MAX_DIGITS = 15;

const DIGITS = /^\d+$/;
const marks = new Map<string, RegExp>();

/** How `currency` is written around an amount: its code, its symbol and its narrow symbol («PLN», «zł»; «JPY», «¥»). */
function currencyMarks(currency: string): RegExp {
  let found = marks.get(currency);
  if (!found) {
    const written = (['code', 'symbol', 'narrowSymbol'] as const).map(
      (currencyDisplay) =>
        new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay }).formatToParts(1).find((part) => part.type === 'currency')
          ?.value ?? currency,
    );
    const escaped = [...new Set(written)].sort((a, b) => b.length - a.length).map((mark) => mark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    found = new RegExp(escaped.join('|'), 'gi');
    marks.set(currency, found);
  }
  return found;
}

const moneyDecimals = (money?: Money): number => money?.decimals ?? UNKNOWN_DECIMALS;

/** `whole` major units and `fraction` digits (at most `decimals` of them) as minor units. */
const cents = (whole: string, fraction: string, decimals: number): number =>
  Number(whole || '0') * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || '0');

/** «1.234.567» (one mark, repeated): thousands groups, or `null` when the groups are broken. */
function grouped(raw: string, mark: string, decimals: number): number | null {
  const [head, ...groups] = raw.split(mark);
  if (!/^[1-9]\d{0,2}$/.test(head) || groups.some((group) => !/^\d{3}$/.test(group))) return null;
  return cents(head + groups.join(''), '', decimals);
}

/** The reading of an amount without a sign, with at most `decimals` decimals. */
function unsigned(raw: string, decimals: number): FigureRead {
  if (!/^[\d.,]+$/.test(raw) || !/^\d/.test(raw) || raw.replace(/\D/g, '').length > MAX_DIGITS) return NOT_AMOUNT;
  const fits = (fraction: string) => DIGITS.test(fraction) && fraction.length <= decimals;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const at = Math.max(lastComma, lastDot);
    const whole = raw.slice(0, at);
    const fraction = raw.slice(at + 1);
    if (whole.includes(decimal) || !fits(fraction)) return NOT_AMOUNT;
    return { ok: true, cents: cents(whole.replace(/[.,]/g, ''), fraction, decimals) };
  }
  const mark = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : '';
  if (!mark) return { ok: true, cents: cents(raw, '', decimals) };
  const parts = raw.split(mark);
  if (parts.length > 2) {
    const value = grouped(raw, mark, decimals);
    return value === null ? NOT_AMOUNT : { ok: true, cents: value };
  }
  const [whole, fraction] = parts;
  if (fits(fraction)) return { ok: true, cents: cents(whole, fraction, decimals) };
  if (!/^\d{3}$/.test(fraction)) return NOT_AMOUNT;
  // Three digits after one mark: thousands, or decimals a price cannot have unless the extra ones are 0.
  const asGroups = grouped(raw, mark, decimals);
  const asDecimal = decimals > 0 && /^0+$/.test(fraction.slice(decimals)) ? cents(whole, fraction.slice(0, decimals), decimals) : null;
  if (asGroups !== null && asDecimal !== null) return { ok: false, reason: 'ambiguous', grouped: asGroups, decimal: asDecimal };
  if (asGroups !== null) return { ok: true, cents: asGroups };
  return asDecimal === null ? NOT_AMOUNT : { ok: true, cents: asDecimal };
}

/** What a money field holds in its money: minor units (`null` when empty), or why it is not an amount. */
export function parseMoney(text: string, options: MoneyReadOptions = {}): MoneyRead {
  const spaced = text.replace(/\s/g, '');
  const raw = options.money ? spaced.replace(currencyMarks(options.money.currency), '') : spaced;
  if (raw === '') return { ok: true, cents: null };
  const decimals = moneyDecimals(options.money);
  const negative = /^[-−]/.test(raw);
  if (!negative && !(options.signed && raw.startsWith('+'))) return unsigned(raw, decimals);
  const read = unsigned(raw.slice(1), decimals);
  if (!negative) return read;
  if (read.ok) return options.signed ? { ok: true, cents: -read.cents } : NEGATIVE;
  if (read.reason !== 'ambiguous') return read;
  return options.signed ? { ...read, grouped: -read.grouped, decimal: -read.decimal } : NEGATIVE;
}

/** Minor units as the field shows them: the page's decimal mark, the decimals of `money`, ungrouped, with their sign;
 *  `''` for none. */
export function moneyFieldText(value: number | null | undefined, locale: string, money?: Money): string {
  if (value === null || value === undefined) return '';
  const decimals = moneyDecimals(money);
  const scale = 10 ** decimals;
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const whole = Math.trunc(absolute / scale);
  if (!decimals) return `${sign}${whole}`;
  return `${sign}${whole}${decimalMark(locale)}${String(absolute % scale).padStart(decimals, '0')}`;
}

/** The examples the field's «not an amount» gives — an amount, and for a signed field a supplement and a discount —
 *  written as the field writes an amount of `money`, cut to its decimals and never to 0, so that copying one clears
 *  the warning: «12,50», «1,50» and «-0,50» in euros; «12», «1» and «-1» in yen; «12,500», «1,500» and «-0,500» in
 *  dinars (ui#140). */
export interface MoneyExamples {
  amount: string;
  supplement: string;
  discount: string;
}

export function moneyExamples(locale: string, money?: Money): MoneyExamples {
  const scale = 10 ** moneyDecimals(money);
  // `hundredths` of a major unit (1250 is 12.50) in minor units of `money`: cut, but at least one of them.
  const example = (hundredths: number) => moneyFieldText(Math.trunc((hundredths * scale) / 100) || Math.sign(hundredths), locale, money);
  return { amount: example(1250), supplement: example(150), discount: example(-50) };
}

/** The field once the person leaves it: the page format when readable, as typed when not. */
export function normaliseMoneyText(text: string, locale: string, options: MoneyReadOptions = {}): string {
  const read = parseMoney(text, options);
  return read.ok && read.cents !== null ? moneyFieldText(read.cents, locale, options.money) : text;
}
