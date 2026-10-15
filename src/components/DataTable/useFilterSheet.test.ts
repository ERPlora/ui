// The filters sheet of a phone or a portrait tablet (< 834 px) covers the content area, strictly between the
// app's header and its tab bar (outfitkit#75/#197): CSS cannot know where that area is, so the table measures
// the closest `ion-content` against the sheet's containing block (the `ion-page`, `contain: layout`) and hands
// both offsets to its stylesheet as custom properties, again on every resize while the sheet is open.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { crossBreakpoint, mockResizeObserver, ResizeObserverMock, viewport } from './__tests__/harness';
import { sheetInsets, trapTab, useFilterSheet } from './useFilterSheet';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** A rectangle as `getBoundingClientRect` returns it (only the edges the measure reads). */
const box = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;

/** `.ion-page > ion-content > div` with the given boxes; returns the innermost element. */
function page(pageBox: DOMRect | null, contentBox: DOMRect | null): HTMLElement {
  let parent: HTMLElement = document.body;
  if (pageBox) {
    const ionPage = document.createElement('div');
    ionPage.className = 'ion-page';
    ionPage.getBoundingClientRect = () => pageBox;
    parent.appendChild(ionPage);
    parent = ionPage;
  }
  if (contentBox) {
    const content = document.createElement('ion-content');
    content.getBoundingClientRect = () => contentBox;
    parent.appendChild(content);
    parent = content;
  }
  const host = document.createElement('div');
  parent.appendChild(host);
  return host;
}

function mountProbe(host: HTMLElement, open = ref(false)) {
  let sheet = ref(false);
  const Probe = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      sheet = useFilterSheet(() => root.value, () => open.value).sheet;
      return () => h('div', { ref: root, class: 'probe' });
    },
  });
  const wrapper = mount(Probe, { attachTo: host });
  return { wrapper, open, el: () => wrapper.element as HTMLElement, sheet: () => sheet.value };
}

const vars = (el: HTMLElement) => ({
  top: el.style.getPropertyValue('--data-table-sheet-top'),
  bottom: el.style.getPropertyValue('--data-table-sheet-bottom'),
  safe: el.style.getPropertyValue('--data-table-sheet-safe-bottom'),
});

describe('sheetInsets', () => {
  it('the content area inside the containing block: what the header takes above, what the tab bar takes below', () => {
    expect(sheetInsets(box(56, 778), box(0, 844))).toEqual({ top: 56, bottom: 66 });
  });

  it('measured from the containing block, not the window: an ion-page lower down moves nothing', () => {
    expect(sheetInsets(box(156, 878), box(100, 944))).toEqual({ top: 56, bottom: 66 });
  });

  it('rounds, and never goes negative (content scrolled under a translucent bar)', () => {
    expect(sheetInsets(box(-3.4, 850.6), box(0, 844))).toEqual({ top: 0, bottom: 0 });
    expect(sheetInsets(box(55.6, 777.5), box(0, 844))).toEqual({ top: 56, bottom: 67 });
  });
});

describe('useFilterSheet', () => {
  it('outfitkit#197: while open, the sheet ends above the tab bar (and the tab bar keeps the safe area)', async () => {
    const { open, el } = mountProbe(page(box(0, 844), box(56, 778)));
    await nextTick();
    expect(vars(el())).toEqual({ top: '', bottom: '', safe: '' });
    open.value = true;
    await nextTick();
    expect(vars(el())).toEqual({ top: '56px', bottom: '66px', safe: '0px' });
  });

  it('with nothing under the content the sheet reaches the edge and its own footer keeps the safe area', async () => {
    const { open, el } = mountProbe(page(box(0, 844), box(56, 844)));
    open.value = true;
    await nextTick();
    expect(vars(el())).toEqual({ top: '56px', bottom: '0px', safe: '' });
  });

  it('without an ion-content around (a page outside the shell) the sheet keeps both screen edges', async () => {
    vi.stubGlobal('innerHeight', 844);
    const { open, el } = mountProbe(page(null, null));
    open.value = true;
    await nextTick();
    expect(vars(el())).toEqual({ top: '0px', bottom: '0px', safe: '' });
  });

  it('without an ion-page the window is the containing block', async () => {
    vi.stubGlobal('innerHeight', 800);
    const { open, el } = mountProbe(page(null, box(44, 740)));
    open.value = true;
    await nextTick();
    expect(vars(el())).toEqual({ top: '44px', bottom: '60px', safe: '0px' });
  });

  it('measures again when the content resizes (a tab bar mounted late, a rotation) and when the window does', async () => {
    const observer = mockResizeObserver();
    const content = { top: 56, bottom: 844 };
    const host = page(box(0, 844), null);
    const ionContent = document.createElement('ion-content');
    ionContent.getBoundingClientRect = () => box(content.top, content.bottom);
    host.appendChild(ionContent);
    const inner = document.createElement('div');
    ionContent.appendChild(inner);
    const { open, el } = mountProbe(inner);
    open.value = true;
    await nextTick();
    expect(vars(el()).bottom).toBe('0px');
    content.bottom = 778;
    observer.fire();
    expect(vars(el())).toEqual({ top: '56px', bottom: '66px', safe: '0px' });
    content.top = 0;
    window.dispatchEvent(new Event('resize'));
    expect(vars(el()).top).toBe('0px');
    // The tab bar goes: the sheet reaches the edge again and its footer takes the safe area back.
    content.bottom = 844;
    observer.fire();
    expect(vars(el())).toEqual({ top: '0px', bottom: '0px', safe: '' });
  });

  it('closed or unmounted: the offsets go, and nothing is measured any more', async () => {
    const observer = mockResizeObserver();
    const content = { top: 56, bottom: 778 };
    const ionPage = page(box(0, 844), null);
    const ionContent = document.createElement('ion-content');
    ionContent.getBoundingClientRect = () => box(content.top, content.bottom);
    ionPage.appendChild(ionContent);
    const inner = document.createElement('div');
    ionContent.appendChild(inner);
    const { wrapper, open, el } = mountProbe(inner);
    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();
    expect(vars(el())).toEqual({ top: '', bottom: '', safe: '' });
    content.top = 10;
    observer.fire();
    window.dispatchEvent(new Event('resize'));
    expect(vars(el())).toEqual({ top: '', bottom: '', safe: '' });
    open.value = true;
    await nextTick();
    expect(vars(el()).top).toBe('10px');
    const removed = vi.spyOn(window, 'removeEventListener');
    wrapper.unmount();
    expect(removed).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('stops observing the content when it closes and when it is unmounted', async () => {
    mockResizeObserver();
    const disconnect = vi.spyOn(ResizeObserverMock.prototype, 'disconnect');
    const { wrapper, open } = mountProbe(page(box(0, 844), box(56, 778)));
    open.value = true;
    await nextTick();
    const opened = disconnect.mock.calls.length;
    open.value = false;
    await nextTick();
    expect(disconnect.mock.calls.length, 'on close').toBe(opened + 1);
    open.value = true;
    await nextTick();
    const reopened = disconnect.mock.calls.length;
    wrapper.unmount();
    expect(disconnect.mock.calls.length, 'on unmount').toBe(reopened + 1);
  });

  it('says whether the open panel is a sheet (below 834 px), following the breakpoint while open', async () => {
    viewport(true);
    const { open, sheet } = mountProbe(page(box(0, 844), box(56, 778)));
    expect(sheet()).toBe(false);
    open.value = true;
    await nextTick();
    expect(sheet()).toBe(true);
    crossBreakpoint(false);
    expect(sheet()).toBe(false);
    crossBreakpoint(true);
    expect(sheet()).toBe(true);
    open.value = false;
    await nextTick();
    expect(sheet()).toBe(false);
    viewport(false);
    open.value = true;
    await nextTick();
    expect(sheet()).toBe(false);
  });
});

describe('trapTab: Tab and Shift+Tab cycle inside the sheet', () => {
  function sheetWith(...html: string[]): HTMLElement[] {
    const sheet = document.createElement('aside');
    sheet.tabIndex = -1;
    sheet.innerHTML = html.join('');
    document.body.appendChild(sheet);
    return [sheet, ...sheet.querySelectorAll<HTMLElement>('[data-k]')];
  }
  const tab = (from: HTMLElement, sheet: HTMLElement, shiftKey = false) => {
    from.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    trapTab(sheet, ev);
    return ev;
  };

  it('from the last control Tab goes to the first; from the first Shift+Tab goes to the last', () => {
    const [sheet, first, , , last] = sheetWith(
      '<button data-k>Close</button>',
      '<button data-k disabled>Off</button>',
      '<input data-k>',
      '<button data-k>Apply</button>',
    );
    expect(tab(last, sheet).defaultPrevented).toBe(true);
    expect(document.activeElement === first).toBe(true);
    expect(tab(first, sheet, true).defaultPrevented).toBe(true);
    expect(document.activeElement === last).toBe(true);
  });

  it('in between it leaves Tab to the browser; from outside (the sheet itself) it starts at the first', () => {
    const [sheet, first, middle] = sheetWith('<button data-k>Close</button>', '<input data-k>', '<button data-k>Apply</button>');
    expect(tab(middle, sheet).defaultPrevented).toBe(false);
    expect(tab(sheet, sheet).defaultPrevented).toBe(true);
    expect(document.activeElement === first).toBe(true);
  });

  it('skips what cannot take the focus (disabled, tabindex -1)', () => {
    const [sheet, , focusable] = sheetWith('<span tabindex="-1" data-k>no</span>', '<button data-k>Only</button>', '<button data-k disabled>Off</button>');
    expect(tab(focusable, sheet).defaultPrevented).toBe(true);
    expect(document.activeElement === focusable).toBe(true);
  });
});
