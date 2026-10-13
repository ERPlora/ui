// The numbers a UsageMeter paints (the «Usage» card of a business, mockups `business.html`): how
// full it is, the tone that says whether to worry (green under 70 %, amber from 70 %, red from
// 90 %), the percentage and the amount («1,2 GB de 10 GB») in the person's language.
import { describe, expect, it } from 'vitest';

import {
  formatUsageNumber,
  formatUsagePercent,
  formatUsageValue,
  usagePercent,
  usageTone,
} from './usage';

/** Intl separates number and unit with a no-break space in some languages: compare with spaces. */
const spaced = (text: string): string => text.replace(/[  ]/g, ' ');

describe('usagePercent', () => {
  it('is value over max, in percent', () => {
    expect(usagePercent({ value: 1.2, max: 10 })).toBeCloseTo(12);
    expect(usagePercent({ value: 3, max: 4 })).toBe(75);
  });

  it('a percentage given as such wins', () => {
    expect(usagePercent({ percent: 82 })).toBe(82);
    expect(usagePercent({ percent: 40, value: 9, max: 10 })).toBe(40);
  });

  it('over the limit says so (110 %), it is not capped', () => {
    expect(usagePercent({ value: 11, max: 10 })).toBeCloseTo(110);
  });

  it('nothing to measure is 0: no max, a zero or negative max, a missing or broken number', () => {
    expect(usagePercent({})).toBe(0);
    expect(usagePercent({ value: 3 })).toBe(0);
    expect(usagePercent({ value: 3, max: 0 })).toBe(0);
    expect(usagePercent({ value: 3, max: -5 })).toBe(0);
    expect(usagePercent({ value: Number.NaN, max: 10 })).toBe(0);
    expect(usagePercent({ value: null, max: null, percent: null })).toBe(0);
    expect(usagePercent({ percent: -4 })).toBe(0);
  });
});

describe('usageTone', () => {
  it.each([
    [0, 'success'],
    [69.9, 'success'],
    [70, 'warning'],
    [89.9, 'warning'],
    [90, 'danger'],
    [130, 'danger'],
  ] as const)('%s %% → %s', (percent, tone) => {
    expect(usageTone(percent)).toBe(tone);
  });
});

describe('formatUsagePercent', () => {
  it('whole percents in the person’s language', () => {
    expect(spaced(formatUsagePercent(12, 'es'))).toBe('12 %');
    expect(formatUsagePercent(12, 'en')).toBe('12%');
    expect(formatUsagePercent(82.4, 'en')).toBe('82%');
  });

  it('a sliver under 1 % keeps a decimal, so it never reads as empty', () => {
    expect(formatUsagePercent(0.4, 'en')).toBe('0.4%');
    expect(formatUsagePercent(0, 'en')).toBe('0%');
  });
});

describe('formatUsageNumber', () => {
  it('at most one decimal, grouped as the language does', () => {
    expect(formatUsageNumber(1.23, 'es')).toBe('1,2');
    expect(formatUsageNumber(12500, 'en')).toBe('12,500');
    expect(formatUsageNumber(12500, 'es')).toBe('12.500');
    expect(formatUsageNumber(3, 'en')).toBe('3');
  });

  it('a malformed language tag falls back to English instead of throwing', () => {
    expect(formatUsageNumber(1.5, 'not a tag!')).toBe('1.5');
  });
});

describe('formatUsageValue', () => {
  it('«1,2 GB de 10 GB» / «1.2 GB of 10 GB»', () => {
    expect(spaced(formatUsageValue(1.2, 10, 'GB', 'es'))).toBe('1,2 GB de 10 GB');
    expect(spaced(formatUsageValue(1.2, 10, 'GB', 'en'))).toBe('1.2 GB of 10 GB');
  });

  it('a region of the language reads its catalogue (`es-ES` → «de»)', () => {
    expect(spaced(formatUsageValue(3, 5, undefined, 'es-ES'))).toBe('3 de 5');
  });

  it('without a unit, bare numbers', () => {
    expect(formatUsageValue(3, 5, undefined, 'en')).toBe('3 of 5');
  });

  it('never breaks a line between a number and its unit', () => {
    expect(formatUsageValue(1.2, 10, 'GB', 'en')).toBe('1.2 GB of 10 GB');
  });
});
