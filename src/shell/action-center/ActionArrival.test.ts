import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { componentCss, declaration } from '../../components/__tests__/themeContrast';
import { unnamedButtons, unnamedIcons } from '../../testing/a11y';
import HubIcon from '../HubIcon.vue';
import { createShellI18n } from '../i18n';
import ActionArrival from './ActionArrival.vue';
import { connectActionCenter, useActionCenter } from './center';
import { flyToBell } from './flight';
import type { ActionNotice } from './types';

vi.mock('./flight', () => ({ flyToBell: vi.fn() }));

const notice: ActionNotice = {
  id: 'billing.unpaid',
  severity: 'danger',
  icon: 'ion:receipt-outline',
  label: 'Unpaid invoice',
  title: 'An invoice needs paying',
  body: 'Pay it before Friday to keep the hub active.',
  chip: '3 days left',
  action: { label: 'Pay invoice', run: vi.fn() },
};

let wrapper: VueWrapper | undefined;
let disconnect: (() => void) | undefined;
let notices: ReturnType<typeof ref<readonly ActionNotice[] | undefined>>;
let reducedMotion = false;

function mountArrival() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  notices = ref<readonly ActionNotice[] | undefined>([]);
  disconnect = connectActionCenter({ notices, failed: ref(false) });
  wrapper = mount(ActionArrival, {
    global: { plugins: [router, createShellI18n({ locale: 'en' })] },
    attachTo: document.body,
  });
  return wrapper;
}

async function show(item: ActionNotice = notice): Promise<void> {
  notices.value = [item];
  await flushPromises();
}

function pointer(type: string, y: number, time: number): PointerEvent {
  vi.spyOn(performance, 'now').mockReturnValue(time);
  return new PointerEvent(type, { clientY: y, pointerId: 1, pointerType: 'touch', button: 0, bubbles: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced-motion') && reducedMotion,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  wrapper?.unmount();
  disconnect?.();
  wrapper = undefined;
  disconnect = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('ActionArrival', () => {
  it('paints the new notice as glass, with an assertive role only for danger', async () => {
    mountArrival();
    expect(wrapper!.find('[data-testid="action-arrival"]').exists()).toBe(false);
    await show();
    const card = wrapper!.get('[data-testid="action-arrival"]');
    expect(card.classes()).toContain('ep-glass');
    expect(card.attributes('role')).toBe('alert');
    expect(card.findAllComponents(HubIcon)[0]?.props('name')).toBe('ion:receipt-outline');
    expect(card.text()).toContain('An invoice needs paying');
    expect(card.text()).toContain('Pay it before Friday to keep the hub active.');
    expect(card.get('ion-progress-bar').classes()).toContain('action-arrival__time');
    expect(unnamedButtons(card.element)).toEqual([]);
    expect(unnamedIcons(card.element)).toEqual([]);
  });

  it('is a polite status for other severities and falls back to the chip for its one line', async () => {
    mountArrival();
    await show({ ...notice, severity: 'warning', body: undefined });
    const card = wrapper!.get('[data-testid="action-arrival"]');
    expect(card.attributes('role')).toBe('status');
    expect(card.get('.action-arrival__line').text()).toBe('3 days left');
  });

  // A counter of the hub («3 appointments to confirm») brings no phrase and no chip: an empty line left a gap
  // between the title and the button.
  it('without a phrase or a chip keeps no line under the title: icon, title and its button', async () => {
    mountArrival();
    await show({ ...notice, body: undefined, chip: undefined });
    const card = wrapper!.get('[data-testid="action-arrival"]');
    expect(card.find('.action-arrival__line').exists()).toBe(false);
    expect(card.get('h3').text()).toBe('An invoice needs paying');
    expect(card.get('.action-arrival__action').text()).toBe('Pay invoice');
    // Alone, the title sits on the middle of its icon: at its top it left the icon's height empty under it.
    expect(card.get('.action-arrival__top').classes()).toContain('is-title-only');
    const css = componentCss(`${__dirname}/ActionArrival.vue`);
    expect(declaration(css, '.action-arrival__top.is-title-only', 'align-items')).toBe('center');
    await show({ ...notice, id: 'with-phrase' });
    expect(wrapper!.get('.action-arrival__top').classes()).not.toContain('is-title-only');
  });

  it('does not steal focus', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'Current screen';
    document.body.append(outside);
    outside.focus();
    mountArrival();
    await show();
    expect(document.activeElement).toBe(outside);
  });

  it('opens the panel on its notice from the body, by click or keyboard', async () => {
    mountArrival();
    await show();
    await wrapper!.get('.action-arrival__body').trigger('click');
    expect(useActionCenter().open.value).toBe(true);
    expect(useActionCenter().featured.value?.id).toBe(notice.id);
    expect(flyToBell).not.toHaveBeenCalled();

    useActionCenter().closePanel();
    await show({ ...notice, id: 'second' });
    await wrapper!.get('.action-arrival__body').trigger('keydown', { key: 'Enter' });
    expect(useActionCenter().featured.value?.id).toBe('second');
  });

  it('runs the primary action from its own button', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    mountArrival();
    await show({ ...notice, action: { label: 'Pay invoice', run: action } });
    const button = wrapper!.get('ion-button.action-arrival__action');
    expect(button.text()).toBe('Pay invoice');
    await button.trigger('click');
    await flushPromises();
    expect(action).toHaveBeenCalledOnce();
  });

  it('pauses on hover or focus and resumes only after attention leaves', async () => {
    mountArrival();
    await show();
    const card = wrapper!.get('[data-testid="action-arrival"]');
    await card.trigger('mouseenter');
    await card.trigger('focusin');
    await card.trigger('mouseleave');
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(wrapper!.find('[data-testid="action-arrival"]').exists()).toBe(true);
    await card.trigger('focusout', { relatedTarget: document.body });
    vi.advanceTimersByTime(4000);
    await flushPromises();
    expect(useActionCenter().arrival.value).toBeUndefined();
  });

  it('settles into the bell from its keyboard-accessible close button and flies there', async () => {
    mountArrival();
    await show();
    const close = wrapper!.get('ion-button.action-arrival__close');
    const native = close.element.shadowRoot?.querySelector('button') ?? close.element;
    expect(native.getAttribute('aria-label')).toBe('Send to notifications');
    await close.trigger('click');
    await flushPromises();
    expect(useActionCenter().arrival.value).toBeUndefined();
    expect(flyToBell).toHaveBeenCalledOnce();
  });

  it('settles when slid upwards, but puts back a short or downward slide', async () => {
    mountArrival();
    await show();
    const card = wrapper!.get('[data-testid="action-arrival"]');
    card.element.dispatchEvent(pointer('pointerdown', 100, 0));
    card.element.dispatchEvent(pointer('pointermove', 30, 200));
    card.element.dispatchEvent(pointer('pointerup', 30, 400));
    await flushPromises();
    expect(useActionCenter().arrival.value?.id).toBe(notice.id);
    expect((card.element as HTMLElement).style.getPropertyValue('--arrival-drag')).toBe('0px');

    card.element.dispatchEvent(pointer('pointerdown', 100, 0));
    card.element.dispatchEvent(pointer('pointermove', -10, 200));
    card.element.dispatchEvent(pointer('pointerup', -10, 400));
    await flushPromises();
    expect(useActionCenter().arrival.value).toBeUndefined();
    expect(flyToBell).toHaveBeenCalledOnce();
  });

  it('holds arrival cards with reduced motion and releases the hold on unmount', async () => {
    reducedMotion = true;
    mountArrival();
    await show();
    expect(wrapper!.find('[data-testid="action-arrival"]').exists()).toBe(false);
    expect(useActionCenter().pulse.value).toBeGreaterThan(0);
    wrapper!.unmount();
    wrapper = undefined;
    await show({ ...notice, id: 'after' });
    expect(useActionCenter().arrival.value?.id).toBe('after');
  });

  it('positions beside a docked assistant and becomes full-width below 600px', () => {
    const css = componentCss(`${__dirname}/ActionArrival.vue`);
    expect(declaration(css, '.action-arrival-layer', 'position')).toBe('fixed');
    expect(css).toContain(':global(html.assistant-docked .action-arrival-layer)');
    expect(css).toContain('right: calc(var(--assistant-width, 0px) + 20px)');
    expect(css).toContain('@media (max-width: 599px)');
    expect(css).toMatch(/@keyframes action-arrival-countdown\s*\{\s*to\s*\{\s*transform:\s*scaleX\(0\)/);
  });
});
