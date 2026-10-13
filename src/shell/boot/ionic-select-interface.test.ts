import { describe, expect, it, vi } from 'vitest';

import { bootIonicSelectInterface } from './ionic-select-interface';

// hub#2223: a single-choice select opens a popover (closes on pick) instead of Ionic's alert.
class FakeSelect extends HTMLElement {
  interface = 'alert';
  multiple = false;
  opened: Array<{ interface: string; ev?: Event }> = [];
  async open(ev?: Event): Promise<void> {
    this.opened.push({ interface: this.interface, ev });
  }
}

const mount = (tag: string, setup?: (el: FakeSelect) => void): FakeSelect => {
  const el = document.createElement(tag) as FakeSelect;
  setup?.(el);
  document.body.appendChild(el);
  return el;
};

describe('bootIonicSelectInterface', () => {
  bootIonicSelectInterface(['x-sel']);
  customElements.define('x-sel', class extends FakeSelect {});

  it('opens a single select as a popover', async () => {
    const el = mount('x-sel');
    await el.open();
    expect(el.opened[0].interface).toBe('popover');
  });

  it('keeps the alert for a multiple select', async () => {
    const el = mount('x-sel', (e) => {
      e.multiple = true;
    });
    await el.open();
    expect(el.opened[0].interface).toBe('alert');
  });

  it('respects an interface chosen in markup, alert included', async () => {
    const el = mount('x-sel', (e) => e.setAttribute('interface', 'alert'));
    await el.open();
    expect(el.opened[0].interface).toBe('alert');
  });

  it('respects an interface chosen from JS', async () => {
    const el = mount('x-sel', (e) => {
      e.interface = 'action-sheet';
    });
    await el.open();
    expect(el.opened[0].interface).toBe('action-sheet');
  });

  it('anchors the popover to the select itself (hub#2237)', async () => {
    const el = mount('x-sel');
    await el.open(new Event('click'));
    const ev = el.opened[0].ev as Event & { detail: { ionShadowTarget?: unknown } };
    expect(ev.detail.ionShadowTarget).toBe(el);
  });

  it('also patches a tag that was registered before the boot (it wraps a method)', async () => {
    customElements.define('x-sel-early', class extends FakeSelect {});
    bootIonicSelectInterface(['x-sel-early']);
    const el = mount('x-sel-early');
    await el.open();
    expect(el.opened[0].interface).toBe('popover');
  });

  it('says so when the element has no open() to wrap', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    bootIonicSelectInterface(['x-sel-noopen']);
    customElements.define('x-sel-noopen', class extends HTMLElement {});
    expect(error).toHaveBeenCalledWith(expect.stringContaining('open()'));
    error.mockRestore();
  });
});
