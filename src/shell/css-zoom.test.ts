import { describe, expect, it } from 'vitest';

import { cssZoomOf } from './css-zoom';

function withZoom(value: unknown): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'currentCSSZoom', { value, configurable: true });
  return el;
}

describe('cssZoomOf', () => {
  it('is the zoom the browser paints the element with: the interface size on <html>', () => {
    expect(cssZoomOf(withZoom(1.2))).toBe(1.2);
    expect(cssZoomOf(withZoom(0.8))).toBe(0.8);
  });

  it('is 1 where the browser does not say it', () => {
    expect(cssZoomOf(document.createElement('div'))).toBe(1);
  });

  it('is 1 for a value that is not a zoom', () => {
    expect(cssZoomOf(withZoom(0))).toBe(1);
    expect(cssZoomOf(withZoom(Number.NaN))).toBe(1);
    expect(cssZoomOf(withZoom('1.2'))).toBe(1);
  });
});
