import { describe, expect, it } from 'vitest';

import { formatQuantity } from './quantity';

describe('formatQuantity', () => {
  it('writes a number in the person’s language, up to three decimals and none it does not need', () => {
    expect(formatQuantity(6, 'es-ES')).toBe('6');
    expect(formatQuantity(2.5, 'es-ES')).toBe('2,5');
    expect(formatQuantity(1.23456, 'es-ES')).toBe('1,235');
    expect(formatQuantity(0.125, 'en')).toBe('0.125');
  });

  it('reads the text of a decimal the server sent, with its sign', () => {
    expect(formatQuantity('2.500', 'es-ES')).toBe('2,5');
    expect(formatQuantity('-1.250', 'es-ES')).toBe('-1,25');
    expect(formatQuantity('6', 'en')).toBe('6');
  });

  it('groups the thousands from four digits on, as an amount does (formatMoney)', () => {
    expect(formatQuantity(1500, 'es-ES')).toBe('1.500');
    expect(formatQuantity('12500.75', 'en')).toBe('12,500.75');
  });

  it('what is no number stays as it came', () => {
    expect(formatQuantity('seis', 'es-ES')).toBe('seis');
    expect(formatQuantity('', 'es-ES')).toBe('');
  });
});
