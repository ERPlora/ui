import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref, shallowRef } from 'vue';

import { connectActionCenter, createActionCenter, useActionCenter, useQuietActionNotices } from './center';
import type { ActionCenterOptions } from './center';
import type { ActionNotice, NoticeSeverity } from './types';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 17, 12);

function notice(id: string, severity: NoticeSeverity = 'warning', extra: Partial<ActionNotice> = {}): ActionNotice {
  return { id, severity, icon: 'ion:alert-circle-outline', label: `${id} row`, title: `${id} title`, ...extra };
}

function setup(options: ActionCenterOptions = {}) {
  const clock = { now: START };
  const { center, connect } = createActionCenter({ now: () => clock.now, ...options });
  const notices = shallowRef<readonly ActionNotice[] | undefined>();
  const failed = shallowRef(false);
  const retry = vi.fn();
  const disconnect = connect({ notices, failed, retry });
  /** Gives the source's next result as new objects, as a refetch would. */
  const give = (...list: ActionNotice[]): void => {
    notices.value = list.map((each) => ({ ...each }));
  };
  return { center, connect, disconnect, notices, failed, retry, give, clock };
}

const ids = (list: readonly ActionNotice[]): string[] => list.map((each) => each.id);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the source', () => {
  it('is loading until its first result, and shows nothing meanwhile', () => {
    const { center, give } = setup();
    expect(center.loading.value).toBe(true);
    expect(center.total.value).toBe(0);
    expect(center.featured.value).toBeUndefined();
    give(notice('printer'));
    expect(center.loading.value).toBe(false);
  });

  it('is not loading when none is connected', () => {
    const { center } = createActionCenter();
    expect(center.loading.value).toBe(false);
    expect(center.failed.value).toBe(false);
    expect(() => center.retry()).not.toThrow();
  });

  it('tells when it failed and retries through it', () => {
    const { center, failed, retry } = setup();
    failed.value = true;
    expect(center.failed.value).toBe(true);
    center.retry();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('once disconnected, everything it gave is forgotten and it is no longer listened to', () => {
    const { center, disconnect, give, notices } = setup();
    give(notice('printer'));
    center.openPanel();
    disconnect();
    expect(center.total.value).toBe(0);
    expect(center.open.value).toBe(false);
    expect(center.loading.value).toBe(false);
    notices.value = [notice('cash')];
    expect(center.total.value).toBe(0);
  });

  it('a new source takes the place of the old one, and its first result is quiet too', () => {
    const { center, connect, give } = setup();
    give(notice('printer'));
    const next = shallowRef<readonly ActionNotice[] | undefined>([notice('cash', 'danger')]);
    connect({ notices: next, failed: shallowRef(false) });
    give(notice('printer'), notice('card'));
    expect(ids(center.rows.value)).toEqual([]);
    expect(center.featured.value?.id).toBe('cash');
    expect(center.arrival.value).toBeUndefined();
    expect(center.pulse.value).toBe(0);
  });

  it('the disconnect of an old source does not cut the new one', () => {
    const { center, connect, disconnect } = setup();
    connect({ notices: shallowRef([notice('cash')]), failed: shallowRef(false) });
    disconnect();
    expect(center.featured.value?.id).toBe('cash');
  });
});

describe('the order and the bell', () => {
  it('features the first of the order and lists the rest as rows, in order', () => {
    const { center, give } = setup();
    give(notice('card', 'info'), notice('printer', 'warning'), notice('invoice', 'danger'));
    expect(center.featured.value?.id).toBe('invoice');
    expect(ids(center.rows.value)).toEqual(['printer', 'card']);
  });

  it('sums up the bell: total, top severity, most urgent and the countdown of the most urgent with a deadline', () => {
    const { center, give } = setup();
    give(
      notice('blocked', 'danger'),
      notice('invoice', 'warning', { count: 2, due: { at: new Date(START + DAY).toISOString(), from: new Date(START - DAY).toISOString() } }),
    );
    expect(center.total.value).toBe(3);
    expect(center.topSeverity.value).toBe('danger');
    expect(center.mostUrgent.value?.id).toBe('blocked');
    expect(center.dueProgress.value).toBe(0.5);
  });

  it('the countdown follows the clock, minute by minute', () => {
    const { center, give, clock } = setup();
    give(notice('invoice', 'danger', { due: { at: new Date(START + DAY).toISOString(), from: new Date(START - DAY).toISOString() } }));
    clock.now = START + DAY / 2;
    expect(center.dueProgress.value).toBe(0.5);
    vi.advanceTimersByTime(60_000);
    expect(center.dueProgress.value).toBe(0.75);
  });
});

describe('a new notice', () => {
  it('comes as a card for 4 s, then settles in the bell with a pulse', () => {
    const { center, give } = setup();
    give(notice('cash'));
    give(notice('cash'), notice('printer'));
    expect(center.arrival.value?.id).toBe('printer');
    expect(center.pulse.value).toBe(0);
    vi.advanceTimersByTime(3999);
    expect(center.arrival.value?.id).toBe('printer');
    vi.advanceTimersByTime(1);
    expect(center.arrival.value).toBeUndefined();
    expect(center.pulse.value).toBe(1);
  });

  it('takes its time on screen from the options', () => {
    const { center, give } = setup({ arrivalMs: 1000 });
    give();
    give(notice('printer'));
    vi.advanceTimersByTime(1000);
    expect(center.arrival.value).toBeUndefined();
  });

  it('after the source loads again, its result is quiet like the first one', () => {
    const { center, give, notices } = setup();
    give(notice('cash'));
    notices.value = undefined;
    expect(center.loading.value).toBe(true);
    expect(center.featured.value?.id).toBe('cash');
    give(notice('printer'));
    expect(center.arrival.value).toBeUndefined();
    expect(center.pulse.value).toBe(0);
    expect(center.resolved.value.size).toBe(0);
    expect(center.featured.value?.id).toBe('printer');
  });

  it('the card pauses and goes on, and settles at once when asked', () => {
    const { center, give } = setup();
    give();
    give(notice('printer'));
    center.pauseArrival();
    vi.advanceTimersByTime(10_000);
    expect(center.arrival.value?.id).toBe('printer');
    center.resumeArrival();
    vi.advanceTimersByTime(4000);
    expect(center.arrival.value).toBeUndefined();
    give(notice('printer'), notice('cash'));
    center.settleArrival();
    expect(center.arrival.value).toBeUndefined();
    expect(center.pulse.value).toBe(2);
  });

  it('the card leaves when the panel opens, which shows its notice', () => {
    const { center, give } = setup();
    give();
    give(notice('printer'));
    center.openPanel('printer');
    expect(center.arrival.value).toBeUndefined();
    expect(center.featured.value?.id).toBe('printer');
  });

  it('while the cards are held, it only makes the bell pulse', () => {
    const { center, give } = setup();
    give();
    center.holdArrivals('reduced-motion');
    give(notice('printer'));
    expect(center.arrival.value).toBeUndefined();
    expect(center.pulse.value).toBe(1);
    center.releaseArrivals('reduced-motion');
    give(notice('printer'), notice('cash'));
    expect(center.arrival.value?.id).toBe('cash');
  });
});

describe('a solved notice', () => {
  it('stays a moment marked as solved, then leaves the lists', () => {
    const { center, give } = setup();
    give(notice('invoice', 'danger'), notice('printer'));
    give(notice('invoice', 'danger'));
    expect([...center.resolved.value]).toEqual(['printer']);
    expect(ids(center.rows.value)).toEqual(['printer']);
    vi.advanceTimersByTime(1200);
    expect(center.resolved.value.size).toBe(0);
    expect(ids(center.rows.value)).toEqual([]);
    expect(center.total.value).toBe(1);
  });

  it('takes its moment from the options', () => {
    const { center, give } = setup({ resolvedMs: 300 });
    give(notice('printer'));
    give();
    vi.advanceTimersByTime(300);
    expect(center.resolved.value.size).toBe(0);
  });

  it('is not given up for solved while the source fails, and is once it recovers', () => {
    const { center, give, failed } = setup();
    give(notice('printer'), notice('cash'));
    failed.value = true;
    give(notice('cash'));
    expect(center.resolved.value.size).toBe(0);
    expect(center.total.value).toBe(2);
    failed.value = false;
    expect([...center.resolved.value]).toEqual(['printer']);
  });
});

describe('all clear', () => {
  it('when the last one is solved with the panel open, shows a moment and then closes the panel', () => {
    const { center, give } = setup();
    give(notice('printer'));
    center.openPanel();
    give();
    expect(center.allClear.value).toBe(false);
    vi.advanceTimersByTime(1200);
    expect(center.allClear.value).toBe(true);
    expect(center.open.value).toBe(true);
    vi.advanceTimersByTime(1800);
    expect(center.allClear.value).toBe(false);
    expect(center.open.value).toBe(false);
  });

  it('takes its moment from the options', () => {
    const { center, give } = setup({ resolvedMs: 0, allClearMs: 500 });
    give(notice('printer'));
    center.openPanel();
    give();
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(500);
    expect(center.open.value).toBe(false);
  });

  it('closing the panel ends it', () => {
    const { center, give } = setup();
    give(notice('printer'));
    center.openPanel();
    give();
    vi.advanceTimersByTime(1200);
    center.closePanel();
    expect(center.allClear.value).toBe(false);
  });
});

describe('the panel', () => {
  it('opens and closes', () => {
    const { center } = setup();
    center.openPanel();
    expect(center.open.value).toBe(true);
    center.closePanel();
    expect(center.open.value).toBe(false);
  });

  it('features the chosen notice and lists the first among the rows', () => {
    const { center, give } = setup();
    give(notice('invoice', 'danger'), notice('printer'), notice('card', 'info'));
    center.feature('card');
    expect(center.featured.value?.id).toBe('card');
    expect(ids(center.rows.value)).toEqual(['invoice', 'printer']);
  });

  it('opened on a notice, features it; opened without one, features the first', () => {
    const { center, give } = setup();
    give(notice('invoice', 'danger'), notice('printer'));
    center.openPanel('printer');
    expect(center.featured.value?.id).toBe('printer');
    center.closePanel();
    center.openPanel();
    expect(center.featured.value?.id).toBe('invoice');
  });

  it('ignores a notice that is not there', () => {
    const { center, give } = setup();
    give(notice('invoice', 'danger'), notice('printer'));
    center.feature('nope');
    center.openPanel('nope');
    expect(center.featured.value?.id).toBe('invoice');
    give(notice('invoice', 'danger'), notice('printer'), notice('nope', 'info'));
    expect(center.featured.value?.id).toBe('invoice');
  });

  it('when the chosen one goes, features the first again, and not the chosen one if it comes back', () => {
    const { center, give } = setup();
    give(notice('invoice', 'danger'), notice('printer'));
    center.feature('printer');
    give(notice('invoice', 'danger'));
    vi.advanceTimersByTime(1200);
    expect(center.featured.value?.id).toBe('invoice');
    give(notice('invoice', 'danger'), notice('printer'));
    expect(center.featured.value?.id).toBe('invoice');
  });
});

describe('the action of a notice', () => {
  it('runs with the notice busy and passes its error on', async () => {
    const { center, give } = setup();
    let fail!: (error: Error) => void;
    const action = { label: 'Retry', run: () => new Promise<void>((_, reject) => (fail = reject)) };
    give(notice('printer', 'warning', { action }));
    const featured = center.featured.value as ActionNotice;
    const result = center.runAction(featured, 'primary');
    expect(center.busy.value.has('printer')).toBe(true);
    fail(new Error('printer_offline'));
    await expect(result).rejects.toThrow('printer_offline');
    expect(center.busy.value.has('printer')).toBe(false);
  });

  it('gives back where a page action leads', async () => {
    const { center, give } = setup();
    give(notice('invoice', 'danger', { action: { label: 'Pay', to: '/billing' } }));
    await expect(center.runAction(center.featured.value as ActionNotice, 'primary')).resolves.toEqual({ to: '/billing' });
  });
});

describe('the action center of the page', () => {
  let disconnect: (() => void) | undefined;

  afterEach(() => {
    disconnect?.();
  });

  function connectPage() {
    const notices = shallowRef<readonly ActionNotice[] | undefined>([]);
    disconnect = connectActionCenter({ notices, failed: shallowRef(false) });
    return notices;
  }

  it('is the one the shell connects, until it disconnects it', () => {
    const notices = connectPage();
    notices.value = [notice('printer')];
    expect(useActionCenter().arrival.value?.id).toBe('printer');
    disconnect?.();
    expect(useActionCenter().total.value).toBe(0);
    expect(useActionCenter().arrival.value).toBeUndefined();
  });

  it('a quiet screen keeps the cards of new notices off it while active, and until its scope ends', () => {
    const notices = connectPage();
    const center = useActionCenter();
    const sheetOpen = ref(true);
    const scope = effectScope();
    scope.run(() => useQuietActionNotices(sheetOpen));
    notices.value = [notice('printer')];
    expect(center.arrival.value).toBeUndefined();
    sheetOpen.value = false;
    notices.value = [notice('printer'), notice('cash')];
    expect(center.arrival.value?.id).toBe('cash');
    center.settleArrival();
    sheetOpen.value = true;
    scope.stop();
    notices.value = [notice('printer'), notice('cash'), notice('card')];
    expect(center.arrival.value?.id).toBe('card');
  });

  it('each quiet screen counts apart', () => {
    const notices = connectPage();
    const center = useActionCenter();
    const sheet = effectScope();
    const assistant = effectScope();
    sheet.run(() => useQuietActionNotices(true));
    assistant.run(() => useQuietActionNotices(() => true));
    sheet.stop();
    notices.value = [notice('printer')];
    expect(center.arrival.value).toBeUndefined();
    assistant.stop();
    notices.value = [notice('printer'), notice('cash')];
    expect(center.arrival.value?.id).toBe('cash');
  });
});
