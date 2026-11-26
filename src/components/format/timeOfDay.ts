// `formatTimeOfDay`: a wall-clock time (`HH:MM`, as the server keeps a schedule's time) as the person's language
// writes it in a sentence — «6:00 PM», «18:00» —, the same short time `formatDateTime` writes after its date. What is
// no time stays as it came.

const FALLBACK_LOCALE = 'en';
const TIME = /^(\d{2}):(\d{2})(?::\d{2})?$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string): Intl.DateTimeFormat {
  let found = formatters.get(locale);
  if (!found) {
    try {
      // Read in UTC: the time is the clock's, no zone of the device may move it.
      found = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'UTC' });
    } catch (error) {
      if (!(error instanceof RangeError) || locale === FALLBACK_LOCALE) throw error;
      found = formatter(FALLBACK_LOCALE);
    }
    formatters.set(locale, found);
  }
  return found;
}

export function formatTimeOfDay(time: string, locale: string): string {
  const match = TIME.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return time;
  return formatter(locale).format(Date.UTC(1970, 0, 1, hours, minutes));
}
