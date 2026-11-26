import { describe, expect, it } from 'vitest';

import { formatQuantity, orderTicketQuantity, quantityWithUnit } from './quantity';

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

describe('quantityWithUnit', () => {
  it('writes a measure with its unit and a count of units without one', () => {
    expect(quantityWithUnit('0.532', 'kg', 'es')).toBe('0,532 kg');
    expect(quantityWithUnit('1.500', 'h', 'en')).toBe('1.5 h');
    expect(quantityWithUnit('2.000', 'ud', 'en')).toBe('2');
    expect(quantityWithUnit('2', '', 'en')).toBe('2');
  });

  it('groups the thousands as the bare quantity does', () => {
    expect(quantityWithUnit('1500.000', 'ud', 'es')).toBe('1.500');
    expect(quantityWithUnit('1250.500', 'kg', 'es')).toBe('1.250,5 kg');
  });
});

describe('orderTicketQuantity', () => {
  it('writes a count of units with its times sign and a measure with its unit, in the person’s language', () => {
    expect(orderTicketQuantity('2.000', 'ud', 'es')).toBe('2×');
    expect(orderTicketQuantity('2', '', 'en')).toBe('2×');
    expect(orderTicketQuantity('0.350', 'kg', 'es')).toBe('0,35 kg');
    expect(orderTicketQuantity('0.350', 'kg', 'en')).toBe('0.35 kg');
  });
});
