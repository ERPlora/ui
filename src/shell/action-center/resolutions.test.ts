import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAllClear, createLinger } from './resolutions';
import type { ActionNotice } from './types';

function notice(id: string): ActionNotice {
  return { id, severity: 'warning', icon: 'ion:alert-circle-outline', label: id, title: id };
}

const ids = (list: readonly ActionNotice[]): string[] => list.map((each) => each.id);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a solved notice lingers', () => {
  it('for a moment, as it was last seen, then leaves', () => {
    const linger = createLinger({ duration: 1200 });
    const printer = notice('printer');
    linger.add([printer, notice('cash')]);
    expect(linger.items.value).toEqual([printer, notice('cash')]);
    expect([...linger.ids.value]).toEqual(['printer', 'cash']);
    vi.advanceTimersByTime(1199);
    expect(ids(linger.items.value)).toEqual(['printer', 'cash']);
    vi.advanceTimersByTime(1);
    expect(linger.items.value).toEqual([]);
    expect(linger.ids.value.size).toBe(0);
  });

  it('each for its own moment', () => {
    const linger = createLinger({ duration: 1200 });
    linger.add([notice('printer')]);
    vi.advanceTimersByTime(600);
    linger.add([notice('cash')]);
    vi.advanceTimersByTime(600);
    expect(ids(linger.items.value)).toEqual(['cash']);
  });

  it('leaves at once when it comes back, and its old moment does not take it away again', () => {
    const linger = createLinger({ duration: 1200 });
    linger.add([notice('printer')]);
    linger.drop(['printer']);
    expect(linger.items.value).toEqual([]);
    vi.advanceTimersByTime(600);
    linger.add([notice('printer')]);
    vi.advanceTimersByTime(600);
    expect(ids(linger.items.value)).toEqual(['printer']);
  });

  it('solved again, it lingers once, with all its moment', () => {
    const linger = createLinger({ duration: 1200 });
    linger.add([notice('printer')]);
    vi.advanceTimersByTime(600);
    linger.add([notice('printer')]);
    expect(ids(linger.items.value)).toEqual(['printer']);
    vi.advanceTimersByTime(1199);
    expect(ids(linger.items.value)).toEqual(['printer']);
  });

  it('every one leaves at once when cleared', () => {
    const linger = createLinger({ duration: 1200 });
    linger.add([notice('printer'), notice('cash')]);
    linger.clear();
    expect(linger.items.value).toEqual([]);
  });

  it('tells when one leaves by its time', () => {
    const onLeave = vi.fn();
    const linger = createLinger({ duration: 1200, onLeave });
    linger.add([notice('printer')]);
    linger.add([notice('cash')]);
    linger.drop(['cash']);
    vi.advanceTimersByTime(1200);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledWith('printer');
  });
});

describe('all clear', () => {
  it('lasts a moment, then is done', () => {
    const onDone = vi.fn();
    const allClear = createAllClear({ duration: 1800, onDone });
    allClear.start();
    expect(allClear.active.value).toBe(true);
    vi.advanceTimersByTime(1799);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(allClear.active.value).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancelled, it ends without being done', () => {
    const onDone = vi.fn();
    const allClear = createAllClear({ duration: 1800, onDone });
    allClear.start();
    allClear.cancel();
    vi.advanceTimersByTime(1800);
    expect(allClear.active.value).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });
});
