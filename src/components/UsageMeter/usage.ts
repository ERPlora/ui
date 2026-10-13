// The numbers a UsageMeter paints, as plain functions a page can share (e.g. to word a notice by
// the same tone): how full, the tone that says whether to worry, and the percentage and the amount
// in the person's language («12 %», «1,2 GB de 10 GB»). The language is a tag (`es`, `es-ES`); the
// «of» comes from this folder's catalogue in that language, English for any other.
import { shellLocale } from '../../shell/i18n';
import en from './locales/en.json';
import es from './locales/es.json';
import type { UsageAmount, UsageMeterTone } from './types';

const CATALOGUES = { en: en.usageMeter, es: es.usageMeter } as const;

/** The language of the app's source texts: what a malformed tag falls back to. */
const FALLBACK_LOCALE = 'en';

/** From here on the bar turns amber, and red (mockups: «Te queda poco espacio» at 82 %). */
const WARNING_FROM = 70;
const DANGER_FROM = 90;

const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * How full, in percent: `percent` when given, else `value / max`. Over the limit stays over (110),
 * so the text can say it; nothing to measure (no or non-positive max, a broken number) is 0.
 */
export function usagePercent({ value, max, percent }: UsageAmount): number {
  if (finite(percent)) return Math.max(0, percent);
  if (!finite(value) || !finite(max) || max <= 0) return 0;
  return Math.max(0, (value / max) * 100);
}

/** Green under 70 %, amber from 70 %, red from 90 %. */
export function usageTone(percent: number): UsageMeterTone {
  if (percent >= DANGER_FROM) return 'danger';
  if (percent >= WARNING_FROM) return 'warning';
  return 'success';
}

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch (error) {
    // A malformed language tag; anything else is a bug and still throws.
    if (!(error instanceof RangeError) || locale === FALLBACK_LOCALE) throw error;
    return new Intl.NumberFormat(FALLBACK_LOCALE, options);
  }
}

/** Whole percents («12 %», «12%»); under 1 % keeps a decimal, so a sliver never reads as empty. */
export function formatUsagePercent(percent: number, locale: string): string {
  const digits = percent > 0 && percent < 1 ? 1 : 0;
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(percent / 100);
}

/** A number with at most one decimal, grouped as the language does («1,2», «12.500»). */
export function formatUsageNumber(value: number, locale: string): string {
  return numberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/** «1,2 GB de 10 GB»: the amount and its limit, each with its unit (no line break before it). */
export function formatUsageValue(value: number, max: number, unit: string | undefined, locale: string): string {
  const amount = (n: number): string => (unit ? `${formatUsageNumber(n, locale)} ${unit}` : formatUsageNumber(n, locale));
  // Function replacers: a unit is free text and must not be read as a `$&` pattern.
  return CATALOGUES[shellLocale(locale)].of.replace('{value}', () => amount(value)).replace('{max}', () => amount(max));
}
