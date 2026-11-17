import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createToastStore, useToasts } from './toast-store';
import type { Toast } from './toast-store';

const messages = (list: readonly Toast[]): string[] => list.map((toast) => toast.message);

/** A stack whose bottom edge is full: three toasts that stay, '1' the oldest. Returns it and the id of '1'. */
function bottomFull() {
  const store = createToastStore();
  const first = store.show({ message: '1', duration: 0 });
  store.show({ message: '2', duration: 0 });
  store.show({ message: '3', duration: 0 });
  return { store, first };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a toast is data', () => {
  it('fills what the caller leaves out: an id, the info tone, its tone’s time and the bottom edge', () => {
    const store = createToastStore();
    const id = store.show({ message: 'Saved' });
    expect(store.bottom.value).toEqual([{ id, message: 'Saved', tone: 'info', duration: 3000, position: 'bottom' }]);
    expect(store.top.value).toEqual([]);
  });

  it('each tone has its time on screen: success and info 3 s, warning 4 s, error 5 s', () => {
    const store = createToastStore();
    store.show({ message: 'e', tone: 'error' });
    store.show({ message: 'w', tone: 'warning' });
    store.show({ message: 's', tone: 'success', position: 'top' });
    store.show({ message: 'i', tone: 'info', position: 'top' });
    const durations = (list: readonly Toast[]) => Object.fromEntries(list.map((toast) => [toast.tone, toast.duration]));
    expect(durations(store.bottom.value)).toEqual({ error: 5000, warning: 4000 });
    expect(durations(store.top.value)).toEqual({ success: 3000, info: 3000 });
  });

  it('keeps what the caller gives: its id, its duration, its action and its edge', () => {
    const store = createToastStore();
    const action = { label: 'Retry', run: vi.fn() };
    const id = store.show({ message: 'Offline', tone: 'error', duration: 0, id: 'net', action, position: 'top' });
    expect(id).toBe('net');
    expect(store.top.value).toEqual([{ id: 'net', message: 'Offline', tone: 'error', duration: 0, action, position: 'top' }]);
  });

  it('gives every toast without an id one of its own', () => {
    const store = createToastStore();
    const first = store.show({ message: 'One' });
    const second = store.show({ message: 'Two' });
    expect(first).not.toBe(second);
    expect(store.bottom.value).toHaveLength(2);
  });
});

describe('the stack', () => {
  it('lists each edge apart, the newest first', () => {
    const store = createToastStore();
    store.show({ message: 'B1' });
    store.show({ message: 'T1', position: 'top' });
    store.show({ message: 'B2' });
    expect(messages(store.bottom.value)).toEqual(['B2', 'B1']);
    expect(messages(store.top.value)).toEqual(['T1']);
  });

  it('shows at most three per edge; the next waits and comes in when one leaves', () => {
    const { store, first } = bottomFull();
    store.show({ message: '4', duration: 0 });
    store.show({ message: 'Top', duration: 0, position: 'top' });
    expect(messages(store.bottom.value)).toEqual(['3', '2', '1']);
    expect(messages(store.top.value)).toEqual(['Top']);
    store.dismiss(first);
    expect(messages(store.bottom.value)).toEqual(['4', '3', '2']);
  });

  it('a toast with an id already on the stack replaces it in its place, never a second copy', () => {
    const store = createToastStore();
    store.show({ message: 'Could not open Sales', tone: 'error', id: 'open', duration: 0 });
    store.show({ message: 'Saved' });
    store.show({ message: 'Could not open Sales again', tone: 'warning', id: 'open', duration: 0 });
    expect(store.bottom.value.map(({ message, tone }) => [message, tone])).toEqual([
      ['Saved', 'info'],
      ['Could not open Sales again', 'warning'],
    ]);
  });

  it('a waiting toast replaced by id keeps waiting in its turn', () => {
    const { store, first } = bottomFull();
    store.show({ message: '4', id: 'four', duration: 0 });
    store.show({ message: '5', duration: 0 });
    store.show({ message: '4 again', id: 'four', duration: 0 });
    expect(messages(store.bottom.value)).toEqual(['3', '2', '1']);
    store.dismiss(first);
    expect(messages(store.bottom.value)).toEqual(['4 again', '3', '2']);
  });

  it('a toast replaced by id at the other edge comes there as the newest, and its old place is taken by the next', () => {
    const store = createToastStore();
    store.show({ message: 'Sending', id: 'send', duration: 0 });
    for (const message of ['2', '3', '4']) store.show({ message, duration: 0 });
    for (const message of ['T1', 'T2']) store.show({ message, duration: 0, position: 'top' });
    store.show({ message: 'Sent', id: 'send', duration: 0, position: 'top' });
    expect(messages(store.bottom.value)).toEqual(['4', '3', '2']);
    expect(messages(store.top.value)).toEqual(['Sent', 'T2', 'T1']);
  });

  it('a toast moved to a full edge waits its turn there, and never sends one on screen back to waiting', () => {
    const store = createToastStore();
    store.show({ message: 'Sending', id: 'send', duration: 0 });
    for (const message of ['T1', 'T2', 'T3']) store.show({ message, duration: 0, position: 'top' });
    store.show({ message: 'Sent', id: 'send', duration: 0, position: 'top' });
    expect(store.bottom.value).toEqual([]);
    expect(messages(store.top.value)).toEqual(['T3', 'T2', 'T1']);
  });
});

describe('the time on screen', () => {
  it('a toast leaves once its time is up', () => {
    const store = createToastStore();
    store.show({ message: 'Saved', tone: 'success' });
    store.show({ message: 'Sent', tone: 'success', position: 'top' });
    expect(vi.getTimerCount()).toBe(2);
    store.dismiss(store.top.value[0].id);
    vi.advanceTimersByTime(2999);
    expect(messages(store.bottom.value)).toEqual(['Saved']);
    vi.advanceTimersByTime(1);
    expect(store.bottom.value).toEqual([]);
  });

  it('a duration of 0 stays until it is closed', () => {
    const store = createToastStore();
    const id = store.show({ message: 'Offline', tone: 'error', duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(messages(store.bottom.value)).toEqual(['Offline']);
    expect(store.dismiss(id)).toBe(true);
    expect(store.bottom.value).toEqual([]);
  });

  it('a waiting toast does not count its time until it is on screen', () => {
    const store = createToastStore();
    for (const message of ['1', '2', '3']) store.show({ message, duration: 1000 });
    store.show({ message: '4', duration: 1000 });
    vi.advanceTimersByTime(1000);
    expect(messages(store.bottom.value)).toEqual(['4']);
    vi.advanceTimersByTime(999);
    expect(messages(store.bottom.value)).toEqual(['4']);
    vi.advanceTimersByTime(1);
    expect(store.bottom.value).toEqual([]);
  });

  it('a toast replaced by id starts its new time over, and the old time never closes the new one', () => {
    const store = createToastStore();
    store.show({ message: 'Uploading', id: 'up', duration: 3000 });
    vi.advanceTimersByTime(2000);
    store.show({ message: 'Uploaded', id: 'up', duration: 3000 });
    vi.advanceTimersByTime(2999);
    expect(messages(store.bottom.value)).toEqual(['Uploaded']);
    vi.advanceTimersByTime(1);
    expect(store.bottom.value).toEqual([]);
  });

  it('pausing stops every clock and resuming goes on with the time each had left', () => {
    const store = createToastStore();
    store.show({ message: 'Bottom', duration: 3000 });
    store.show({ message: 'Top', duration: 5000, position: 'top' });
    vi.advanceTimersByTime(1000);
    store.pause();
    vi.advanceTimersByTime(60_000);
    expect(messages(store.bottom.value)).toEqual(['Bottom']);
    expect(messages(store.top.value)).toEqual(['Top']);
    store.resume();
    vi.advanceTimersByTime(1999);
    expect(messages(store.bottom.value)).toEqual(['Bottom']);
    vi.advanceTimersByTime(1);
    expect(store.bottom.value).toEqual([]);
    vi.advanceTimersByTime(2000);
    expect(store.top.value).toEqual([]);
  });

  it('pausing twice keeps the time left once, and resuming twice starts each clock once', () => {
    const store = createToastStore();
    store.show({ message: 'Saved', duration: 3000 });
    vi.advanceTimersByTime(1000);
    store.pause();
    vi.advanceTimersByTime(500);
    store.pause();
    store.resume();
    store.resume();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1999);
    expect(messages(store.bottom.value)).toEqual(['Saved']);
    vi.advanceTimersByTime(1);
    expect(store.bottom.value).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a toast that comes or takes its turn while paused counts its time from the resume', () => {
    const { store, first } = bottomFull();
    store.show({ message: '4', duration: 1000 });
    store.pause();
    store.show({ message: 'Top', duration: 1000, position: 'top' });
    store.dismiss(first);
    vi.advanceTimersByTime(5000);
    expect(messages(store.bottom.value)).toEqual(['4', '3', '2']);
    expect(messages(store.top.value)).toEqual(['Top']);
    store.resume();
    vi.advanceTimersByTime(1000);
    expect(messages(store.bottom.value)).toEqual(['3', '2']);
    expect(store.top.value).toEqual([]);
  });
});

describe('closing', () => {
  it('dismiss says whether there was something to close, on screen or waiting', () => {
    const store = createToastStore();
    for (const message of ['1', '2', '3']) store.show({ message, duration: 0 });
    const waiting = store.show({ message: '4', duration: 0 });
    expect(store.dismiss(waiting)).toBe(true);
    expect(store.dismiss(waiting)).toBe(false);
    expect(store.dismiss('never-shown')).toBe(false);
    expect(messages(store.bottom.value)).toEqual(['3', '2', '1']);
  });

  it('a toast closed before its time leaves no clock behind', () => {
    const store = createToastStore();
    const id = store.show({ message: 'Saved' });
    store.dismiss(id);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('running its action runs it once and closes the toast', () => {
    const store = createToastStore();
    const run = vi.fn();
    const id = store.show({ message: 'Could not open', duration: 0, action: { label: 'Retry', run } });
    store.runAction(id);
    expect(run).toHaveBeenCalledOnce();
    expect(store.bottom.value).toEqual([]);
    store.runAction(id);
    expect(run).toHaveBeenCalledOnce();
  });

  it('closes the toast even when its action throws, and lets the error through', () => {
    const store = createToastStore();
    const id = store.show({
      message: 'Could not open',
      duration: 0,
      action: {
        label: 'Retry',
        run: () => {
          throw new Error('navigation refused');
        },
      },
    });
    expect(() => store.runAction(id)).toThrow('navigation refused');
    expect(store.bottom.value).toEqual([]);
  });

  it('a toast without an action stays when asked to run one', () => {
    const store = createToastStore();
    const id = store.show({ message: 'Saved', duration: 0 });
    store.runAction(id);
    expect(messages(store.bottom.value)).toEqual(['Saved']);
  });
});

describe('useToasts', () => {
  it('gives the component the one stack every caller fills, to read and to act on, not to add to', () => {
    const one = useToasts();
    const other = useToasts();
    expect(one.bottom).toBe(other.bottom);
    expect(one.top).toBe(other.top);
    expect(Object.keys(one).sort()).toEqual(['bottom', 'dismiss', 'pause', 'resume', 'runAction', 'top']);
  });
});
