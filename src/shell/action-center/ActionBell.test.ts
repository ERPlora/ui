import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { blocks, componentCss, declaration } from '../../components/__tests__/themeContrast';
import { unnamedButtons, unnamedIcons } from '../../testing/a11y';
import HubIcon from '../HubIcon.vue';
import { createShellI18n } from '../i18n';
import { cleanupCenter } from './__tests__/fixtures';
import ActionBell from './ActionBell.vue';
import { connectActionCenter, useActionCenter } from './center';
import type { ActionNotice } from './types';

const notice: ActionNotice = {
  id: 'billing.unpaid',
  severity: 'danger',
  icon: 'ion:receipt-outline',
  label: 'Unpaid invoice',
  title: 'An invoice needs paying',
  chip: '3 days left',
  due: { from: '2026-11-10T00:00:00Z', at: '2026-11-20T00:00:00Z' },
};

let wrapper: VueWrapper | undefined;
let disconnect: (() => void) | undefined;
let notices: ReturnType<typeof ref<readonly ActionNotice[] | undefined>>;

/** `null` items: the source has not answered yet. */
function mountBell(items: readonly ActionNotice[] | null = [], locale = 'en', failed = false): VueWrapper {
  notices = ref<readonly ActionNotice[] | undefined>(items ?? undefined);
  disconnect = connectActionCenter({ notices: notices, failed: ref(failed) });
  wrapper = mount(ActionBell, {
    global: { plugins: [createShellI18n({ locale })] },
    attachTo: document.body,
  });
  return wrapper;
}

afterEach(() => cleanupCenter(wrapper, disconnect));

describe('ActionBell', () => {
  it('is only a bell when nothing is pending', () => {
    const bell = mountBell().get('[data-testid="action-bell"]');
    expect(bell.attributes('aria-expanded')).toBe('false');
    expect(bell.attributes('aria-label')).toBeUndefined();
    expect(bell.get('.action-bell__name').text()).toBe('Notifications, nothing pending');
    expect(bell.find('ion-badge').exists()).toBe(false);
    expect(bell.find('.action-bell__ring').exists()).toBe(false);
    expect(bell.find('.action-bell__severity').exists()).toBe(false);
    expect(unnamedButtons(bell.element)).toEqual([]);
    expect(unnamedIcons(bell.element)).toEqual([]);
  });

  // Before the source answers, or when it fails having given nothing, the bell does not know the count.
  it('never says «nothing pending» while it does not know', () => {
    expect(mountBell(null).get('.action-bell__name').text()).toBe('Notifications, loading');
    cleanupCenter(wrapper, disconnect);
    expect(mountBell([], 'es', true).get('.action-bell__name').text()).toBe('Avisos, no se pudieron cargar');
  });

  it('summarizes the total and highest severity with an icon, not colour alone', () => {
    const bell = mountBell([
      notice,
      { ...notice, id: 'printer', severity: 'warning', count: 2 },
      { ...notice, id: 'card', severity: 'info' },
    ]).get('[data-testid="action-bell"]');
    expect(bell.classes()).toContain('has-notices');
    expect(bell.attributes('data-severity')).toBe('danger');
    expect(bell.get('ion-badge').text()).toBe('4');
    expect(bell.findAllComponents(HubIcon)[1]?.props('name')).toBe('ion:alert-circle');
    expect(bell.get('.action-bell__name').text()).toBe('4 notifications pending. Urgent: Unpaid invoice');
  });

  it.each([
    ['warning', 'ion:warning'],
    ['info', 'ion:information-circle'],
  ] as const)('marks a highest severity of %s with its own icon', (severity, icon) => {
    const mounted = mountBell([{ ...notice, severity }]);
    expect(mounted.get('[data-testid="action-bell"]').attributes('data-severity')).toBe(severity);
    const severityIcon = mounted.findAllComponents(HubIcon).find((each) => each.classes('action-bell__severity'));
    expect(severityIcon?.props('name')).toBe(icon);
  });

  it('translates and pluralizes its hidden accessible name without freezing an Ionic aria-label', async () => {
    const bell = mountBell([notice], 'es');
    expect(bell.get('.action-bell__name').text()).toBe('1 aviso pendiente. Urgente: Unpaid invoice');
    notices.value = [notice, { ...notice, id: 'second' }];
    await flushPromises();
    expect(bell.get('.action-bell__name').text()).toBe('2 avisos pendientes. Urgente: Unpaid invoice');
    expect(bell.get('[data-testid="action-bell"]').attributes('aria-label')).toBeUndefined();
  });

  it.each([1, 3, 6, 12])('paints %i pending as one pill: the ring, the count and the severity icon side by side', (count) => {
    const bell = mountBell([{ ...notice, count }]);
    const pill = bell.get('[data-testid="action-bell"] .action-bell__pill');
    const known = ['action-bell__ring', 'action-bell__count', 'action-bell__severity'];
    const parts = [...pill.element.children].map((child) => known.find((name) => child.classList.contains(name)));
    expect(parts).toEqual(['action-bell__ring', 'action-bell__count', 'action-bell__severity']);
    expect(pill.get('.action-bell__count').text()).toBe(String(count));
  });

  it('shows the remaining due time in its ring', () => {
    const ring = mountBell([notice]).get('.action-bell__ring');
    const expected = String(1 - useActionCenter().dueProgress.value!);
    expect((ring.element as HTMLElement).style.getPropertyValue('--due-remaining')).toBe(expected);
    expect(ring.attributes('data-progress')).toBe(expected);
  });

  it('pulses once whenever the center pulse changes', async () => {
    vi.useFakeTimers();
    const bell = mountBell([notice]).get('[data-testid="action-bell"]');
    expect(bell.classes()).not.toContain('is-pulsing');
    const before = useActionCenter().pulse.value;
    notices.value = [
      ...notices.value!,
      { ...notice, id: 'printer', severity: 'warning' },
      { ...notice, id: 'card', severity: 'info' },
    ];
    await flushPromises();
    expect(useActionCenter().pulse.value).not.toBe(before);
    expect(bell.classes()).toContain('is-pulsing');
    vi.advanceTimersByTime(449);
    expect(bell.classes()).toContain('is-pulsing');
    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(bell.classes()).not.toContain('is-pulsing');
  });

  it('offers the most urgent title and chip in a hover pill outside Ionic stacking and clipping', async () => {
    const bell = mountBell([notice]);
    await bell.get('.action-bell-wrap').trigger('pointerenter', { pointerType: 'mouse' });
    const hover = document.body.querySelector<HTMLElement>('.action-bell__hover');
    expect(hover?.textContent).toContain('An invoice needs paying');
    expect(hover?.textContent).toContain('3 days left');
    expect(hover?.classList).toContain('is-visible');
    expect(hover?.parentElement).toBe(document.body);
    expect(hover?.getAttribute('aria-hidden')).toBe('true');
    bell.unmount();
    wrapper = undefined;
    expect(document.body.querySelector('.action-bell__hover')).toBeNull();
  });

  it('opens and closes the panel from the same button', async () => {
    const bell = mountBell([notice]).get('[data-testid="action-bell"]');
    await bell.trigger('click');
    expect(useActionCenter().open.value).toBe(true);
    const native = bell.element.shadowRoot?.querySelector('button') ?? bell.element;
    expect(native.getAttribute('aria-expanded')).toBe('true');
    await bell.trigger('click');
    expect(useActionCenter().open.value).toBe(false);
    expect(native.getAttribute('aria-expanded')).toBe('false');
  });

  it('fits a 40px pill in a 48px touch target and only shows the hover pill for a fine pointer', () => {
    const css = componentCss(`${__dirname}/ActionBell.vue`);
    expect(declaration(css, '.action-bell__pill', 'height')).toBe('40px');
    expect(declaration(css, '.action-bell', 'min-height')).toBe('48px');
    expect(declaration(css, '.action-bell', 'min-width')).toBe('48px');
    expect(declaration(css, '.action-bell-wrap', 'z-index')).toBe('80');
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    expect(declaration(css, '.action-bell__hover', 'position')).toBe('fixed');
    expect(css).toContain('.action-bell__hover.is-visible');
    expect(css).toContain('conic-gradient');
  });

  // Ionic's toolbar gives its buttons a 4px radius over our pill radius, which drew the button's own background as a
  // square patch on the bar, and Ionic's button clips what it holds, which cut the danger halo square: the pill is
  // the only painted surface, the button stays clear in every state and lets the halo out.
  it('paints only its own pill, tinted with the severity, never a box of the Ionic button', () => {
    const css = componentCss(`${__dirname}/ActionBell.vue`);
    expect(declaration(css, '.action-bell', '--overflow')).toBe('visible');
    for (const state of ['--background', '--background-hover', '--background-activated', '--background-focused']) {
      expect(declaration(css, '.action-bell.has-notices', state), state).toBe('transparent');
    }
    expect(declaration(css, '.action-bell.has-notices', 'box-shadow')).toBeUndefined();
    expect(declaration(css, '.action-bell__pill', 'background')).toBe('color-mix(in srgb, var(--tone) 12%, transparent)');
    expect(declaration(css, '.action-bell__pill', 'border-radius')).toBe('var(--ep-radius-pill)');
    expect(declaration(css, '.action-bell__pill', 'gap')).toBe('4px');
    for (const part of ['.action-bell__count', '.action-bell__severity']) {
      expect(declaration(css, part, 'margin'), part).toBeUndefined();
      expect(declaration(css, part, 'margin-left'), part).toBeUndefined();
    }
  });

  it('pulses and presses the pill with transform only', () => {
    const css = componentCss(`${__dirname}/ActionBell.vue`);
    expect(blocks(css, '.action-bell.is-pulsing .action-bell__pill').join()).toContain('action-bell-pulse');
    expect(declaration(css, '.action-bell:active .action-bell__pill', 'transform')).toBe('scale(0.97)');
    expect(css).not.toMatch(/opacity/);
  });
});

