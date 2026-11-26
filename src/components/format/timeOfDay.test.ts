// `formatTimeOfDay`: a wall-clock time as the person's language writes it in a sentence, the same short time
// `formatDateTime` puts after its date. Whitespace is normalised: ICU versions differ on the space before «PM».
import { describe, expect, it } from 'vitest';

import * as components from '../index';
import { formatDateTime } from './dateTime';
import * as barrel from './index';
import { formatTimeOfDay } from './timeOfDay';

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatTimeOfDay', () => {
  it('is exported from its folder and from @erplora/ui/components', () => {
    expect(barrel.formatTimeOfDay).toBe(formatTimeOfDay);
    expect(components.formatTimeOfDay).toBe(formatTimeOfDay);
  });

  it('writes the time on the English clock', () => {
    expect(plain(formatTimeOfDay('18:00', 'en'))).toBe('6:00 PM');
    expect(plain(formatTimeOfDay('09:00', 'en'))).toBe('9:00 AM');
    expect(plain(formatTimeOfDay('00:30', 'en'))).toBe('12:30 AM');
  });

  it('writes the time on the Spanish clock', () => {
    expect(formatTimeOfDay('18:00', 'es')).toBe('18:00');
    expect(formatTimeOfDay('09:05', 'es')).toBe('9:05');
  });

  it('reads a stored time with its seconds', () => {
    expect(plain(formatTimeOfDay('18:00:00', 'en'))).toBe('6:00 PM');
  });

  it('is the short time formatDateTime writes after the date', () => {
    for (const locale of ['en', 'es']) {
      const dated = formatDateTime('2026-11-02T18:00:00Z', locale, { timeZone: 'UTC' });
      expect(dated.endsWith(formatTimeOfDay('18:00', locale)), locale).toBe(true);
    }
  });

  it('leaves what is no time as it came', () => {
    expect(formatTimeOfDay('', 'en')).toBe('');
    expect(formatTimeOfDay('soon', 'en')).toBe('soon');
    expect(formatTimeOfDay('25:00', 'es')).toBe('25:00');
  });

  it('an unsupported or malformed locale falls back to English instead of throwing', () => {
    expect(plain(formatTimeOfDay('18:00', 'not a locale!'))).toBe('6:00 PM');
  });
});
