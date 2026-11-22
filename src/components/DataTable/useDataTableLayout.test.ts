// The card/table switch is driven through a probe component and a stubbed `matchMedia`; the measured parts are
// covered with the real table in DataTable.layout.test.ts.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import type { DataTableView } from './types';
import { useDataTableLayout } from './useDataTableLayout';

// ── The card/table switch ─────────────────────────────────────────────────────────────────────

type MediaListener = (e: { matches: boolean }) => void;
let mediaListener: MediaListener | undefined;
const queries: string[] = [];

/** happy-dom has no matchMedia: the viewport is what this stub says; `change` can be fired. */
function viewport(mobile: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query);
    return {
      media: query,
      matches: mobile,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: MediaListener) => {
        mediaListener = listener;
      },
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  });
}

function probe(options: { cards?: boolean; defaultView?: DataTableView; breakpoint?: number } = {}) {
  const cards = ref(options.cards ?? true);
  const exposed: { setViewMode?: (mode: DataTableView) => boolean } = {};
  const Probe = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      const layout = useDataTableLayout({
        root,
        cardBreakpoint: () => options.breakpoint ?? 640,
        cardViewEnabled: () => cards.value,
        defaultView: () => options.defaultView,
        hasActions: () => false,
        deps: () => [],
        shape: () => '',
        fill: () => false,
      });
      exposed.setViewMode = layout.setViewMode;
      return () => h('div', { ref: root }, layout.viewMode.value);
    },
  });
  return { wrapper: mount(Probe), cards, exposed };
}

describe('useDataTableLayout: the table turns into cards on a phone', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mediaListener = undefined;
    queries.length = 0;
  });

  it('starts in cards on a phone when cards are enabled, as a table on a desk', () => {
    viewport(true);
    expect(probe().wrapper.text()).toBe('cards');
    viewport(false);
    expect(probe().wrapper.text()).toBe('table');
    viewport(true);
    expect(probe({ cards: false }).wrapper.text(), 'no cards declared: nothing to switch to').toBe('table');
  });

  it('the phone is `cardBreakpoint` px wide or less (640 by default)', () => {
    viewport(false);
    probe();
    probe({ breakpoint: 900 });
    expect(queries).toEqual(['(max-width: 640px)', '(max-width: 900px)']);
  });

  it('switches even when cards are enabled after the first render', async () => {
    viewport(true);
    const { wrapper, cards } = probe({ cards: false });
    expect(wrapper.text()).toBe('table');
    cards.value = true;
    await nextTick();
    expect(wrapper.text()).toBe('cards');
  });

  it('crossing the breakpoint switches both ways', async () => {
    viewport(false);
    const { wrapper } = probe();
    mediaListener?.({ matches: true });
    await nextTick();
    expect(wrapper.text()).toBe('cards');
    mediaListener?.({ matches: false });
    await nextTick();
    expect(wrapper.text()).toBe('table');
  });

  it('starts in cards with defaultView="cards"', () => {
    viewport(false);
    expect(probe({ defaultView: 'cards' }).wrapper.text()).toBe('cards');
  });

  it('once the person picks a view, a later change of props does not override it', async () => {
    viewport(true);
    const { wrapper, cards, exposed } = probe();
    expect(exposed.setViewMode?.('table')).toBe(true);
    expect(exposed.setViewMode?.('table'), 'no change, nothing to announce').toBe(false);
    cards.value = false;
    await nextTick();
    cards.value = true;
    await nextTick();
    expect(wrapper.text()).toBe('table');
  });
});
