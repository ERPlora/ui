import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { join } from 'node:path';

import { componentCss, declaration } from '../components/__tests__/themeContrast';
import { unnamedButtons, unnamedIcons } from '../testing/a11y';
import { createShellI18n } from './i18n';
import type { Toast } from './toast-store';
import ToastItem from './ToastItem.vue';

function toastOf(overrides: Partial<Toast> = {}): Toast {
  return { id: 't1', message: 'Product saved', tone: 'success', duration: 3000, position: 'bottom', ...overrides };
}

function mountItem(toast: Toast = toastOf(), { locale = 'en', away = 'down' } = {}) {
  return mount(ToastItem, {
    props: { toast, away: away as 'down' | 'up' },
    global: { plugins: [createShellI18n({ locale })] },
    attachTo: document.body,
  });
}

let now = 0;

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** A pointer at (x, y) at time `t` ms. */
function pointer(type: string, x: number, y: number, t: number, pointerType = 'mouse'): PointerEvent {
  now = t;
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType, button: 0, bubbles: true });
}

/** Slides the toast by `points`, starting at (0, 0) at t = 0, and lifts the finger at `liftAt` ms. */
async function slide(el: Element, points: [number, number, number][], liftAt: number, pointerType = 'mouse') {
  el.dispatchEvent(pointer('pointerdown', 0, 0, 0, pointerType));
  for (const [x, y, t] of points) el.dispatchEvent(pointer('pointermove', x, y, t, pointerType));
  const [x, y] = points.at(-1) ?? [0, 0];
  el.dispatchEvent(pointer('pointerup', x, y, liftAt, pointerType));
  await flushPromises();
}

describe('ToastItem: one toast', () => {
  it('says its message, with the selectors the browser tests of hub and saas use', () => {
    const el = mountItem().get('[data-testid="toast"]');
    expect(el.text()).toContain('Product saved');
    expect(el.attributes('data-tone')).toBe('success');
    expect(el.attributes('data-toast-id')).toBe('t1');
  });

  it('is a polite status, and an alert when it is an error', () => {
    for (const tone of ['success', 'info', 'warning'] as const) {
      expect(mountItem(toastOf({ tone })).get('.ep-toast').attributes('role'), tone).toBe('status');
    }
    expect(mountItem(toastOf({ tone: 'error' })).get('.ep-toast').attributes('role')).toBe('alert');
  });

  it('shows a different, decorative icon for each tone, so colour is never the only sign', () => {
    const names = (['success', 'error', 'info', 'warning'] as const).map((tone) => {
      const icon = mountItem(toastOf({ tone })).get('.ep-toast__icon');
      expect(icon.attributes('aria-hidden'), tone).toBe('true');
      // Vue sets `name` on ion-icon as a property, not an attribute.
      return (icon.element as HTMLElement & { name?: string }).name;
    });
    expect(names).toEqual(['checkmark-circle', 'alert-circle', 'information-circle', 'warning']);
  });

  it('is reachable by keyboard', () => {
    expect(mountItem().get('.ep-toast').attributes('tabindex')).toBe('0');
  });

  it('offers its action as a text button that asks for it to run', async () => {
    const wrapper = mountItem(toastOf({ action: { label: 'Undo', run: vi.fn() } }));
    const button = wrapper.get('ion-button.ep-toast__action');
    expect(button.text()).toBe('Undo');
    await button.trigger('click');
    expect(wrapper.emitted('action')).toHaveLength(1);
    expect(mountItem().find('ion-button.ep-toast__action').exists()).toBe(false);
  });

  it('has a close button, named in the page language, only when it does not leave by itself or is an error', async () => {
    expect(mountItem().find('.ep-toast__close').exists()).toBe(false);
    expect(mountItem(toastOf({ tone: 'error' })).get('.ep-toast__close').attributes('aria-label')).toBe('Close');
    const sticky = mountItem(toastOf({ duration: 0 }), { locale: 'es' });
    expect(sticky.get('.ep-toast__close').attributes('aria-label')).toBe('Cerrar');
    await sticky.get('.ep-toast__close').trigger('click');
    expect(sticky.emitted('dismiss')).toHaveLength(1);
  });

  it('every button and icon is named or decorative', () => {
    const wrapper = mountItem(toastOf({ tone: 'error', action: { label: 'Retry', run: vi.fn() } }));
    expect(unnamedButtons(wrapper.element)).toEqual([]);
    expect(unnamedIcons(wrapper.element)).toEqual([]);
  });

  it('Esc with the focus on it closes it, and does not reach a dialog underneath', async () => {
    const underneath = vi.fn();
    document.addEventListener('keydown', underneath);
    const wrapper = mountItem();
    await wrapper.get('.ep-toast').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
    expect(underneath).not.toHaveBeenCalled();
    document.removeEventListener('keydown', underneath);
  });
});

describe('ToastItem: a long message', () => {
  const css = componentCss(join(__dirname, 'ToastItem.vue'));

  it('stops at two lines, and its box has no vertical padding where a third line would show', () => {
    expect(declaration(css, '.ep-toast__message', '-webkit-line-clamp')).toBe('2');
    expect(declaration(css, '.ep-toast__message', 'overflow')).toBe('hidden');
    for (const property of ['padding', 'padding-block', 'padding-top', 'padding-bottom']) {
      expect(declaration(css, '.ep-toast__message', property), property).toBeUndefined();
    }
  });
});

describe('ToastItem: sliding it away', () => {
  it('follows the finger while it slides', () => {
    const wrapper = mountItem();
    const el = wrapper.get('.ep-toast').element as HTMLElement;
    el.dispatchEvent(pointer('pointerdown', 0, 0, 0));
    el.dispatchEvent(pointer('pointermove', 40, 2, 200));
    return wrapper.vm.$nextTick().then(() => {
      expect(el.style.getPropertyValue('--drag-x')).toBe('40px');
      expect(el.classList.contains('is-dragging')).toBe(true);
    });
  });

  it('past 90 px it leaves on the side it was slid to', async () => {
    const wrapper = mountItem();
    const el = wrapper.get('.ep-toast').element;
    await slide(el, [[-40, 0, 200], [-95, 0, 600]], 610);
    expect(el.getAttribute('data-swipe')).toBe('left');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('a short, fast flick dismisses it too', async () => {
    const wrapper = mountItem();
    await slide(wrapper.get('.ep-toast').element, [[10, 0, 20], [40, 0, 50]], 55);
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('a short, slow slide puts it back in its place', async () => {
    const wrapper = mountItem();
    const el = wrapper.get('.ep-toast').element as HTMLElement;
    await slide(el, [[20, 0, 200], [40, 0, 400]], 410);
    expect(wrapper.emitted('dismiss')).toBeUndefined();
    expect(el.style.getPropertyValue('--drag-x')).toBe('0px');
    expect(el.classList.contains('is-dragging')).toBe(false);
  });

  it('down at the bottom edge, up at the top one', async () => {
    const bottom = mountItem();
    await slide(bottom.get('.ep-toast').element, [[0, 40, 300], [0, 100, 600]], 610);
    expect(bottom.emitted('dismiss')).toHaveLength(1);
    const top = mountItem(toastOf({ position: 'top' }), { away: 'up' });
    await slide(top.get('.ep-toast').element, [[0, 40, 300], [0, 100, 600]], 610);
    expect(top.emitted('dismiss')).toBeUndefined();
  });

  it('a press on its buttons is not a slide', async () => {
    const wrapper = mountItem(toastOf({ tone: 'error' }));
    const close = wrapper.get('.ep-toast__close').element;
    close.dispatchEvent(pointer('pointerdown', 0, 0, 0));
    const el = wrapper.get('.ep-toast').element;
    el.dispatchEvent(pointer('pointermove', 120, 0, 300));
    el.dispatchEvent(pointer('pointerup', 120, 0, 310));
    await flushPromises();
    expect(wrapper.emitted('dismiss')).toBeUndefined();
  });

  it('a tap with a finger asks to open the stack; a click with the mouse does not', async () => {
    const wrapper = mountItem();
    const el = wrapper.get('.ep-toast').element;
    await slide(el, [[2, 1, 40]], 60, 'mouse');
    expect(wrapper.emitted('tap')).toBeUndefined();
    await slide(el, [[2, 1, 40]], 60, 'touch');
    expect(wrapper.emitted('tap')).toHaveLength(1);
  });
});
