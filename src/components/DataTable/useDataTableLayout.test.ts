// The DataTable's layout decisions. The two deciders are PURE on purpose (happy-dom lays nothing
// out): their cases are the ones of OutfitKit's narrow-tablet-row-actions (#122) and
// cards-when-table-does-not-fit (#267) tests, verbatim. The card/table switch is driven through a
// probe component and a stubbed `matchMedia`; the measured parts are covered with the real table in
// DataTable.layout.test.ts.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import type { DataTableView } from './types';
import { decideCardsForFit, decideFitLevel, decideRowActionsFit, useDataTableLayout } from './useDataTableLayout';

// ── decideRowActionsFit (#122) ────────────────────────────────────────────────────────────────

/** Six bookings columns at their 88px floor + gaps + padding: 6x88 + 6x8 + 32. */
const COLUMNS_MIN = 608;
const EXPANDED_ACTIONS = 188; // 4 x 44px + 3 x 4px gap, measured <=834px
const COLLAPSED_ACTIONS = 44; // one "..." button at the touch floor
const contentWidth = (containerWidth: number, actionsPx: number): number => Math.max(COLUMNS_MIN + actionsPx, containerWidth);

/** Runs the decision as the component does until it stops moving; returns how many passes it took. */
function settle(containerWidth: number, from = { collapsed: false, decidedAtWidth: -1 }) {
  let state = from;
  let steps = 0;
  for (let i = 0; i < 10; i++) {
    const actionsPx = state.collapsed ? COLLAPSED_ACTIONS : EXPANDED_ACTIONS;
    const next = decideRowActionsFit({
      containerWidth,
      contentWidth: contentWidth(containerWidth, actionsPx),
      collapsed: state.collapsed,
      decidedAtWidth: state.decidedAtWidth,
    });
    steps++;
    if (next.collapsed === state.collapsed && next.decidedAtWidth === state.decidedAtWidth) break;
    state = next;
  }
  return { ...state, steps };
}

describe('decideRowActionsFit: on a narrow tablet the row actions do not eat a column (#122)', () => {
  it('collapses exactly at the widths where the six columns do not fit', () => {
    for (const width of [640, 700, 720, 768, 795]) expect(settle(width).collapsed, `${width}px`).toBe(true);
  });

  it('leaves the counter tablet and the desktop alone', () => {
    for (const width of [834, 1024, 1440]) expect(settle(width).collapsed, `${width}px`).toBe(false);
  });

  it('once collapsed the table fits from 652px up', () => {
    for (const width of [652, 700, 720, 768, 795]) {
      const state = settle(width);
      expect(contentWidth(width, state.collapsed ? COLLAPSED_ACTIONS : EXPANDED_ACTIONS)).toBeLessThanOrEqual(width);
    }
  });

  it('settles and does not flip back and forth', () => {
    for (const width of [640, 700, 795, 834]) expect(settle(width).steps, `${width}px`).toBeLessThanOrEqual(3);
    const settled = settle(700);
    expect(
      decideRowActionsFit({ containerWidth: 700, contentWidth: contentWidth(700, COLLAPSED_ACTIONS), ...settled }),
    ).toEqual({ collapsed: true, decidedAtWidth: 700 });
  });

  it('a wider hole re-judges with the buttons out again', () => {
    const narrow = settle(700);
    expect(settle(1024, { collapsed: narrow.collapsed, decidedAtWidth: narrow.decidedAtWidth }).collapsed).toBe(false);
  });

  it('a hole that gets its width while the buttons are already out is decided in ONE measurement', () => {
    expect(decideRowActionsFit({ containerWidth: 700, contentWidth: 748, collapsed: false, decidedAtWidth: -1 })).toEqual({
      collapsed: true,
      decidedAtWidth: 700,
    });
    expect(decideRowActionsFit({ containerWidth: 700, contentWidth: 796, collapsed: false, decidedAtWidth: 900 })).toEqual({
      collapsed: true,
      decidedAtWidth: 700,
    });
    expect(decideRowActionsFit({ containerWidth: 834, contentWidth: 834, collapsed: false, decidedAtWidth: -1 })).toEqual({
      collapsed: false,
      decidedAtWidth: 834,
    });
    expect(decideRowActionsFit({ containerWidth: 700, contentWidth: 700, collapsed: true, decidedAtWidth: 640 })).toEqual({
      collapsed: false,
      decidedAtWidth: 700,
    });
  });

  it('an unmeasured table (no layout yet) keeps the buttons out', () => {
    expect(decideRowActionsFit({ containerWidth: 0, contentWidth: 0, collapsed: false, decidedAtWidth: -1 })).toEqual({
      collapsed: false,
      decidedAtWidth: -1,
    });
  });
});

// ── decideFitLevel (W-19) ─────────────────────────────────────────────────────────────────────

describe('decideFitLevel: the list gives up one step at a time, judged by its box (W-19)', () => {
  /** A ladder of 3 steps; the box needs `need[level]` px at each level. */
  function run(containerWidth: number, need: number[], from = { level: 0, decidedAtWidth: -1 }) {
    let state = from;
    let steps = 0;
    for (let i = 0; i < 10; i++) {
      const next = decideFitLevel({ containerWidth, contentWidth: Math.max(need[state.level], containerWidth), steps: need.length - 1, settled: true, ...state });
      steps++;
      if (next.level === state.level && next.decidedAtWidth === state.decidedAtWidth) break;
      state = next;
    }
    return { ...state, steps };
  }
  const NEED = [792, 592, 552, 512];

  it('stops at the first level that fits, one step per settled measurement', () => {
    expect(run(900, NEED).level).toBe(0);
    expect(run(700, NEED).level).toBe(1);
    expect(run(560, NEED).level).toBe(2);
    expect(run(520, NEED).level).toBe(3);
    expect(run(480, NEED).level, 'never past the last step').toBe(3);
    expect(run(480, NEED).steps).toBeLessThanOrEqual(4);
  });

  it('a new width starts from scratch; a measurement of a level not on screen yet takes no step', () => {
    expect(decideFitLevel({ containerWidth: 900, contentWidth: 900, level: 3, steps: 3, decidedAtWidth: 520, settled: true })).toEqual({
      level: 0,
      decidedAtWidth: 900,
    });
    expect(decideFitLevel({ containerWidth: 700, contentWidth: 792, level: 0, steps: 3, decidedAtWidth: -1, settled: false })).toEqual({
      level: 1,
      decidedAtWidth: 700,
    });
    expect(decideFitLevel({ containerWidth: 700, contentWidth: 792, level: 1, steps: 3, decidedAtWidth: 700, settled: false })).toEqual({
      level: 1,
      decidedAtWidth: 700,
    });
    expect(decideFitLevel({ containerWidth: 700, contentWidth: 792, level: 1, steps: 3, decidedAtWidth: 700, settled: true })).toEqual({
      level: 2,
      decidedAtWidth: 700,
    });
  });

  it('no ladder, or no width yet: nothing moves', () => {
    expect(decideFitLevel({ containerWidth: 480, contentWidth: 792, level: 0, steps: 0, decidedAtWidth: -1, settled: true })).toEqual({
      level: 0,
      decidedAtWidth: 480,
    });
    expect(decideFitLevel({ containerWidth: 0, contentWidth: 0, level: 2, steps: 3, decidedAtWidth: 700, settled: true })).toEqual({
      level: 2,
      decidedAtWidth: 700,
    });
  });

  it('a one-step ladder is exactly decideRowActionsFit (#122)', () => {
    for (const [containerWidth, contentWidth, collapsed, decidedAtWidth] of [
      [700, 748, false, -1],
      [700, 796, false, 900],
      [834, 834, false, -1],
      [700, 700, true, 640],
      [700, 796, false, 700],
      [700, 652, true, 700],
      [0, 0, false, -1],
    ] as const) {
      const fold = decideRowActionsFit({ containerWidth, contentWidth, collapsed, decidedAtWidth });
      const level = decideFitLevel({ containerWidth, contentWidth, level: collapsed ? 1 : 0, steps: 1, decidedAtWidth, settled: true });
      expect({ collapsed: level.level === 1, decidedAtWidth: level.decidedAtWidth }).toEqual(fold);
    }
  });
});

// ── decideCardsForFit (#267) ──────────────────────────────────────────────────────────────────

const FOLDED_MIN = 748;
const idle = { fitCards: false, fitWidth: 0 };

describe('decideCardsForFit: the list hands over to cards only when it cannot fit (#267)', () => {
  it('folded and still overflowing -> cards, remembering the width the list needs (host extras included)', () => {
    expect(
      decideCardsForFit({ allowed: true, hostWidth: 720, folded: { containerWidth: 720, contentWidth: FOLDED_MIN }, ...idle }),
    ).toEqual({ fitCards: true, fitWidth: 748 });
    expect(
      decideCardsForFit({ allowed: true, hostWidth: 722, folded: { containerWidth: 720, contentWidth: FOLDED_MIN }, ...idle }),
    ).toEqual({ fitCards: true, fitWidth: 750 });
  });

  it('a list that fits folded stays a list', () => {
    for (const w of [752, 820, 1168]) {
      expect(decideCardsForFit({ allowed: true, hostWidth: w, folded: { containerWidth: w, contentWidth: w }, ...idle })).toEqual(idle);
    }
  });

  it('never hands over when not allowed, and gives a hand-over back the moment it stops being allowed', () => {
    expect(
      decideCardsForFit({ allowed: false, hostWidth: 720, folded: { containerWidth: 720, contentWidth: FOLDED_MIN }, ...idle }),
    ).toEqual(idle);
    expect(decideCardsForFit({ allowed: false, hostWidth: 720, folded: null, fitCards: true, fitWidth: 748 })).toEqual(idle);
  });

  it('judges only a folded, settled measurement; no width decides nothing', () => {
    expect(decideCardsForFit({ allowed: true, hostWidth: 720, folded: null, ...idle })).toEqual(idle);
    expect(
      decideCardsForFit({ allowed: true, hostWidth: 0, folded: { containerWidth: 0, contentWidth: FOLDED_MIN }, ...idle }),
    ).toEqual(idle);
    expect(decideCardsForFit({ allowed: true, hostWidth: 0, folded: null, fitCards: true, fitWidth: 748 })).toEqual({
      fitCards: true,
      fitWidth: 748,
    });
  });

  it('in cards, goes back to the list exactly when the hole reaches the remembered width, and settles', () => {
    const inCards = { allowed: true, folded: null, fitCards: true, fitWidth: 748 };
    expect(decideCardsForFit({ ...inCards, hostWidth: 747 })).toEqual({ fitCards: true, fitWidth: 748 });
    expect(decideCardsForFit({ ...inCards, hostWidth: 748 })).toEqual(idle);
    let s = decideCardsForFit({ allowed: true, hostWidth: 720, folded: { containerWidth: 720, contentWidth: FOLDED_MIN }, ...idle });
    for (let i = 0; i < 3; i++) s = decideCardsForFit({ allowed: true, hostWidth: 720, folded: null, ...s });
    expect(s.fitCards).toBe(true);
    s = decideCardsForFit({ allowed: true, hostWidth: 748, folded: null, ...s });
    expect(s.fitCards).toBe(false);
    s = decideCardsForFit({ allowed: true, hostWidth: 748, folded: { containerWidth: 748, contentWidth: FOLDED_MIN }, ...s });
    expect(s.fitCards).toBe(false);
  });
});

// ── The card/table switch (#274) ──────────────────────────────────────────────────────────────

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

describe('useDataTableLayout: the table turns into cards on a phone (#274)', () => {
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

  it('the phone is `cardBreakpoint` px wide or less (640 by default, as the Lit original)', () => {
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
