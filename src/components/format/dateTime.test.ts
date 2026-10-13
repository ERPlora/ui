// `formatDateTime`: the one way a page shows a date and time (pages never format by hand). Medium
// date + short time in the person's language, in the device's time zone; `<html lang>` when no
// locale is passed. Whitespace is normalised: ICU versions differ on the space before «AM».
import { afterEach, describe, expect, it } from 'vitest';

import * as components from '../index';
import { formatDateTime } from './dateTime';
import * as barrel from './index';

const ISO = '2026-10-13T10:05:00Z';
const plain = (text: string) => text.replace(/\s/g, ' ');

afterEach(() => {
  document.documentElement.lang = '';
});

describe('formatDateTime', () => {
  it('is exported from its folder and from @erplora/ui/components', () => {
    expect(barrel.formatDateTime).toBe(formatDateTime);
    expect(components.formatDateTime).toBe(formatDateTime);
  });

  it('paints an ISO instant as a medium date and a short time in English', () => {
    expect(plain(formatDateTime(ISO, 'en', { timeZone: 'UTC' }))).toBe('Oct 13, 2026, 10:05 AM');
  });

  it('paints it in Spanish', () => {
    expect(plain(formatDateTime(ISO, 'es', { timeZone: 'UTC' }))).toBe('13 oct 2026, 10:05');
  });

  it('uses the time zone it is given (the device one by default)', () => {
    expect(plain(formatDateTime(ISO, 'es', { timeZone: 'Europe/Madrid' }))).toBe('13 oct 2026, 12:05');
    const device = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ISO));
    expect(formatDateTime(ISO, 'es')).toBe(device);
  });

  it('takes a Date as well as an ISO string', () => {
    expect(plain(formatDateTime(new Date(ISO), 'en', { timeZone: 'UTC' }))).toBe('Oct 13, 2026, 10:05 AM');
  });

  it('without a locale follows <html lang>', () => {
    document.documentElement.lang = 'es';
    expect(plain(formatDateTime(ISO, undefined, { timeZone: 'UTC' }))).toBe('13 oct 2026, 10:05');
    document.documentElement.lang = 'en';
    expect(plain(formatDateTime(ISO, undefined, { timeZone: 'UTC' }))).toBe('Oct 13, 2026, 10:05 AM');
  });

  it('an unsupported or malformed locale falls back to English instead of throwing', () => {
    expect(plain(formatDateTime(ISO, 'not a locale!', { timeZone: 'UTC' }))).toBe('Oct 13, 2026, 10:05 AM');
  });

  it('nothing to show paints nothing; an unreadable value is shown as it came, never «Invalid Date»', () => {
    expect(formatDateTime(null, 'en')).toBe('');
    expect(formatDateTime(undefined, 'en')).toBe('');
    expect(formatDateTime('', 'en')).toBe('');
    expect(formatDateTime('yesterday', 'en')).toBe('yesterday');
  });
});
