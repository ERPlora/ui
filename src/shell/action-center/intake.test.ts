import { describe, expect, it, vi } from 'vitest';

import { ids, notice, useCenterTimers } from './__tests__/fixtures';
import { createIntake } from './intake';
import { createState, createView, watchLeaving } from './state';
import type { ActionNotice } from './types';

function setup() {
  const state = createState({});
  const view = createView(state);
  watchLeaving(state, view);
  const intake = createIntake(state, view);
  /** The source's next result, as new objects, as a refetch would give them. */
  const give = (...list: ActionNotice[]): void => intake.receive(list.map((each) => ({ ...each })), false);
  const arrival = (): string | undefined => state.arrivals.current.value?.id;
  return { state, view, intake, give, arrival };
}

useCenterTimers();

describe('the first result', () => {
  it('is taken as it comes, announcing nothing', () => {
    const { state, give, arrival } = setup();
    give(notice('printer'), notice('invoice', 'danger'));
    expect(ids(state.latest.value)).toEqual(['printer', 'invoice']);
    expect(arrival()).toBeUndefined();
    expect(state.pulse.value).toBe(0);
  });

  it('after loading again, the next result is quiet like the first one, and solves nothing', () => {
    const { state, intake, give, arrival } = setup();
    give(notice('cash'));
    intake.receive(undefined, false);
    expect(ids(state.latest.value)).toEqual(['cash']);
    give(notice('printer'));
    expect(arrival()).toBeUndefined();
    expect(state.pulse.value).toBe(0);
    expect(state.linger.ids.value.size).toBe(0);
  });

  it('after a restart, the next result is quiet too', () => {
    const { state, intake, give, arrival } = setup();
    give(notice('cash'));
    intake.restart();
    give(notice('cash'), notice('printer'));
    expect(arrival()).toBeUndefined();
    expect(state.pulse.value).toBe(0);
  });
});

describe('a new notice', () => {
  it('comes as a card', () => {
    const { give, arrival, state } = setup();
    give(notice('cash'));
    give(notice('cash'), notice('printer'));
    expect(arrival()).toBe('printer');
    expect(state.pulse.value).toBe(0);
  });

  it('of several at once, only the gravest comes as a card; the others make the bell pulse', () => {
    const { give, arrival, state } = setup();
    give(notice('cash'));
    give(notice('cash'), notice('card', 'info'), notice('invoice', 'danger'), notice('printer'));
    expect(arrival()).toBe('invoice');
    expect(state.pulse.value).toBe(1);
  });

  it('a raised count only makes the bell pulse', () => {
    const { give, arrival, state } = setup();
    give(notice('appointments', 'info', { count: 2 }));
    give(notice('appointments', 'info', { count: 3 }));
    expect(arrival()).toBeUndefined();
    expect(state.pulse.value).toBe(1);
  });

  it('the same result again, as after a reconnection, announces nothing', () => {
    const { give, arrival, state } = setup();
    give(notice('cash'), notice('printer', 'warning', { count: 2 }));
    give(notice('cash'), notice('printer', 'warning', { count: 2 }));
    expect(arrival()).toBeUndefined();
    expect(state.pulse.value).toBe(0);
  });

  it('with the panel open, only makes the bell pulse: the panel already shows it', () => {
    const { give, arrival, state } = setup();
    give(notice('cash'));
    state.open.value = true;
    give(notice('cash'), notice('printer'));
    expect(arrival()).toBeUndefined();
    expect(state.pulse.value).toBe(1);
  });

  it('while the cards are held, only makes the bell pulse', () => {
    const { give, arrival, state } = setup();
    give();
    state.arrivals.hold('checkout');
    give(notice('printer'));
    expect(arrival()).toBeUndefined();
    expect(state.pulse.value).toBe(1);
  });

  it('one as grave or less than the card on screen only makes the bell pulse', () => {
    const { give, arrival, state } = setup();
    give();
    give(notice('invoice', 'danger'));
    give(notice('invoice', 'danger'), notice('printer'));
    expect(arrival()).toBe('invoice');
    expect(state.pulse.value).toBe(1);
  });
});

describe('a solved notice', () => {
  it('lingers a moment in the lists, then leaves', () => {
    const { give, state, view } = setup();
    give(notice('invoice', 'danger'), notice('printer'));
    give(notice('invoice', 'danger'));
    expect([...state.linger.ids.value]).toEqual(['printer']);
    expect(ids(view.rows.value)).toEqual(['printer']);
    vi.advanceTimersByTime(1200);
    expect(ids(view.shown.value)).toEqual(['invoice']);
  });

  it('stays featured while it lingers, then the first of the order is', () => {
    const { give, view } = setup();
    give(notice('printer'), notice('cash'));
    give(notice('cash'));
    expect(view.featured.value?.id).toBe('printer');
    vi.advanceTimersByTime(1200);
    expect(view.featured.value?.id).toBe('cash');
  });

  it('takes its card away without a pulse', () => {
    const { give, arrival, state } = setup();
    give();
    give(notice('printer'));
    give();
    expect(arrival()).toBeUndefined();
    vi.advanceTimersByTime(4000);
    expect(state.pulse.value).toBe(0);
  });

  it('that comes back is pending again and comes as a new notice', () => {
    const { give, arrival, state, view } = setup();
    give(notice('printer'), notice('cash'));
    give(notice('cash'));
    give(notice('cash'), notice('printer'));
    expect(state.linger.ids.value.size).toBe(0);
    expect(arrival()).toBe('printer');
    expect(view.summary.value.total).toBe(2);
  });

  it('is not given up for solved while the source fails, and is once it recovers', () => {
    const { intake, state } = setup();
    const both = [notice('printer'), notice('cash')];
    intake.receive(both, false);
    intake.receive([notice('cash')], true);
    expect(state.linger.ids.value.size).toBe(0);
    expect(ids(state.latest.value)).toEqual(['cash', 'printer']);
    intake.receive([notice('cash')], false);
    expect([...state.linger.ids.value]).toEqual(['printer']);
  });

  it('a failing source still announces what it brings new', () => {
    const { intake, arrival } = setup();
    intake.receive([notice('cash')], false);
    intake.receive([notice('printer')], true);
    expect(arrival()).toBe('printer');
  });
});
