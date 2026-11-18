import { describe, expect, it } from 'vitest';

import { fitWholeRows, wholeRowsHeight } from './fitWholeRows';

describe('wholeRowsHeight', () => {
  it('returns no cap when every row fits', () => {
    expect(wholeRowsHeight(300, [40, 80, 80, 80])).toBeUndefined();
  });

  it('caps the scroll area before a partially visible row', () => {
    expect(wholeRowsHeight(220, [40, 80, 80, 140])).toBe(200);
  });

  it('keeps the first row whole even when it is taller than the available area', () => {
    expect(wholeRowsHeight(100, [40, 140, 80])).toBe(180);
  });
});

describe('fitWholeRows', () => {
  it('applies the cap only to a filled desktop list and clears it otherwise', () => {
    const scroll = document.createElement('div');
    scroll.innerHTML = '<div class="data-table__row data-table__row--head"></div><div class="data-table__row data-table__row--data"></div><div class="data-table__row data-table__row--data"></div><div class="data-table__row data-table__row--data"></div>';
    Object.defineProperty(scroll, 'clientHeight', { configurable: true, get: () => 150 });
    const rows = [...scroll.querySelectorAll('.data-table__row')];
    rows.forEach((row) => Object.defineProperty(row, 'offsetHeight', { configurable: true, get: () => 80 }));
    fitWholeRows(scroll, true);
    expect(scroll.style.maxHeight).toBe('160px');
    fitWholeRows(scroll, false);
    expect(scroll.style.maxHeight).toBe('');
  });
});
