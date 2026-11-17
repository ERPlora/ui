import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const anchor = vi.hoisted(() => ({ bar: undefined as unknown as { value: HTMLElement | undefined } }));
vi.mock('./toast-anchor', async () => {
  const { shallowRef } = await import('vue');
  anchor.bar = shallowRef<HTMLElement>();
  return { useToastAnchor: () => anchor.bar };
});

import { createShellI18n } from './i18n';
import { toast, toastError, toastInfo, toastSuccess } from './toast';
import { useToasts } from './toast-store';
import ToastStack from './ToastStack.vue';

let wrapper: VueWrapper | undefined;
let reducedMotion = false;

function mountStack(locale = 'en'): VueWrapper {
  wrapper = mount(ToastStack, { global: { plugins: [createShellI18n({ locale })] }, attachTo: document.body });
  return wrapper;
}

const stackAt = (edge: 'bottom' | 'top') => wrapper!.get(`[data-testid="toast-stack"][data-position="${edge}"]`);
const toastsAt = (edge: 'bottom' | 'top') => stackAt(edge).findAll('[data-testid="toast"]');
const messagesAt = (edge: 'bottom' | 'top') => toastsAt(edge).map((each) => each.get('.ep-toast__message').text());
const listAt = (edge: 'bottom' | 'top') => stackAt(edge).get('.ep-toast-stack__list');
const styleOf = (el: Element, name: string) => (el as HTMLElement).style.getPropertyValue(name);

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced-motion') && reducedMotion,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  const stack = useToasts();
  stack.resume();
  for (let left = [...stack.bottom.value, ...stack.top.value]; left.length; left = [...stack.bottom.value, ...stack.top.value]) {
    for (const each of left) stack.dismiss(each.id);
  }
  anchor.bar.value = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('ToastStack: what it paints', () => {
  it('paints the toasts of the central stack, newest first, without the screen mounting anything', async () => {
    mountStack();
    toastSuccess('Product saved');
    toastInfo('Ticket sent to the kitchen');
    await flushPromises();
    expect(messagesAt('bottom')).toEqual(['Ticket sent to the kitchen', 'Product saved']);
    expect(toastsAt('bottom').map((each) => each.attributes('data-tone'))).toEqual(['info', 'success']);
  });

  it('is two named regions, bottom and top, each with its own toasts', async () => {
    mountStack('es');
    toastSuccess('Guardado');
    toastInfo('Cobro a la vista', { position: 'top' });
    await flushPromises();
    for (const edge of ['bottom', 'top'] as const) {
      expect(stackAt(edge).element.tagName).toBe('SECTION');
      expect(stackAt(edge).attributes('aria-label')).toBe('Notificaciones');
    }
    expect(messagesAt('bottom')).toEqual(['Guardado']);
    expect(messagesAt('top')).toEqual(['Cobro a la vista']);
  });

  it('shows three at most: the newest in front, each one behind higher and smaller', async () => {
    mountStack();
    for (const message of ['One', 'Two', 'Three', 'Four']) toastInfo(message);
    await flushPromises();
    const shown = toastsAt('bottom');
    expect(messagesAt('bottom')).toEqual(['Three', 'Two', 'One']);
    expect(shown.map((each) => styleOf(each.element, '--y'))).toEqual(['0px', '-14px', '-28px']);
    expect(shown.map((each) => styleOf(each.element, '--scale'))).toEqual(['1', '0.95', '0.9']);
    expect(shown.map((each) => each.classes('is-front'))).toEqual([true, false, false]);
  });

  it('the top stack peeks downwards and slides its toasts up', async () => {
    mountStack();
    toastInfo('One', { position: 'top' });
    toastInfo('Two', { position: 'top' });
    await flushPromises();
    expect(toastsAt('top').map((each) => styleOf(each.element, '--y'))).toEqual(['0px', '14px']);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const front = toastsAt('top')[0].element;
    front.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 0, bubbles: true }));
    front.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: -100, bubbles: true }));
    front.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: -100, bubbles: true }));
    await flushPromises();
    expect(messagesAt('top')).toEqual(['One']);
  });

  it('sits above the bottom bar of the screen on view, and on the edge when the screen has none', async () => {
    const bar = document.createElement('ion-footer');
    bar.getBoundingClientRect = () => ({ top: window.innerHeight - 68 }) as DOMRect;
    anchor.bar.value = bar;
    mountStack();
    toastInfo('Saved');
    await flushPromises();
    expect((stackAt('bottom').element as HTMLElement).style.bottom).toBe('80px');
    anchor.bar.value = undefined;
    toastInfo('Again');
    await flushPromises();
    expect((stackAt('bottom').element as HTMLElement).style.bottom).toBe('');
  });

  it('moves above the bar once it is found, a frame after the toast came', async () => {
    mountStack();
    toastInfo('Saved');
    await flushPromises();
    expect((stackAt('bottom').element as HTMLElement).style.bottom).toBe('');
    const bar = document.createElement('ion-footer');
    bar.getBoundingClientRect = () => ({ top: window.innerHeight - 68 }) as DOMRect;
    anchor.bar.value = bar;
    await flushPromises();
    expect((stackAt('bottom').element as HTMLElement).style.bottom).toBe('80px');
  });

  it('is centred on the content beside the docked assistant, not on the window', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ToastStack.vue'), 'utf8');
    expect(source).toMatch(/:global\(html\.assistant-docked\) \.ep-toast-stack \{\s*right: var\(--assistant-width, 0px\);/);
  });
});

describe('ToastStack: what the person does', () => {
  it('runs the action of a toast, which closes it', async () => {
    mountStack();
    const run = vi.fn();
    toast({ message: 'Ticket voided', action: { label: 'Undo', run } });
    await flushPromises();
    await toastsAt('bottom')[0].get('.ep-toast__action').trigger('click');
    expect(run).toHaveBeenCalledOnce();
    expect(toastsAt('bottom')).toHaveLength(0);
  });

  it('closes a toast with its close button', async () => {
    mountStack();
    toastError('Could not print');
    await flushPromises();
    await toastsAt('bottom')[0].get('.ep-toast__close').trigger('click');
    expect(toastsAt('bottom')).toHaveLength(0);
  });

  it('dismisses a toast slid away, and the one behind comes to the front', async () => {
    mountStack();
    toastInfo('Behind');
    toastInfo('In front');
    await flushPromises();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const front = toastsAt('bottom')[0].element;
    front.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 0, bubbles: true }));
    front.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 0, bubbles: true }));
    front.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 0, bubbles: true }));
    await flushPromises();
    expect(messagesAt('bottom')).toEqual(['Behind']);
    expect(toastsAt('bottom')[0].classes('is-front')).toBe(true);
  });

  it('Esc closes the focused toast and the focus goes on to the next one', async () => {
    mountStack();
    toastInfo('Behind');
    toastInfo('In front');
    await flushPromises();
    (toastsAt('bottom')[0].element as HTMLElement).focus();
    await toastsAt('bottom')[0].trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(messagesAt('bottom')).toEqual(['Behind']);
    expect(document.activeElement).toBe(toastsAt('bottom')[0].element);
  });
});

describe('ToastStack: open while it has the attention, its time paused', () => {
  it('the mouse over it opens it into a list and stops the clock; leaving closes it and the clock runs again', async () => {
    mountStack();
    toastSuccess('Saved');
    await flushPromises();
    await listAt('bottom').trigger('pointerenter', { pointerType: 'mouse' });
    expect(stackAt('bottom').classes('is-expanded')).toBe(true);
    vi.advanceTimersByTime(10_000);
    await flushPromises();
    expect(toastsAt('bottom')).toHaveLength(1);
    await listAt('bottom').trigger('pointerleave', { pointerType: 'mouse' });
    expect(stackAt('bottom').classes('is-expanded')).toBe(false);
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(toastsAt('bottom')).toHaveLength(0);
  });

  it('with the mouse and the focus inside, it resumes only once both have left', async () => {
    mountStack();
    toastSuccess('Saved');
    await flushPromises();
    await listAt('bottom').trigger('pointerenter', { pointerType: 'mouse' });
    await stackAt('bottom').trigger('focusin');
    await listAt('bottom').trigger('pointerleave', { pointerType: 'mouse' });
    vi.advanceTimersByTime(10_000);
    await flushPromises();
    expect(toastsAt('bottom')).toHaveLength(1);
    await stackAt('bottom').trigger('focusout', { relatedTarget: document.body });
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(toastsAt('bottom')).toHaveLength(0);
  });

  it('a finger hovering is not a mouse: only a tap opens it, and a touch elsewhere closes it', async () => {
    mountStack();
    toastSuccess('Saved');
    await flushPromises();
    await listAt('bottom').trigger('pointerenter', { pointerType: 'touch' });
    expect(stackAt('bottom').classes('is-expanded')).toBe(false);
    const front = toastsAt('bottom')[0].element;
    front.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', button: 0, bubbles: true }));
    front.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }));
    await flushPromises();
    expect(stackAt('bottom').classes('is-expanded')).toBe(true);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    await flushPromises();
    expect(stackAt('bottom').classes('is-expanded')).toBe(false);
  });

  it('open, each toast sits past the ones in front of it, at full size', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('ep-toast__body') ? 56 : 0;
    });
    mountStack();
    for (const message of ['One', 'Two', 'Three']) toastInfo(message);
    await flushPromises();
    expect((listAt('bottom').element as HTMLElement).style.height).toBe('84px');
    await listAt('bottom').trigger('pointerenter', { pointerType: 'mouse' });
    await flushPromises();
    expect(toastsAt('bottom').map((each) => styleOf(each.element, '--y'))).toEqual(['0px', '-64px', '-128px']);
    expect(toastsAt('bottom').map((each) => styleOf(each.element, '--scale'))).toEqual(['1', '1', '1']);
    expect((listAt('bottom').element as HTMLElement).style.height).toBe('184px');
  });

  it('once its last toast leaves, it forgets the attention it had and the next toast keeps its time', async () => {
    mountStack();
    toastError('Could not print');
    await flushPromises();
    await listAt('bottom').trigger('pointerenter', { pointerType: 'mouse' });
    await toastsAt('bottom')[0].get('.ep-toast__close').trigger('click');
    await flushPromises();
    expect(stackAt('bottom').classes('is-expanded')).toBe(false);
    toastSuccess('Saved');
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(toastsAt('bottom')).toHaveLength(0);
  });
});

describe('ToastStack: going away', () => {
  it('gives the clocks back if it goes while it holds them stopped', async () => {
    mountStack();
    toastSuccess('Saved');
    await flushPromises();
    await listAt('bottom').trigger('pointerenter', { pointerType: 'mouse' });
    wrapper!.unmount();
    wrapper = undefined;
    vi.advanceTimersByTime(3000);
    expect(useToasts().bottom.value).toEqual([]);
  });
});

describe('ToastStack: motion', () => {
  it('with reduced motion the stack only fades: no animated depth', async () => {
    reducedMotion = true;
    mountStack();
    expect(stackAt('bottom').classes('is-reduced-motion')).toBe(true);
    expect(stackAt('top').classes('is-reduced-motion')).toBe(true);
  });

  it('without it, the toasts move', () => {
    mountStack();
    expect(stackAt('bottom').classes('is-reduced-motion')).toBe(false);
  });
});
