import { beforeEach, describe, expect, it, vi } from 'vitest';

const { present, create, dismiss } = vi.hoisted(() => {
  const present = vi.fn();
  return { present, create: vi.fn(async () => ({ present })), dismiss: vi.fn() };
});
vi.mock('@ionic/vue', () => ({ toastController: { create, dismiss } }));

import { bootActionFeedback, dismissToast, toast, toastError, toastInfo, toastSuccess } from './toast';

beforeEach(() => {
  create.mockClear();
  present.mockClear();
  dismiss.mockReset();
});

describe('toast', () => {
  it('toastSuccess: success color, 2600 ms, bottom, an OK close button', async () => {
    await toastSuccess('Saved');
    expect(create).toHaveBeenCalledWith({
      message: 'Saved',
      color: 'success',
      duration: 2600,
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    expect(present).toHaveBeenCalledTimes(1);
  });

  it('toastError: danger color and a longer 4500 ms', async () => {
    await toastError('Boom');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ color: 'danger', duration: 4500, message: 'Boom' }));
  });

  it('toastInfo: primary color', async () => {
    await toastInfo('FYI');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ color: 'primary', duration: 2600 }));
  });

  it('adds an id and an action button before the close button', async () => {
    const handler = vi.fn();
    await toast('Retry?', 'warning', 0, 'retry-id', { text: 'Retry', handler });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'retry-id',
        duration: 0,
        buttons: [{ text: 'Retry', handler }, { text: 'OK', role: 'cancel' }],
      }),
    );
  });

  it('dismissToast returns false instead of throwing when the toast is gone', async () => {
    dismiss.mockRejectedValueOnce(new Error('gone'));
    expect(await dismissToast('x')).toBe(false);
    dismiss.mockResolvedValueOnce(true);
    expect(await dismissToast('x')).toBe(true);
    expect(dismiss).toHaveBeenCalledWith(undefined, undefined, 'x');
  });
});

describe('bootActionFeedback', () => {
  const t = (key: string, named?: Record<string, unknown>): string =>
    named ? `${key}:${String(named.n)}` : key;

  it('announces CSV export/import once, counting rows when it can', async () => {
    bootActionFeedback(t);
    bootActionFeedback(t); // idempotent
    window.dispatchEvent(new CustomEvent('csvExport', { detail: { rows: 12 } }));
    window.dispatchEvent(new CustomEvent('csvImport', { detail: { rows: [{}, {}, {}] } }));
    window.dispatchEvent(new CustomEvent('csvImport', { detail: { rows: 'x' } }));
    await new Promise((r) => setTimeout(r, 0));
    const messages = (create.mock.calls as unknown as Array<[{ message: string }]>).map((c) => c[0].message);
    expect(messages).toEqual([
      'actionFeedback.csvExportedRows:12',
      'actionFeedback.csvImportedRows:3',
      'actionFeedback.csvImported',
    ]);
  });
});
