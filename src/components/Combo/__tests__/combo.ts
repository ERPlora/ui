import { flushPromises, mount } from '@vue/test-utils';
import { vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import { createShellI18n } from '../../../shell/i18n';
import Combo from '../Combo.vue';
import type { ComboOption } from '../types';

/** `ion-popover` presents itself only in a real browser: the stub shows its content while open. */
export const PopoverStub = defineComponent({
  name: 'IonPopover',
  inheritAttrs: false,
  props: { isOpen: Boolean, event: { type: null, default: undefined } },
  emits: ['didDismiss', 'willPresent', 'didPresent'],
  setup(props, { slots, attrs }) {
    return () => (props.isOpen ? h('div', { ...attrs, 'data-stub': 'ion-popover' }, slots.default?.()) : null);
  },
});

export const COUNTRIES: ComboOption[] = [
  { id: 'ES', label: 'España', hint: 'ES' },
  { id: 'FR', label: 'Francia', hint: 'FR' },
  { id: 'PT', label: 'Portugal', hint: 'PT' },
  { id: 'DE', label: 'Alemania', hint: 'DE' },
];

export type Wrapper = ReturnType<typeof mountCombo>;
export type El = HTMLElement & Record<string, unknown>;

export function mountCombo(props: Record<string, unknown> = {}, locale = 'en') {
  return mount(Combo, {
    props: { label: 'Country', options: COUNTRIES, testid: 'country', ...props },
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })], stubs: { IonPopover: PopoverStub } },
  });
}

/** Lets Vue render and Ionic's ion-input load (it renders its native input asynchronously). */
export async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await flushPromises();
  }
}

export const field = (w: Wrapper) => w.get('ion-input[data-testid="country"]');
export const native = (w: Wrapper) => field(w).element.querySelector('input') as HTMLInputElement;
export const popover = (w: Wrapper) => w.find('[data-stub="ion-popover"]');
export const options = (w: Wrapper) => popover(w).findAll('[role="option"]');
/** Stencil's slot patch hides `textContent` of ion-label under happy-dom: read its markup. */
export const labelText = (el: Element) => el.innerHTML.replace(/<!--[\s\S]*?-->/g, '').trim();
/** The options' labels, without their hints. */
export const optionLabels = (w: Wrapper) => options(w).map((o) => labelText(o.get('ion-label').element).replace(/<p[\s>][\s\S]*<\/p>/, '').trim());

export async function typeIn(w: Wrapper, value: string) {
  field(w).element.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
  await settle();
}
export async function key(w: Wrapper, k: string) {
  native(w).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  await settle();
}
/** Presses a key in the field and tells what the page around the combo saw of it: whether its
 *  default was prevented, and whether it reached `document.body` (where a FormModal's Enter lands). */
export async function pressFromPage(w: Wrapper, k: string): Promise<{ prevented: boolean; reachedPage: boolean }> {
  let reachedPage = false;
  const listen = () => (reachedPage = true);
  document.body.addEventListener('keydown', listen);
  const press = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  native(w).dispatchEvent(press);
  document.body.removeEventListener('keydown', listen);
  await settle();
  return { prevented: press.defaultPrevented, reachedPage };
}

/** An `afterEach`: real timers and mocks back, and the page emptied of what a test mounted. */
export function resetAfterTest(): void {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
}
