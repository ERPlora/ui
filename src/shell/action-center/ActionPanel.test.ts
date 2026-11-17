import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { componentCss, declaration } from '../../components/__tests__/themeContrast';
import EmptyState from '../../components/EmptyState/EmptyState.vue';
import { IonModalStub, ionModalStubOf } from '../../components/FormModal/__tests__/ionModalStub';
import InlineFeedback from '../../components/InlineFeedback/InlineFeedback.vue';
import { unnamedButtons, unnamedIcons } from '../../testing/a11y';
import { createShellI18n } from '../i18n';
import { cleanupCenter } from './__tests__/fixtures';
import ActionPanel from './ActionPanel.vue';
import { connectActionCenter, useActionCenter } from './center';
import type { ActionNotice, ActionNoticeSource } from './types';

const urgent: ActionNotice = {
  id: 'billing.unpaid',
  severity: 'danger',
  icon: 'ion:receipt-outline',
  label: 'Unpaid invoice',
  title: 'An invoice needs paying',
  body: 'Pay it before Friday.',
  figure: '29.00 €',
  chip: '3 days left',
  action: { label: 'Pay invoice', to: '/billing' },
  secondary: { label: 'Change card', to: '/billing/card' },
};
const printer: ActionNotice = {
  id: 'printer',
  severity: 'warning',
  icon: 'ion:cloud-offline-outline',
  label: 'Printer offline',
  title: 'The kitchen printer is offline',
  chip: 'Offline',
  action: { label: 'View printers', to: '/billing' },
};

let wrapper: VueWrapper | undefined;
let disconnect: (() => void) | undefined;
let notices: ReturnType<typeof ref<readonly ActionNotice[] | undefined>>;
let router: Router;

async function mountPanel(
  items: readonly ActionNotice[] | undefined = [urgent, printer],
  { failed = false, retry, locale = 'en', loading = false }: { failed?: boolean; retry?: () => void; locale?: string; loading?: boolean } = {},
) {
  notices = ref<readonly ActionNotice[] | undefined>(loading ? undefined : items);
  const source: ActionNoticeSource = { notices, failed: ref(failed), retry };
  disconnect = connectActionCenter(source);
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/billing', component: { template: '<div />' } },
      { path: '/billing/card', component: { template: '<div />' } },
    ],
  });
  await router.push('/');
  wrapper = mount(ActionPanel, {
    global: {
      plugins: [router, createShellI18n({ locale })],
      stubs: { IonModal: IonModalStub },
    },
    attachTo: document.body,
  });
  useActionCenter().openPanel();
  await flushPromises();
  return wrapper;
}

afterEach(() => cleanupCenter(wrapper, disconnect));

/** The focus returns on the next task: timers run in order, unlike `flushPromises`, which may run before them. */
const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('ActionPanel', () => {
  it('is an Ionic modal with a translated count, one featured notice and compact rows', async () => {
    await mountPanel();
    const modal = wrapper!.get('[data-testid="action-panel"]');
    expect(modal.attributes('data-stub')).toBe('ion-modal');
    expect(modal.attributes('aria-labelledby')).toBe('action-panel-title');
    const title = wrapper!.get('#action-panel-title');
    expect(title.element.tagName).toBe('H2');
    expect(title.text()).toBe('2 things pending');
    expect(wrapper!.get('.action-panel__heading p').text()).toBe('Sorted by what needs attention');
    expect(wrapper!.get('[data-testid="action-featured"]').text()).toContain('An invoice needs paying');
    expect(wrapper!.findAll('[data-testid="action-row"]')).toHaveLength(1);
    expect(wrapper!.findAll('.action-featured__primary')).toHaveLength(1);
    expect(unnamedButtons(wrapper!.element)).toEqual([]);
    expect(unnamedIcons(wrapper!.element)).toEqual([]);
  });

  it('features a row with a spring transition and keeps one primary action', async () => {
    await mountPanel();
    await wrapper!.get('[data-testid="action-row"]').trigger('click');
    await flushPromises();
    expect(useActionCenter().featured.value?.id).toBe('printer');
    expect(wrapper!.get('[data-testid="action-featured"]').text()).toContain('The kitchen printer is offline');
    expect(wrapper!.findAll('.action-featured__primary')).toHaveLength(1);
  });

  // Before an answer, or after a failure with nothing kept, the panel does not know the count: it never says «nothing».
  it('shows loading before the source has answered, under a plain title', async () => {
    await mountPanel(undefined, { loading: true });
    expect(wrapper!.get('[data-testid="action-panel-loading"]').text()).toBe('Loading notifications…');
    expect(wrapper!.find('ion-spinner').exists()).toBe(true);
    expect(wrapper!.get('#action-panel-title').text()).toBe('Notifications');
    expect(wrapper!.find('.action-panel__heading p').exists()).toBe(false);
  });

  it('shows a useful error and retries the source when it has nothing to show', async () => {
    const retry = vi.fn();
    await mountPanel([], { failed: true, retry });
    const error = wrapper!.get('[data-testid="action-panel-error"]');
    expect(error.findComponent(EmptyState).props('heading')).toBe('Could not load notifications');
    expect(error.text()).toContain('Check the connection and try again.');
    expect(wrapper!.get('#action-panel-title').text()).toBe('Notifications');
    await wrapper!.get('[data-testid="action-panel-retry"]').trigger('click');
    expect(retry).toHaveBeenCalledOnce();
  });

  // The source keeps what it gave last when it fails: those notices are still true, so they stay in the panel under a
  // warning that they may be out of date, instead of being hidden behind a full error.
  it('keeps the last notices under an inline warning when the source fails after answering', async () => {
    const retry = vi.fn();
    await mountPanel([urgent, printer], { failed: true, retry });
    expect(wrapper!.find('[data-testid="action-panel-error"]').exists()).toBe(false);
    const stale = wrapper!.get('[data-testid="action-panel-stale"]');
    expect(stale.findComponent(InlineFeedback).props('tone')).toBe('warning');
    expect(stale.text()).toContain('Could not refresh the notifications.');
    expect(wrapper!.get('[data-testid="action-featured"]').text()).toContain('An invoice needs paying');
    await stale.get('[data-testid="action-panel-retry"]').trigger('click');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows all caught up when opened without notices, with no count or order to speak of', async () => {
    await mountPanel([]);
    const empty = wrapper!.get('[data-testid="action-panel-empty"]');
    expect(empty.findComponent(EmptyState).props('heading')).toBe('All caught up');
    expect(wrapper!.get('#action-panel-title').text()).toBe('Nothing pending');
    expect(wrapper!.find('.action-panel__heading p').exists()).toBe(false);
  });

  it('keeps a resolved notice under the drawn check before removing it', async () => {
    vi.useFakeTimers();
    await mountPanel();
    notices.value = [printer];
    await vi.advanceTimersByTimeAsync(0);
    expect(useActionCenter().resolved.value.has(urgent.id)).toBe(true);
    expect(wrapper!.get('[data-testid="action-featured"]').attributes('data-resolved')).toBe('true');
    expect(wrapper!.text()).toContain('Resolved');
    await vi.advanceTimersByTimeAsync(1200);
    expect(useActionCenter().featured.value?.id).toBe('printer');
  });

  it('shows all caught up before closing itself after the last resolution', async () => {
    vi.useFakeTimers();
    await mountPanel([urgent]);
    notices.value = [];
    await vi.advanceTimersByTimeAsync(1200);
    expect(useActionCenter().allClear.value).toBe(true);
    expect(wrapper!.get('[data-testid="action-panel-empty"]').text()).toContain('All caught up');
    await vi.advanceTimersByTimeAsync(1800);
    expect(useActionCenter().open.value).toBe(false);
  });

  // While its dismissal events run, Ionic's focus trap still holds the dialog and pulls any focus back inside it; then
  // it restores the focus it found when the dialog opened. The bell takes the focus once both have let go.
  it('closes from its visible button and returns focus to the bell once Ionic lets the dialog go', async () => {
    const bell = document.createElement('button');
    bell.dataset.actionBell = '';
    document.body.append(bell);
    await mountPanel();
    await wrapper!.get('[data-testid="action-panel-close"]').trigger('click');
    expect(useActionCenter().open.value).toBe(false);
    expect(document.activeElement).not.toBe(bell);
    await nextTask();
    expect(document.activeElement).toBe(bell);
  });

  it('returns focus to the bell of the screen on view, not to one of a page Ionic keeps behind', async () => {
    const behind = document.createElement('div');
    behind.className = 'ion-page ion-page-hidden';
    const hiddenBell = document.createElement('button');
    hiddenBell.dataset.actionBell = '';
    behind.append(hiddenBell);
    const bell = document.createElement('button');
    bell.dataset.actionBell = '';
    document.body.append(behind, bell);
    await mountPanel();
    await wrapper!.get('[data-testid="action-panel-close"]').trigger('click');
    await nextTask();
    expect(document.activeElement).toBe(bell);
  });

  it('returns focus into the button that Ionic renders inside the bell', async () => {
    const bell = document.createElement('div');
    bell.dataset.actionBell = '';
    const native = document.createElement('button');
    bell.attachShadow({ mode: 'open' }).append(native);
    document.body.append(bell);
    await mountPanel();
    await wrapper!.get('[data-testid="action-panel-close"]').trigger('click');
    await nextTask();
    expect(bell.shadowRoot!.activeElement).toBe(native);
  });

  it.each(['backdrop', 'Escape'])('closes from %s through Ionic', async (kind) => {
    await mountPanel();
    const modal = wrapper!.get('[data-testid="action-panel"]');
    if (kind === 'backdrop') await ionModalStubOf(modal.element).tapBackdrop();
    else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await flushPromises();
    }
    expect(useActionCenter().open.value).toBe(false);
  });

  it('uses the shared action navigation and closes on a destination', async () => {
    await mountPanel();
    await wrapper!.get('.action-featured__primary').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/billing');
    expect(useActionCenter().open.value).toBe(false);
  });

  it('puts glass on the modal content, floats at 400px and fills a phone safely', () => {
    const css = componentCss(`${__dirname}/ActionPanel.vue`);
    expect(declaration(css, '.action-panel::part(content)', 'width')).toBe('400px');
    expect(declaration(css, '.action-panel::part(content)', 'background')).toBe('var(--ep-glass-bg)');
    expect(declaration(css, '.action-panel::part(content)', 'backdrop-filter')).toBe('var(--ep-glass-backdrop)');
    expect(declaration(css, '.action-panel', '--background')).toBe('transparent');
    expect(css).toContain('@media (max-width: 599px)');
    expect(css).toContain('var(--ion-safe-area-top, 0px)');
    expect(css).toContain('var(--ion-safe-area-bottom, 0px)');
    expect(declaration(css, '.action-panel', '--backdrop-opacity')).toBe('0.12');
  });
});
