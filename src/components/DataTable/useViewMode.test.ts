import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { clearPage, crossBreakpoint, viewport } from './__tests__/harness';
import type { DataTableView } from './types';
import { useViewMode } from './useViewMode';

const FOLDED = { containerWidth: 720, contentWidth: 748 };

function mountView(options: { cards?: boolean; defaultView?: DataTableView } = {}) {
  const cards = ref(options.cards ?? true);
  const breakpoint = ref(640);
  const deps = ref(0);
  const shape = ref('six columns');
  const hostWidth = ref(720);
  const calls = { refit: 0, written: [] as unknown[] };
  let view: ReturnType<typeof useViewMode> | undefined;
  const Probe = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      view = useViewMode(
        {
          root,
          cardBreakpoint: () => breakpoint.value,
          cardViewEnabled: () => cards.value,
          defaultView: () => options.defaultView,
          deps: () => [deps.value],
          shape: () => shape.value,
        },
        (target, value) => {
          calls.written.push(value);
          target.value = value;
        },
        () => {
          calls.refit += 1;
        },
      );
      return () => h('div', { ref: root });
    },
  });
  const wrapper = mount(Probe);
  Object.defineProperty(wrapper.element, 'clientWidth', { configurable: true, get: () => hostWidth.value });
  return { wrapper, view: view as ReturnType<typeof useViewMode>, cards, breakpoint, deps, shape, hostWidth, calls };
}

afterEach(() => {
  clearPage();
});

describe('useViewMode: the phone and the starting view', () => {
  it('starts in cards on a phone when cards are enabled, as a list on a desk', () => {
    viewport(true);
    expect(mountView().view.viewMode.value).toBe('cards');
    expect(mountView({ cards: false }).view.viewMode.value, 'no cards declared').toBe('table');
    viewport(false);
    const { view } = mountView();
    expect([view.viewMode.value, view.isMobile.value]).toEqual(['table', false]);
  });

  it('the phone is cardBreakpoint px wide or less, asked again when the breakpoint changes', async () => {
    viewport(false);
    const matchMedia = vi.spyOn(window, 'matchMedia');
    const { breakpoint } = mountView();
    breakpoint.value = 900;
    await nextTick();
    expect(matchMedia.mock.calls.map(([query]) => query)).toEqual(['(max-width: 640px)', '(max-width: 900px)']);
  });

  it('crossing the breakpoint switches both ways; without cards the phone keeps the list', async () => {
    viewport(false);
    const { view } = mountView();
    crossBreakpoint(true);
    expect([view.viewMode.value, view.isMobile.value]).toEqual(['cards', true]);
    crossBreakpoint(false);
    expect([view.viewMode.value, view.isMobile.value]).toEqual(['table', false]);
    const listOnly = mountView({ cards: false }).view;
    crossBreakpoint(true);
    expect([listOnly.viewMode.value, listOnly.isMobile.value]).toEqual(['table', true]);
  });

  it('stops listening to the breakpoint once unmounted', () => {
    viewport(false);
    const removed: string[] = [];
    const stubbed = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({ ...stubbed(query), removeEventListener: () => removed.push(query) }));
    const { wrapper } = mountView();
    expect(removed).toEqual([]);
    wrapper.unmount();
    expect(removed).toEqual(['(max-width: 640px)']);
  });

  it('defaultView picks the starting view on a desk', () => {
    viewport(false);
    expect(mountView({ defaultView: 'cards' }).view.viewMode.value).toBe('cards');
    expect(mountView({ defaultView: 'table' }).view.viewMode.value).toBe('table');
  });

  it("the person's choice holds over later changes", async () => {
    viewport(true);
    const { view, cards } = mountView();
    expect(view.setViewMode('table')).toBe(true);
    expect(view.setViewMode('table'), 'no change, nothing to announce').toBe(false);
    cards.value = false;
    await nextTick();
    cards.value = true;
    await nextTick();
    expect(view.viewMode.value).toBe('table');
  });
});

describe('useViewMode: the hand-over to cards when the folded list does not fit', () => {
  it('hands over, and comes back once the box reaches the width the list needs', () => {
    viewport(false);
    const { view, hostWidth, calls } = mountView();
    view.measureCardsFit(FOLDED);
    expect([view.fitCards.value, view.viewMode.value]).toEqual([true, 'cards']);
    expect(calls.written).toEqual([true]);
    hostWidth.value = 747;
    view.measureCardsFit(null);
    expect(view.viewMode.value).toBe('cards');
    hostWidth.value = 748;
    view.measureCardsFit(null);
    expect([view.fitCards.value, view.viewMode.value]).toEqual([false, 'table']);
  });

  it('a list that starts as a list by defaultView="table" keeps the cards it hands over to', async () => {
    viewport(false);
    const { view } = mountView({ defaultView: 'table' });
    view.measureCardsFit(FOLDED);
    await nextTick();
    expect([view.fitCards.value, view.viewMode.value]).toEqual([true, 'cards']);
  });

  it('never hands over on a phone, after a choice by hand, with defaultView="cards" or without cards', () => {
    viewport(true);
    const phone = mountView().view;
    phone.measureCardsFit(FOLDED);
    expect(phone.fitCards.value).toBe(false);
    viewport(false);
    const chosen = mountView().view;
    chosen.setViewMode('table');
    chosen.measureCardsFit(FOLDED);
    expect([chosen.fitCards.value, chosen.viewMode.value]).toEqual([false, 'table']);
    for (const view of [mountView({ defaultView: 'cards' }).view, mountView({ cards: false }).view]) {
      view.measureCardsFit(FOLDED);
      expect(view.fitCards.value).toBe(false);
    }
  });

  it('a hand-over that stops being allowed is given back without moving the view chosen by hand', () => {
    viewport(false);
    const { view } = mountView();
    view.measureCardsFit(FOLDED);
    view.setViewMode('cards');
    view.measureCardsFit(null);
    expect([view.fitCards.value, view.viewMode.value]).toEqual([false, 'cards']);
  });
});

describe('useViewMode: other columns or actions', () => {
  it('take the fold decision again; the same shape keeps the cards the list handed over to', async () => {
    viewport(false);
    const { view, deps, calls } = mountView();
    view.measureCardsFit(FOLDED);
    deps.value += 1;
    await nextTick();
    expect(calls.refit).toBe(1);
    expect([view.fitCards.value, view.viewMode.value]).toEqual([true, 'cards']);
  });

  it('a new shape gives the hand-over back and shows the list, unless the person chose the view', async () => {
    viewport(false);
    const { view, deps, shape } = mountView();
    view.measureCardsFit(FOLDED);
    shape.value = 'five columns';
    deps.value += 1;
    await nextTick();
    expect([view.fitCards.value, view.viewMode.value]).toEqual([false, 'table']);
    const chosen = mountView();
    chosen.view.measureCardsFit(FOLDED);
    chosen.view.setViewMode('cards');
    chosen.shape.value = 'five columns';
    chosen.deps.value += 1;
    await nextTick();
    expect([chosen.view.fitCards.value, chosen.view.viewMode.value]).toEqual([false, 'cards']);
  });
});
