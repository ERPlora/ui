// The FormModal as its tests mount it, and how they reach into it. `unmountModals` (an `afterEach`) unmounts every
// modal `mountModal` mounted since the last call.
import { mount, type VueWrapper } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import { createShellI18n } from '../../../shell/i18n';
import FormModal from '../FormModal.vue';
import type { IonModalStubApi } from './ionModalStub';

export type Props = InstanceType<typeof FormModal>['$props'];
type Slots = Record<string, (props: Record<string, unknown>) => unknown>;

export const mounted: VueWrapper[] = [];

/** Unmounts every modal `mountModal` mounted and empties the page. */
export function unmountModals(): void {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
}

/** Mounted as a page uses it: `v-model:open` (the dialog's own `open = false` closes it). */
export function mountModal(props: Partial<Props> = {}, slots: Slots = {}, locale = 'en'): VueWrapper {
  const wrapper: VueWrapper = mount(FormModal, {
    props: {
      title: 'Invite to Bakery',
      open: true,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      ...props,
    } as Props,
    slots: { default: () => [h('input', { 'data-testid': 'email', type: 'email' })], ...slots } as never,
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
  mounted.push(wrapper);
  return wrapper;
}

/** Lets Vue render and the modal's `didPresent` (next tick) land. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

export const modalEl = (w: VueWrapper): HTMLElement => w.get('[data-stub="ion-modal"]').element as HTMLElement;
export const modal = (w: VueWrapper): IonModalStubApi =>
  w.findComponent({ name: 'IonModal' }).vm as unknown as IonModalStubApi;
export const byTestId = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
export const disabled = (el: Element): boolean =>
  (el as HTMLElement & { disabled?: boolean }).disabled === true || el.hasAttribute('disabled');
export const click = async (el: Element | null): Promise<void> => {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
};
export const key = async (el: Element, k: string, init: KeyboardEventInit = {}): Promise<void> => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  await settle();
};
/** A field as a page marks it: `:error-text="fieldErrors.<key>"`, and red while it has one. */
export const markedField = (component: unknown, id: string, message: string | undefined, extra: Record<string, unknown> = {}) =>
  h(component as never, {
    'data-testid': id,
    label: id,
    errorText: message,
    class: { 'ion-invalid': !!message, 'ion-touched': !!message },
    ...extra,
  });
export const submitButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__submit').element as HTMLElement;
export const cancelButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__cancel').element as HTMLElement;
export const closeButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__close').element as HTMLElement;
/** The name a screen reader reads. Hydrated, `ion-button` moves `aria-label` from its host to the
 *  native button of its shadow root (Ionic's `inheritAriaAttributes`), as in a browser. */
export const accessibleName = (button: HTMLElement): string | null | undefined =>
  button.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? button.getAttribute('aria-label');
/** The native control of an `ion-button` (its `native` shadow part): the only part of it that takes
 *  the focus in a browser — its host has no tabindex and its shadow root does not delegate the focus. */
export const nativeOf = (button: HTMLElement): HTMLElement | null =>
  button.shadowRoot?.querySelector<HTMLElement>('[part~="native"]') ?? null;
/** Focused for real, as a browser sees it: happy-dom focuses any element, an `ion-button` host
 *  included, so the focus has to be on the native control inside its shadow root (ui#73). */
export const reallyFocused = (button: HTMLElement): boolean =>
  document.activeElement === button && nativeOf(button) !== null && button.shadowRoot?.activeElement === nativeOf(button);
