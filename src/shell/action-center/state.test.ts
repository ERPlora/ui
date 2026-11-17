import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createState, createView, resetState, watchLeaving } from './state';
import type { StateOptions } from './state';
import type { ActionNotice, NoticeSeverity } from './types';

function notice(id: string, severity: NoticeSeverity = 'warning', extra: Partial<ActionNotice> = {}): ActionNotice {
  return { id, severity, icon: 'ion:alert-circle-outline', label: id, title: id, ...extra };
}

function setup(options: StateOptions = {}) {
  const state = createState(options);
  const view = createView(state);
  watchLeaving(state, view);
  return { state, view };
}

const ids = (list: readonly ActionNotice[]): string[] => list.map((each) => each.id);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the times of the state', () => {
  it('by default, a card 4 s, a solved notice 1.2 s and «all clear» 1.8 s', () => {
    const { state } = setup();
    state.arrivals.offer(notice('printer'));
    state.linger.add([notice('cash')]);
    state.allClear.start();
    vi.advanceTimersByTime(1199);
    expect(state.linger.ids.value.has('cash')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state.linger.ids.value.has('cash')).toBe(false);
    vi.advanceTimersByTime(599);
    expect(state.allClear.active.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state.allClear.active.value).toBe(false);
    vi.advanceTimersByTime(2199);
    expect(state.arrivals.current.value?.id).toBe('printer');
    vi.advanceTimersByTime(1);
    expect(state.arrivals.current.value).toBeUndefined();
  });

  it('the ones the options give', () => {
    const { state } = setup({ arrivalMs: 10, resolvedMs: 20, allClearMs: 30 });
    state.arrivals.offer(notice('printer'));
    state.linger.add([notice('cash')]);
    state.allClear.start();
    vi.advanceTimersByTime(30);
    expect([state.arrivals.current.value, state.linger.items.value, state.allClear.active.value]).toEqual([undefined, [], false]);
  });

  it('a card that settles makes the bell pulse, and «all clear» closes the panel when done', () => {
    const { state } = setup();
    state.arrivals.offer(notice('printer'));
    state.arrivals.settle();
    expect(state.pulse.value).toBe(1);
    state.open.value = true;
    state.allClear.start();
    vi.advanceTimersByTime(1800);
    expect(state.open.value).toBe(false);
  });
});

describe('the view of the state', () => {
  it('shows the pending notices and the solved ones still lingering, in order', () => {
    const { state, view } = setup();
    state.latest.value = [notice('card', 'info'), notice('cash')];
    state.linger.add([notice('invoice', 'danger')]);
    expect(ids(view.shown.value)).toEqual(['invoice', 'cash', 'card']);
  });

  it('features the chosen notice, or the first; the rest are the rows', () => {
    const { state, view } = setup();
    state.latest.value = [notice('invoice', 'danger'), notice('cash'), notice('card', 'info')];
    expect(view.featured.value?.id).toBe('invoice');
    state.chosen.value = 'cash';
    expect(view.featured.value?.id).toBe('cash');
    expect(ids(view.rows.value)).toEqual(['invoice', 'card']);
  });

  it('sums up the bell at the time of the state', () => {
    const { state, view } = setup();
    const due = { at: '2026-11-20T00:00:00Z', from: '2026-11-10T00:00:00Z' };
    state.latest.value = [notice('invoice', 'danger', { due, count: 2 })];
    state.time.value = Date.parse('2026-11-15T00:00:00Z');
    expect(view.summary.value).toMatchObject({ total: 2, topSeverity: 'danger', dueProgress: 0.5 });
  });

  it('the card shows the latest version of its notice, or the one it came with once it is gone', () => {
    const { state, view } = setup();
    const first = notice('printer', 'warning', { chip: 'offline' });
    state.arrivals.offer(first);
    state.latest.value = [notice('printer', 'warning', { chip: 'offline for 5 min' })];
    expect(view.arrival.value?.chip).toBe('offline for 5 min');
    state.latest.value = [];
    expect(view.arrival.value).toBe(first);
  });
});

describe('when notices leave', () => {
  it('the chosen one is forgotten once it is no longer shown', () => {
    const { state, view } = setup();
    state.latest.value = [notice('invoice', 'danger'), notice('cash')];
    state.chosen.value = 'cash';
    state.latest.value = [notice('invoice', 'danger')];
    expect(state.chosen.value).toBeUndefined();
    state.latest.value = [notice('invoice', 'danger'), notice('cash')];
    expect(view.featured.value?.id).toBe('invoice');
  });

  it('«all clear» starts when the last one leaves with the panel open', () => {
    const { state } = setup();
    state.latest.value = [notice('cash')];
    state.open.value = true;
    state.latest.value = [];
    expect(state.allClear.active.value).toBe(true);
  });

  it('not with the panel closed, nor when nothing was pending', () => {
    const { state } = setup();
    state.latest.value = [notice('cash')];
    state.latest.value = [];
    expect(state.allClear.active.value).toBe(false);
    state.open.value = true;
    state.latest.value = [];
    expect(state.allClear.active.value).toBe(false);
  });

  it('«all clear» ends when something is pending again', () => {
    const { state } = setup();
    state.latest.value = [notice('cash')];
    state.open.value = true;
    state.latest.value = [];
    state.latest.value = [notice('printer')];
    expect(state.allClear.active.value).toBe(false);
  });
});

describe('resetting the state', () => {
  it('forgets the notices, the card, the choice and the panel, without «all clear»', () => {
    const { state, view } = setup();
    state.latest.value = [notice('cash'), notice('printer')];
    state.linger.add([notice('card', 'info')]);
    state.arrivals.offer(notice('printer'));
    state.chosen.value = 'printer';
    state.open.value = true;
    resetState(state);
    expect(view.shown.value).toEqual([]);
    expect(state.arrivals.current.value).toBeUndefined();
    expect(state.chosen.value).toBeUndefined();
    expect(state.open.value).toBe(false);
    expect(state.allClear.active.value).toBe(false);
    expect(state.pulse.value).toBe(0);
  });

  it('keeps the cards held: holds belong to the screens, not to the source', () => {
    const { state } = setup();
    state.arrivals.hold('checkout');
    resetState(state);
    expect(state.arrivals.offer(notice('printer'))).toBe(false);
  });
});
