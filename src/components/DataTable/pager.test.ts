import { describe, expect, it } from 'vitest';

import { entityWord, pageList } from './pager';

describe('pageList: numbered pager with gaps', () => {
  it('lists every page up to 7, and first/last/neighbours with «…» beyond', () => {
    expect(pageList(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageList(1, 52)).toEqual([1, 2, 3, '…', 52]);
    expect(pageList(26, 52)).toEqual([1, '…', 25, 26, 27, '…', 52]);
    expect(pageList(52, 52)).toEqual([1, '…', 50, 51, 52]);
  });
});

describe('entityWord: the noun of the footer count', () => {
  it('`{ one, many }` by the count; a function gets the count; nothing gives nothing', () => {
    expect(entityWord(1, { one: 'negocio', many: 'negocios' })).toBe('negocio');
    expect(entityWord(0, { one: 'negocio', many: 'negocios' })).toBe('negocios');
    expect(entityWord(4, { one: 'negocio', many: 'negocios' })).toBe('negocios');
    expect(entityWord(12, (n) => `factura${n === 1 ? '' : 's'}`)).toBe('facturas');
    expect(entityWord(3, undefined)).toBeUndefined();
  });
});
