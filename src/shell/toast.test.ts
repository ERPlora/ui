import { beforeEach, describe, expect, it, vi } from 'vitest';

const { present, create, dismiss } = vi.hoisted(() => {
  const present = vi.fn();
  return { present, create: vi.fn(async () => ({ present })), dismiss: vi.fn() };
});
vi.mock('@ionic/vue', () => ({ toastController: { create, dismiss } }));

import * as toastModule from './toast';
import { dismissToast, toast, toastError, toastInfo, toastSuccess } from './toast';

beforeEach(() => {
  document.documentElement.lang = 'en';
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

  // The close button is the shell's text, in the language of the page: `<html lang>`, which
  // createShell keeps in step with the person's language (`base.session.me.language`).
  it('the close button speaks the language of the page (shell catalogue, en + es)', async () => {
    document.documentElement.lang = 'es';
    await toastSuccess('Guardado');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ buttons: [{ text: 'Aceptar', role: 'cancel' }] }));
    const handler = vi.fn();
    await toast('¿Reintentar?', 'warning', 0, undefined, { text: 'Reintentar', handler });
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ buttons: [{ text: 'Reintentar', handler }, { text: 'Aceptar', role: 'cancel' }] }),
    );
    document.documentElement.lang = 'fr';
    await toastInfo('Info');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ buttons: [{ text: 'OK', role: 'cancel' }] }));
  });

  it('dismissToast returns false instead of throwing when the toast is gone', async () => {
    dismiss.mockRejectedValueOnce(new Error('gone'));
    expect(await dismissToast('x')).toBe(false);
    dismiss.mockResolvedValueOnce(true);
    expect(await dismissToast('x')).toBe(true);
    expect(dismiss).toHaveBeenCalledWith(undefined, undefined, 'x');
  });
});

describe('no global CSV feedback', () => {
  it('exports no window-event hook: the Web Components table that emitted csvExport/csvImport is gone (PLAN §16.11)', () => {
    expect(toastModule).not.toHaveProperty('bootActionFeedback');
  });
});
