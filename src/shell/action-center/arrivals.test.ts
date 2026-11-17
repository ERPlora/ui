import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createArrivals } from './arrivals';
import type { ActionNotice, NoticeSeverity } from './types';

const DURATION = 4000;

function notice(id: string, severity: NoticeSeverity = 'warning'): ActionNotice {
  return { id, severity, icon: 'ion:alert-circle-outline', label: id, title: id };
}

function setup() {
  const onSettle = vi.fn();
  const arrivals = createArrivals({ duration: DURATION, onSettle });
  return { arrivals, onSettle };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a new notice shown as a card', () => {
  it('stays for its time, then settles in the bell', () => {
    const { arrivals, onSettle } = setup();
    const printer = notice('printer');
    expect(arrivals.offer(printer)).toBe(true);
    expect(arrivals.current.value).toBe(printer);
    vi.advanceTimersByTime(DURATION - 1);
    expect(arrivals.current.value).toBe(printer);
    vi.advanceTimersByTime(1);
    expect(arrivals.current.value).toBeUndefined();
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('pausing stops its clock, keeping the time it has left', () => {
    const { arrivals, onSettle } = setup();
    arrivals.offer(notice('printer'));
    vi.advanceTimersByTime(1000);
    arrivals.pause();
    arrivals.pause();
    vi.advanceTimersByTime(10 * DURATION);
    expect(arrivals.current.value?.id).toBe('printer');
    arrivals.resume();
    vi.advanceTimersByTime(DURATION - 1001);
    expect(arrivals.current.value?.id).toBe('printer');
    vi.advanceTimersByTime(1);
    expect(arrivals.current.value).toBeUndefined();
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('resuming a clock that runs changes nothing', () => {
    const { arrivals } = setup();
    arrivals.offer(notice('printer'));
    vi.advanceTimersByTime(1000);
    arrivals.resume();
    vi.advanceTimersByTime(DURATION - 1000);
    expect(arrivals.current.value).toBeUndefined();
  });

  it('settles at once when asked, and not again when its time would have come', () => {
    const { arrivals, onSettle } = setup();
    arrivals.offer(notice('printer'));
    arrivals.settle();
    expect(arrivals.current.value).toBeUndefined();
    vi.advanceTimersByTime(DURATION);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('settling with no card changes nothing', () => {
    const { arrivals, onSettle } = setup();
    arrivals.settle();
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('a withdrawn card leaves without settling in the bell', () => {
    const { arrivals, onSettle } = setup();
    arrivals.offer(notice('printer'));
    arrivals.withdraw();
    vi.advanceTimersByTime(DURATION);
    expect(arrivals.current.value).toBeUndefined();
    expect(onSettle).not.toHaveBeenCalled();
  });
});

describe('a new notice while a card is on screen', () => {
  it('a graver one takes its place with all its time; the one on screen settles in the bell', () => {
    const { arrivals, onSettle } = setup();
    arrivals.offer(notice('printer', 'warning'));
    vi.advanceTimersByTime(3000);
    expect(arrivals.offer(notice('invoice', 'danger'))).toBe(true);
    expect(arrivals.current.value?.id).toBe('invoice');
    expect(onSettle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(DURATION - 1);
    expect(arrivals.current.value?.id).toBe('invoice');
    vi.advanceTimersByTime(1);
    expect(onSettle).toHaveBeenCalledTimes(2);
  });

  it('one as grave or less is not shown, and the card on screen keeps its time', () => {
    const { arrivals, onSettle } = setup();
    arrivals.offer(notice('printer', 'warning'));
    vi.advanceTimersByTime(3000);
    expect(arrivals.offer(notice('certificate', 'warning'))).toBe(false);
    expect(arrivals.offer(notice('card', 'info'))).toBe(false);
    expect(arrivals.current.value?.id).toBe('printer');
    vi.advanceTimersByTime(1000);
    expect(arrivals.current.value).toBeUndefined();
    expect(onSettle).toHaveBeenCalledTimes(1);
  });
});

describe('holding the cards back', () => {
  it('while held, a new notice is not shown', () => {
    const { arrivals } = setup();
    arrivals.hold('checkout');
    expect(arrivals.offer(notice('printer'))).toBe(false);
    expect(arrivals.current.value).toBeUndefined();
  });

  it('the card on screen settles in the bell when the hold begins', () => {
    const { arrivals, onSettle } = setup();
    arrivals.offer(notice('printer'));
    arrivals.hold('checkout');
    expect(arrivals.current.value).toBeUndefined();
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('lasts until every reason is released, each by itself', () => {
    const { arrivals } = setup();
    const sheet = Symbol('sheet');
    arrivals.hold(sheet);
    arrivals.hold('reduced-motion');
    arrivals.release('another');
    arrivals.release(sheet);
    expect(arrivals.offer(notice('printer'))).toBe(false);
    arrivals.release('reduced-motion');
    expect(arrivals.offer(notice('printer'))).toBe(true);
  });

  it('holding twice for the same reason needs one release', () => {
    const { arrivals } = setup();
    arrivals.hold('checkout');
    arrivals.hold('checkout');
    arrivals.release('checkout');
    expect(arrivals.offer(notice('printer'))).toBe(true);
  });
});
