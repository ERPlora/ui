// `formatDateTime`: the one way a page shows a date and time — medium date + short time in the
// person's language («Oct 13, 2026, 10:05 AM», «13 oct 2026, 10:05»), in the device's time zone.
// Pages call it from a cell or a template; they never format by hand.

export interface FormatDateTimeOptions {
  /** IANA time zone; the device's by default (tests pin it). */
  timeZone?: string;
}

/** The language of the app's source texts: what a missing or broken locale falls back to. */
const FALLBACK_LOCALE = 'en';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, timeZone: string | undefined): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone ?? ''}`;
  let found = formatters.get(key);
  if (!found) {
    const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short', timeZone };
    try {
      found = new Intl.DateTimeFormat(locale, options);
    } catch (error) {
      // A malformed language tag; a bad time zone is the caller's bug and still throws.
      if (!(error instanceof RangeError) || locale === FALLBACK_LOCALE) throw error;
      found = formatter(FALLBACK_LOCALE, timeZone);
    }
    formatters.set(key, found);
  }
  return found;
}

/**
 * `value` (an ISO 8601 string or a `Date`) in `locale` — `<html lang>` when omitted. Nothing to
 * show gives `''`; a value that is not a date is returned as it came (never «Invalid Date»).
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  locale?: string,
  options: FormatDateTimeOptions = {},
): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  const language = locale || (typeof document === 'undefined' ? '' : document.documentElement.lang) || FALLBACK_LOCALE;
  return formatter(language, options.timeZone).format(date);
}
