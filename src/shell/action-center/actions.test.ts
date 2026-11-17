import { describe, expect, it, vi } from 'vitest';

import { createActionRunner } from './actions';
import type { ActionNotice } from './types';

function notice(extra: Partial<ActionNotice> = {}): ActionNotice {
  return { id: 'billing.unpaid', severity: 'danger', icon: 'ion:receipt-outline', label: 'Unpaid', title: 'Unpaid', ...extra };
}

/** A promise the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('running the action of a notice', () => {
  it('a page action gives back where to go and runs nothing', async () => {
    const runner = createActionRunner();
    const result = runner.run(notice({ action: { label: 'Pay', to: '/billing' } }), 'primary');
    expect(runner.busy.value.size).toBe(0);
    await expect(result).resolves.toEqual({ to: '/billing' });
  });

  it('a link action gives back the link', async () => {
    const runner = createActionRunner();
    const link = { label: 'Card', href: 'https://erplora.com/card' };
    await expect(runner.run(notice({ action: { label: 'Pay', to: '/billing' }, secondary: link }), 'secondary')).resolves.toEqual({
      href: 'https://erplora.com/card',
    });
  });

  it('a notice without that action does nothing', async () => {
    const runner = createActionRunner();
    await expect(runner.run(notice({ action: { label: 'Pay', to: '/billing' } }), 'secondary')).resolves.toBeUndefined();
    await expect(runner.run(notice(), 'primary')).resolves.toBeUndefined();
  });

  it('a run action keeps the notice busy until it ends', async () => {
    const runner = createActionRunner();
    const work = deferred();
    const result = runner.run(notice({ action: { label: 'Retry', run: () => work.promise } }), 'primary');
    expect([...runner.busy.value]).toEqual(['billing.unpaid']);
    work.resolve();
    await expect(result).resolves.toBeUndefined();
    expect(runner.busy.value.size).toBe(0);
  });

  it('a run action that fails passes its error on and frees the notice', async () => {
    const runner = createActionRunner();
    const work = deferred();
    const result = runner.run(notice({ action: { label: 'Retry', run: () => work.promise } }), 'primary');
    work.reject(new Error('printer_offline'));
    await expect(result).rejects.toThrow('printer_offline');
    expect(runner.busy.value.size).toBe(0);
  });

  it('a run action that throws at once is a failed run too', async () => {
    const runner = createActionRunner();
    const action = {
      label: 'Retry',
      run: () => {
        throw new Error('no_session');
      },
    };
    await expect(runner.run(notice({ action }), 'primary')).rejects.toThrow('no_session');
    expect(runner.busy.value.size).toBe(0);
  });

  it('a busy notice does not run again until its action ends', async () => {
    const runner = createActionRunner();
    const work = deferred();
    const run = vi.fn(() => work.promise);
    const busy = notice({ action: { label: 'Retry', run }, secondary: { label: 'Other', run } });
    const first = runner.run(busy, 'primary');
    await expect(runner.run(busy, 'secondary')).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
    work.resolve();
    await first;
    await runner.run(busy, 'primary');
    expect(run).toHaveBeenCalledTimes(2);
  });
});
