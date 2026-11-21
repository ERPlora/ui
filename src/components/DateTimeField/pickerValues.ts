// What DateField and TimeField keep and show: the ISO day or time out of what ion-datetime answers, the same
// value written in the person's language, where the calendar of that language starts its week and the minutes a
// time picker offers.

const FALLBACK_LOCALE = 'en';
const DAY = /^(\d{4}-\d{2}-\d{2})(?:T|$)/;
const TIME = /^(?:\d{4}-\d{2}-\d{2}T)?(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

function matched(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string') return '';
  return pattern.exec(value)?.[1] ?? '';
}

/** `YYYY-MM-DD` of a value of ion-datetime (which adds the time it shows to a picked day); `''` for none. */
export function isoDay(value: unknown): string {
  return matched(value, DAY);
}

/** `HH:MM` of a value of ion-datetime (alone, or after the day it adds when the field had none); `''` for none. */
export function isoTime(value: unknown): string {
  return matched(value, TIME);
}

function format(locale: string, options: Intl.DateTimeFormatOptions, at: number): string {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(at);
  } catch (error) {
    if (!(error instanceof RangeError) || locale === FALLBACK_LOCALE) throw error;
    return format(FALLBACK_LOCALE, options, at);
  }
}

/** The day in the numeric date of `locale` («23/11/2026», «11/23/2026»), read in UTC so no zone moves it. */
export function formatDay(day: string, locale: string): string {
  if (!isoDay(day)) return '';
  const [year, month, date] = day.split('-').map(Number);
  return format(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }, Date.UTC(year, month - 1, date));
}

/** The time on the clock of `locale`: «14:30» in Spanish, «02:30 PM» in English. */
export function formatTime(time: string, locale: string): string {
  if (!isoTime(time)) return '';
  const [hours, minutes] = time.split(':').map(Number);
  return format(locale, { hour: '2-digit', minute: '2-digit' }, Date.UTC(1970, 0, 1, hours, minutes));
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `time` on the device's local today (`YYYY-MM-DDTHH:MM`), the day ion-datetime takes as today. A time picker
 *  works on a full date: its bounds only apply to the day it shows, and ion-datetime 8 cannot read a bare `HH:MM`
 *  bound as it loads. */
export function todayAt(time: string | undefined): string | undefined {
  if (!isoTime(time)) return undefined;
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${time}`;
}

type WeekInfo = { firstDay: number };
type LocaleWithWeek = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };

/** The first day of the week of `locale` as ion-datetime counts it (0 = Sunday); Monday, the ISO week, when the
 *  browser cannot tell. */
export function firstDayOfWeek(locale: string): number {
  let info: WeekInfo | undefined;
  try {
    const tagged = new Intl.Locale(locale) as LocaleWithWeek;
    info = tagged.getWeekInfo?.() ?? tagged.weekInfo;
  } catch {
    info = undefined;
  }
  return info ? info.firstDay % 7 : 1;
}

/** The minutes from the hour every `step` minutes, as ion-datetime's `minuteValues` reads them; none for no step. */
export function minuteValues(step: number | undefined): string | undefined {
  if (!step || step <= 1 || !Number.isInteger(step)) return undefined;
  const values: number[] = [];
  for (let minute = 0; minute < 60; minute += step) values.push(minute);
  return values.join(',');
}
