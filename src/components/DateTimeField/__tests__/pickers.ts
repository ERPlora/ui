// Test harness of DateField, TimeField and the field they share: mounted in the shell's i18n, with `ion-popover`
// stubbed (it presents itself only in a real browser: the stub shows its content while open).
import { flushPromises, mount } from '@vue/test-utils';
import { IonDatetime, IonInput } from '@ionic/vue';
import type { Component } from 'vue';
import { nextTick } from 'vue';

import { IonPopoverStub } from '../../../shell/__tests__/ionPopoverStub';
import { createShellI18n } from '../../../shell/i18n';

export type Control = HTMLElement & Record<string, unknown>;

/** Lets Vue render and Ionic's elements load. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await flushPromises();
  }
}

export async function mountPicker(component: Component, props: Record<string, unknown>, locale = 'en') {
  const wrapper = mount(component, {
    props,
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })], stubs: { IonPopover: IonPopoverStub } },
  });
  await settle();
  const testid = String(props.testid);
  const field = () => wrapper.get(`ion-input[data-testid="${testid}"]`);
  const control = () => field().element as Control;
  const input = () => wrapper.findComponent(IonInput);
  const popover = () => wrapper.findComponent(IonPopoverStub);
  const picker = () => wrapper.findComponent(IonDatetime);
  const isOpen = () => popover().props('isOpen') === true;
  async function tap() {
    field().element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
  }
  async function press(key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    field().element.dispatchEvent(event);
    await settle();
    return event;
  }
  /** What ion-datetime says when its Done or Clear is pressed. */
  async function choose(value: string | null | undefined) {
    picker().element.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
    await settle();
  }
  return { wrapper, field, control, input, popover, picker, isOpen, tap, press, choose };
}
