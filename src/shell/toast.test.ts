// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readRepoFile, versionedFiles } from '../__tests__/repo-files';
import * as toastModule from './toast';
import { dismissToast, toast, toastError, toastInfo, toastSuccess, toastWarning } from './toast';
import { useToasts } from './toast-store';

const { bottom, top, dismiss } = useToasts();

/** Empties the page's one stack, the toasts waiting their turn too. */
function clearStack(): void {
  while (bottom.value.length + top.value.length > 0) {
    for (const each of [...bottom.value, ...top.value]) dismiss(each.id);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  clearStack();
  vi.useRealTimers();
});

describe('toast', () => {
  it('puts the notice on the stack the component paints, as data, and returns its id', () => {
    const id = toast({ message: 'Saved' });
    expect(bottom.value).toEqual([{ id, message: 'Saved', tone: 'info', duration: 3000, position: 'bottom' }]);
  });

  it('takes the whole notice in one object: tone, duration, id, action and edge', () => {
    const action = { label: 'Retry', run: vi.fn() };
    toast({ message: 'Offline', tone: 'warning', duration: 0, id: 'net', action, position: 'top' });
    expect(top.value).toEqual([{ id: 'net', message: 'Offline', tone: 'warning', duration: 0, action, position: 'top' }]);
  });

  it('a second notice with the same id replaces the first instead of stacking', () => {
    toast({ message: 'Could not open Sales', tone: 'error', id: 'view-load-failed' });
    toast({ message: 'Could not open Sales again', tone: 'error', id: 'view-load-failed' });
    expect(bottom.value.map((each) => each.message)).toEqual(['Could not open Sales again']);
  });
});

describe('the shortcuts', () => {
  it('each sets its tone, and with it its time on screen', () => {
    const shown = (show: () => string) => {
      clearStack();
      show();
      return bottom.value.map(({ message, tone, duration }) => [message, tone, duration]);
    };
    expect(shown(() => toastSuccess('Saved'))).toEqual([['Saved', 'success', 3000]]);
    expect(shown(() => toastInfo('FYI'))).toEqual([['FYI', 'info', 3000]]);
    expect(shown(() => toastWarning('Low stock'))).toEqual([['Low stock', 'warning', 4000]]);
    expect(shown(() => toastError('Could not save'))).toEqual([['Could not save', 'error', 5000]]);
  });

  it('take the rest of the notice as options', () => {
    const run = vi.fn();
    const id = toastError('Could not open Sales', { id: 'open', duration: 0, action: { label: 'Retry', run }, position: 'top' });
    expect(id).toBe('open');
    expect(top.value).toEqual([
      { id: 'open', message: 'Could not open Sales', tone: 'error', duration: 0, action: { label: 'Retry', run }, position: 'top' },
    ]);
  });
});

describe('dismissToast', () => {
  it('withdraws the notice once what it says stops being true, and says whether there was one', () => {
    const id = toastWarning('Offline', { duration: 0 });
    expect(dismissToast(id)).toBe(true);
    expect(bottom.value).toEqual([]);
    expect(dismissToast(id)).toBe(false);
  });

  it('a notice already gone by its time is not a failure', () => {
    const id = toastSuccess('Saved');
    vi.advanceTimersByTime(3000);
    expect(dismissToast(id)).toBe(false);
  });
});

describe('one stack, painted by one component', () => {
  it("nothing in the library draws its own toast with Ionic's toastController or ion-toast", () => {
    const own = /\btoastController\b|<ion-toast\b|\bIonToast\b/;
    const drawing = versionedFiles()
      .filter((path) => /^src\/.*\.(?:ts|vue)$/.test(path) && path !== 'src/shell/toast.test.ts')
      .filter((path) => own.test(readRepoFile(path) ?? ''));
    expect(drawing).toEqual([]);
  });

  it('exports no window-event hook for csvExport/csvImport', () => {
    expect(toastModule).not.toHaveProperty('bootActionFeedback');
  });
});
