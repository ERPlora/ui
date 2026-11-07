// The reader of `MoneyInput` (the one money field of every form): what a person types or pastes («2,20», «1.234,56»,
// «€2.20», the screen's own «2,20 €» or «+1,00 zł»), read into whole minor units of the field's money with the
// server's rules: with both marks the rightmost one is the decimal one; never more decimals than the currency has
// (none in yen). «1.250» can be read two ways and says so; anything else that is not an amount says it is not. Its
// code or its symbol around the figure is read, another currency's is not; while the money is unknown, two decimals
// and no symbol to take away (never a euro by default). A price is never negative; a signed amount (a supplement) is
// read with its sign. On leaving the field it is rewritten in the page format, ungrouped.
import { describe, expect, it } from 'vitest';

import type { Money } from '../format';
import { moneyFieldText, normaliseMoneyText, parseMoney } from './money';

const EUR: Money = { currency: 'EUR', decimals: 2 };
const PLN: Money = { currency: 'PLN', decimals: 2 };
const JPY: Money = { currency: 'JPY', decimals: 0 };

describe('parseMoney', () => {
  it('reads the decimal comma and the decimal point', () => {
    expect(parseMoney('2,20')).toEqual({ ok: true, cents: 220 });
    expect(parseMoney('2.2')).toEqual({ ok: true, cents: 220 });
    expect(parseMoney('12')).toEqual({ ok: true, cents: 1200 });
    expect(parseMoney('0,05')).toEqual({ ok: true, cents: 5 });
  });

  it('with both marks the rightmost one is the decimal one', () => {
    expect(parseMoney('1.234,56')).toEqual({ ok: true, cents: 123456 });
    expect(parseMoney('1,234.56')).toEqual({ ok: true, cents: 123456 });
    expect(parseMoney('12.345.678,90')).toEqual({ ok: true, cents: 1234567890 });
    expect(parseMoney('1,2.3,4')).toEqual({ ok: false, reason: 'not_amount' });
  });

  it('reads what is pasted from the screen: the field’s currency sign or code, any case, and the spaces around', () => {
    expect(parseMoney('2,20 €', { money: EUR })).toEqual({ ok: true, cents: 220 });
    expect(parseMoney('€2.20', { money: EUR })).toEqual({ ok: true, cents: 220 });
    expect(parseMoney(' 1.234,56 € ', { money: EUR })).toEqual({ ok: true, cents: 123456 });
    expect(parseMoney('3 EUR', { money: EUR })).toEqual({ ok: true, cents: 300 });
    expect(parseMoney('12,50 zł', { money: PLN })).toEqual({ ok: true, cents: 1250 });
    expect(parseMoney('zł 12.50', { money: PLN })).toEqual({ ok: true, cents: 1250 });
    expect(parseMoney('PLN12.50', { money: PLN })).toEqual({ ok: true, cents: 1250 });
    expect(parseMoney('12,50 pln', { money: PLN })).toEqual({ ok: true, cents: 1250 });
  });

  it('another currency’s sign is not an amount of the field’s: a euro one in złoty, a sign before the money is known', () => {
    expect(parseMoney('12,50 €', { money: PLN })).toEqual({ ok: false, reason: 'not_amount' });
    expect(parseMoney('12,50 EUR', { money: PLN })).toEqual({ ok: false, reason: 'not_amount' });
    expect(parseMoney('2,20 €')).toEqual({ ok: false, reason: 'not_amount' });
    expect(parseMoney('¥1500')).toEqual({ ok: false, reason: 'not_amount' });
    expect(parseMoney('2,20')).toEqual({ ok: true, cents: 220 });
  });

  it('with the currency’s decimals, the server’s: in yen «150» is 150 yen and «1,5» is not an amount', () => {
    expect(parseMoney('150', { money: JPY })).toEqual({ ok: true, cents: 150 });
    expect(parseMoney('¥1500', { money: JPY })).toEqual({ ok: true, cents: 1500 });
    expect(parseMoney('¥2,450', { money: JPY })).toEqual({ ok: true, cents: 2450 });
    expect(parseMoney('1.250', { money: JPY })).toEqual({ ok: true, cents: 1250 });
    for (const text of ['1,5', '1,50', '0.5', '24,5']) {
      expect(parseMoney(text, { money: JPY }), text).toEqual({ ok: false, reason: 'not_amount' });
    }
  });

  it('a repeated single mark groups thousands', () => {
    expect(parseMoney('1.234.567')).toEqual({ ok: true, cents: 123456700 });
    expect(parseMoney('1,234,567')).toEqual({ ok: true, cents: 123456700 });
  });

  it('an empty field is no amount at all, not zero', () => {
    expect(parseMoney('')).toEqual({ ok: true, cents: null });
    expect(parseMoney('   ')).toEqual({ ok: true, cents: null });
    expect(parseMoney(' € ', { money: EUR })).toEqual({ ok: true, cents: null });
  });

  it('«1.250» can be read as 1.250 € or 1,25 €: says so with both readings', () => {
    expect(parseMoney('1.250')).toEqual({ ok: false, reason: 'ambiguous', grouped: 125000, decimal: 125 });
    expect(parseMoney('1,250')).toEqual({ ok: false, reason: 'ambiguous', grouped: 125000, decimal: 125 });
  });

  it('three decimals that a price cannot have are thousands; with zeros past the currency’s decimals, those decimals', () => {
    expect(parseMoney('1.234')).toEqual({ ok: true, cents: 123400 });
    expect(parseMoney('0,500')).toEqual({ ok: true, cents: 50 });
  });

  it('what is not an amount says so: letters, more decimals than the currency has, broken groups, a lone mark', () => {
    for (const text of ['abc', '2,2,2', '2.2345', '1.23.4', '12a', '2,', ',5', '-', '1.2345.678', '0.250.000']) {
      expect(parseMoney(text), text).toEqual({ ok: false, reason: 'not_amount' });
    }
  });

  it('more than fifteen digits is not an amount (beyond any price, no longer exact)', () => {
    expect(parseMoney('999999999999999', { money: JPY })).toEqual({ ok: true, cents: 999999999999999 });
    expect(parseMoney('9999999999999999', { money: JPY })).toEqual({ ok: false, reason: 'not_amount' });
  });

  it('a price is never negative: a minus says it cannot be, and the screen’s «+» is no price', () => {
    expect(parseMoney('-2')).toEqual({ ok: false, reason: 'negative' });
    expect(parseMoney(' -12,50 €', { money: EUR })).toEqual({ ok: false, reason: 'negative' });
    expect(parseMoney('−0,50')).toEqual({ ok: false, reason: 'negative' });
    expect(parseMoney('-1.250')).toEqual({ ok: false, reason: 'negative' });
    expect(parseMoney('-abc')).toEqual({ ok: false, reason: 'not_amount' });
    expect(parseMoney('+2')).toEqual({ ok: false, reason: 'not_amount' });
  });

  it('a signed amount (a supplement) may be a discount: a leading minus, or the screen’s «+», carries its sign', () => {
    const signed = { signed: true };
    expect(parseMoney('-2', signed)).toEqual({ ok: true, cents: -200 });
    expect(parseMoney(' -12,50 €', { ...signed, money: EUR })).toEqual({ ok: true, cents: -1250 });
    expect(parseMoney('−0,50', signed)).toEqual({ ok: true, cents: -50 });
    expect(parseMoney('+1,00 zł', { ...signed, money: PLN })).toEqual({ ok: true, cents: 100 });
    expect(parseMoney('-0,50 zł', { ...signed, money: PLN })).toEqual({ ok: true, cents: -50 });
    expect(parseMoney('-20', { ...signed, money: JPY })).toEqual({ ok: true, cents: -20 });
    expect(parseMoney('-1.250', signed)).toEqual({ ok: false, reason: 'ambiguous', grouped: -125000, decimal: -125 });
    for (const text of ['--2', '-', '+', '+-2', '-+2']) {
      expect(parseMoney(text, signed), text).toEqual({ ok: false, reason: 'not_amount' });
    }
  });
});

describe('moneyFieldText', () => {
  it('writes minor units for the field in the page format, ungrouped, with its sign', () => {
    expect(moneyFieldText(123456, 'es')).toBe('1234,56');
    expect(moneyFieldText(123456, 'en')).toBe('1234.56');
    expect(moneyFieldText(5, 'es')).toBe('0,05');
    expect(moneyFieldText(0, 'es')).toBe('0,00');
    expect(moneyFieldText(-50, 'es')).toBe('-0,50');
    expect(moneyFieldText(-1234, 'en')).toBe('-12.34');
    expect(moneyFieldText(null, 'es')).toBe('');
    expect(moneyFieldText(undefined, 'es')).toBe('');
  });

  it('with the decimals of the field’s currency: none in yen', () => {
    expect(moneyFieldText(2450, 'es', JPY)).toBe('2450');
    expect(moneyFieldText(-20, 'en', JPY)).toBe('-20');
    expect(moneyFieldText(250, 'es', PLN)).toBe('2,50');
  });
});

describe('normaliseMoneyText', () => {
  it('rewrites a readable amount in the page format and leaves anything else as typed', () => {
    expect(normaliseMoneyText('2.2', 'es')).toBe('2,20');
    expect(normaliseMoneyText('1.234,5 €', 'en', { money: EUR })).toBe('1234.50');
    expect(normaliseMoneyText('12,5 zł', 'en', { money: PLN })).toBe('12.50');
    expect(normaliseMoneyText('1.250', 'es', { money: JPY })).toBe('1250');
    expect(normaliseMoneyText('1.250', 'es')).toBe('1.250');
    expect(normaliseMoneyText('abc', 'es')).toBe('abc');
    expect(normaliseMoneyText('-0.5', 'es')).toBe('-0.5');
    expect(normaliseMoneyText('', 'es')).toBe('');
  });

  it('a signed amount keeps its sign; the screen’s «+» goes', () => {
    expect(normaliseMoneyText('-0.5', 'es', { signed: true })).toBe('-0,50');
    expect(normaliseMoneyText('+1,00 zł', 'es', { signed: true, money: PLN })).toBe('1,00');
  });
});
