import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useDismissal } from './dismissal';

type IonicAsks = (data?: unknown, role?: string) => Promise<boolean>;

function setup(options: { canDismiss?: () => boolean | Promise<boolean>; pending?: boolean; backdropDismiss?: boolean } = {}) {
  const open = ref(true);
  const pending = ref(options.pending ?? false);
  const cancelled = vi.fn();
  const dismissal = useDismissal({
    canDismiss: () => options.canDismiss,
    pending: () => pending.value,
    backdropDismiss: () => options.backdropDismiss ?? true,
    open,
    cancelled,
  });
  return { ...dismissal, open, pending, cancelled };
}

function slowAnswer() {
  let answer: (yes: boolean) => void = () => {};
  const canDismiss = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
  return { canDismiss, answer: (yes: boolean) => answer(yes) };
}

describe('useDismissal', () => {
  it('without a question, Ionic dismisses at once and Cancel closes it', async () => {
    const d = setup();
    expect(d.ionCanDismiss.value).toBe(true);
    await d.cancel();
    expect([d.open.value, d.cancelled.mock.calls.length]).toEqual([false, 1]);
  });

  it('a «no» keeps it open, and Ionic asks only for the person\'s own dismissals', async () => {
    const canDismiss = vi.fn(() => false);
    const d = setup({ canDismiss });
    await d.cancel();
    expect([d.open.value, d.cancelled.mock.calls.length]).toEqual([true, 0]);
    const ask = d.ionCanDismiss.value as IonicAsks;
    await expect(ask(undefined, 'backdrop')).resolves.toBe(false);
    await expect(ask(undefined, undefined)).resolves.toBe(true);
    expect(canDismiss).toHaveBeenCalledTimes(2);
  });

  it('every way out while the question is up waits for the same answer, and closes once', async () => {
    const { canDismiss, answer } = slowAnswer();
    const d = setup({ canDismiss });
    const ways = [d.cancel(), d.cancel(), (d.ionCanDismiss.value as IonicAsks)(undefined, 'backdrop')];
    await vi.waitFor(() => expect(canDismiss).toHaveBeenCalled());
    answer(true);
    await Promise.all(ways);
    expect([canDismiss.mock.calls.length, d.cancelled.mock.calls.length, d.open.value]).toEqual([1, 1, false]);
  });

  it('a submit that starts while the question is up keeps it open', async () => {
    const { canDismiss, answer } = slowAnswer();
    const d = setup({ canDismiss });
    const cancelling = d.cancel();
    await vi.waitFor(() => expect(canDismiss).toHaveBeenCalled());
    d.pending.value = true;
    answer(true);
    await cancelling;
    expect([d.open.value, d.cancelled.mock.calls.length]).toEqual([true, 0]);
  });

  it('a question that fails keeps it open and says why in the console', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = setup({ canDismiss: () => Promise.reject(new Error('down')) });
    await d.cancel();
    expect(d.open.value).toBe(true);
    expect(error).toHaveBeenCalledWith('ui: could not ask whether to close the dialog', expect.any(Error));
    error.mockRestore();
  });

  it('nothing closes it while pending; Escape cancels only when the backdrop does not', async () => {
    const pending = setup({ pending: true, backdropDismiss: false });
    pending.onEscape();
    await pending.cancel();
    expect(pending.cancelled).not.toHaveBeenCalled();
    const withBackdrop = setup();
    withBackdrop.onEscape();
    await Promise.resolve();
    expect(withBackdrop.cancelled).not.toHaveBeenCalled();
    const withoutBackdrop = setup({ backdropDismiss: false });
    withoutBackdrop.onEscape();
    await vi.waitFor(() => expect(withoutBackdrop.cancelled).toHaveBeenCalledTimes(1));
  });
});
