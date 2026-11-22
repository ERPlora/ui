// happy-dom lays nothing out: each child gets the box width and the scroll width a browser would measure.
import { afterEach, describe, expect, it } from 'vitest';

import { naturalActionsWidth, naturalCellWidth } from './naturalWidth';

interface Child {
  width: number;
  scrollWidth?: number;
  style?: string;
}

function box(style: string, children: Child[]): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('style', style);
  for (const child of children) {
    const span = document.createElement('span');
    if (child.style) span.setAttribute('style', child.style);
    span.getBoundingClientRect = () => ({ width: child.width }) as DOMRect;
    Object.defineProperty(span, 'scrollWidth', { configurable: true, get: () => child.scrollWidth ?? 0 });
    el.append(span);
  }
  // Styles are only computed for an element in the document.
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('naturalActionsWidth: the buttons of an actions box side by side', () => {
  it('adds each button with its inline margins, the gaps between them and the inline padding of the box', () => {
    const actions = box('column-gap: 4px; padding-left: 6px; padding-right: 10px', [
      { width: 40, style: 'margin-left: 2px; margin-right: 3px' },
      { width: 44 },
    ]);
    expect(naturalActionsWidth(actions)).toBe(45 + 44 + 4 + 6 + 10);
  });

  it('a button with no width takes no gap', () => {
    const actions = box('column-gap: 4px', [{ width: 40 }, { width: 0 }, { width: 44 }]);
    expect(naturalActionsWidth(actions)).toBe(40 + 4 + 44);
  });

  it('a box with nothing laid out takes nothing, whatever its padding', () => {
    expect(naturalActionsWidth(box('column-gap: 4px; padding-left: 6px; padding-right: 10px', []))).toBe(0);
    expect(naturalActionsWidth(box('padding-left: 6px', [{ width: 0 }]))).toBe(0);
  });

  it('reads the box of each button, not what overflows it', () => {
    expect(naturalActionsWidth(box('', [{ width: 40, scrollWidth: 90 }]))).toBe(40);
  });
});

describe('naturalCellWidth: the content of a cell on one line', () => {
  it('a text its box cuts counts whole', () => {
    const cell = box('column-gap: 8px; padding-left: 12px; padding-right: 12px', [
      { width: 80, scrollWidth: 120 },
      { width: 20, scrollWidth: 20 },
    ]);
    expect(naturalCellWidth(cell)).toBe(120 + 20 + 8 + 24);
  });

  it('a text that fits counts its box, with its inline margins', () => {
    const cell = box('', [{ width: 30, scrollWidth: 0, style: 'margin-left: 1px; margin-right: 2px' }]);
    expect(naturalCellWidth(cell)).toBe(33);
  });
});
