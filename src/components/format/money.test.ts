// An amount as the person reads it: the server's minor unit of its currency (1250 is 12,50 €; ¥1,250 has no cents) in
// the business's currency with the symbol a till of that country prints; without a currency known yet, the amount
// alone. The Hub's panels and the assistant's card write money alike.
import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

const EUR = { currency: 'EUR', decimals: 2 };
const JPY = { currency: 'JPY', decimals: 0 };
const PLN = { currency: 'PLN', decimals: 2 };
// Intl writes a narrow no-break space before the symbol in Spanish; the screen shows it as a space.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatMoney', () => {
  it('writes the minor unit in the currency, with its own symbol and decimals', () => {
    expect(plain(formatMoney(1250, 'es-ES', EUR))).toBe('12,50 €');
    expect(plain(formatMoney(1250, 'en', JPY))).toBe('¥1,250');
    expect(plain(formatMoney(1250, 'pl-PL', PLN))).toBe('12,50 zł');
  });

  it('reads an amount the server sent as text', () => {
    expect(plain(formatMoney('1500', 'es-ES', EUR))).toBe('15,00 €');
  });

  it('without a currency known yet, the amount alone in cents', () => {
    expect(formatMoney(1250, 'en')).toBe('12.50');
  });

  it('what is no number stays as it came', () => {
    expect(formatMoney('n/a', 'en', EUR)).toBe('n/a');
    expect(formatMoney(' ', 'en', EUR)).toBe(' ');
  });
});
