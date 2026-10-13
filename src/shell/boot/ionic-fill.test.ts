import { describe, expect, it, vi } from 'vitest';

import { bootIonicFillMode, FILL_MODE_CONTROLS } from './ionic-fill';

// hub#1060: `fill` only paints a box in Ionic's `md` mode, so a control declaring `fill`
// without a mode must be forced to `mode="md"` at registration time.
describe('bootIonicFillMode', () => {
  const make = (tag: string, attrs: Record<string, string> = {}): HTMLElement => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.body.appendChild(el);
    return el;
  };

  it('covers input, select and textarea', () => {
    expect(FILL_MODE_CONTROLS).toEqual(['ion-input', 'ion-select', 'ion-textarea']);
  });

  it('forces mode="md" on a control that declares fill, defined AFTER boot', () => {
    bootIonicFillMode(['ion-input', 'x-fill-textarea']);
    customElements.define('ion-input', class extends HTMLElement {});
    customElements.define('x-fill-textarea', class extends HTMLElement {});

    expect(make('ion-input', { fill: 'outline' }).getAttribute('mode')).toBe('md');
    expect(make('ion-input', { fill: 'solid' }).getAttribute('mode')).toBe('md');
    expect(make('x-fill-textarea', { fill: 'outline' }).getAttribute('mode')).toBe('md');
  });

  it('leaves controls without fill alone', () => {
    expect(make('ion-input').hasAttribute('mode')).toBe(false);
  });

  it('respects an explicit mode chosen by the author', () => {
    expect(make('ion-input', { fill: 'outline', mode: 'ios' }).getAttribute('mode')).toBe('ios');
  });

  it('still calls the original connectedCallback', () => {
    const connected = vi.fn();
    bootIonicFillMode(['x-fill-orig']);
    customElements.define(
      'x-fill-orig',
      class extends HTMLElement {
        connectedCallback(): void {
          connected();
        }
      },
    );
    make('x-fill-orig', { fill: 'outline' });
    expect(connected).toHaveBeenCalledTimes(1);
  });

  it('reports, instead of staying silent, when the tag was registered too early', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    customElements.define('x-fill-early', class extends HTMLElement {});
    bootIonicFillMode(['x-fill-early']);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('x-fill-early'));
    error.mockRestore();
  });
});
