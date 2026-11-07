import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import * as entry from './index';
import { moneyFieldText, normaliseMoneyText, parseMoney } from './money';
import MoneyInput from './MoneyInput.vue';

describe('MoneyInput entry points', () => {
  it('the folder exports the field and its reader', () => {
    expect([entry.MoneyInput, entry.parseMoney, entry.moneyFieldText, entry.normaliseMoneyText]).toEqual([
      MoneyInput,
      parseMoney,
      moneyFieldText,
      normaliseMoneyText,
    ]);
  });

  it('they are part of `@erplora/ui/components` and of the package root', () => {
    for (const name of ['MoneyInput', 'parseMoney', 'moneyFieldText', 'normaliseMoneyText']) {
      expect((components as Record<string, unknown>)[name], name).toBe((entry as Record<string, unknown>)[name]);
      expect((root as Record<string, unknown>)[name], name).toBe((entry as Record<string, unknown>)[name]);
    }
  });
});
