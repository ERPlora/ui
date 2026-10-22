// Behaviour spec of ConfirmDialog: the confirmation of a destructive or consequential action
// (remove a member, transfer ownership, delete a business; mockups `business.html`, README §3b),
// our own `ion-modal` (FormModal) rather than `ion-alert`, so it looks like every other dialog of
// the panel: title, message (or slot), consequences, an optional «type the name to confirm», and
// Cancel / the action in the tone of what it does.
import { mount, type VueWrapper } from '@vue/test-utils';
import { addIcons } from 'ionicons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import { ION_ICONS } from '../../shell/icons';
import * as components from '../index';
import ConfirmDialog from './ConfirmDialog.vue';
import * as entry from './index';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

// What `createShell` does at boot: `ion:` icons paint by name from this registry.
addIcons(ION_ICONS);

type Props = InstanceType<typeof ConfirmDialog>['$props'];

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

/** Mounted as a page uses it: `v-model:open`. */
function mountDialog(props: Partial<Props> = {}, slots: Record<string, () => unknown> = {}, locale = 'en'): VueWrapper {
  const wrapper: VueWrapper = mount(ConfirmDialog, {
    props: {
      title: 'Remove Marta Gil',
      message: 'She can no longer open Bakery, on any device. What she did is kept.',
      open: true,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      ...props,
    } as Props,
    slots: slots as never,
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
  mounted.push(wrapper);
  return wrapper;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

const modalEl = (w: VueWrapper): HTMLElement => w.get('[data-stub="ion-modal"]').element as HTMLElement;
const confirmButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__submit').element as HTMLElement;
const cancelButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__cancel').element as HTMLElement;
const disabled = (el: Element): boolean =>
  (el as HTMLElement & { disabled?: boolean }).disabled === true || el.hasAttribute('disabled');
const click = async (el: Element): Promise<void> => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
};
/** What the person does in an ion-input: Ionic writes the value, then emits `ionInput`. */
async function type(el: Element, value: string): Promise<void> {
  (el as HTMLElement & { value?: string }).value = value;
  el.dispatchEvent(new CustomEvent('ionInput', { detail: { value }, bubbles: true }));
  await settle();
}

describe('ConfirmDialog', () => {
  it('is an alertdialog named by its title and described by its message', async () => {
    const wrapper = mountDialog();
    await settle();
    const el = modalEl(wrapper);
    expect(el.getAttribute('role')).toBe('alertdialog');
    expect(el.getAttribute('aria-label')).toBe('Remove Marta Gil');
    expect(el.classList).toContain('ep-confirm-dialog');
    const message = wrapper.get('.ep-confirm-dialog__message');
    expect(message.text()).toBe('She can no longer open Bakery, on any device. What she did is kept.');
    expect(el.getAttribute('aria-describedby')).toBe(message.attributes('id'));
  });

  // R-29 (UX audit 2, 2026-10-14): Material 3 and iOS confirm in a centred dialog; a sheet is for
  // tasks. Two lines of text in a full-height sheet left ~600px of nothing at 390px.
  it('is the centred card at every width, also on a phone: never a sheet (R-29)', async () => {
    const wrapper = mountDialog();
    await settle();
    expect(modalEl(wrapper).getAttribute('data-phone-layout')).toBe('card');
  });

  it('the action is in the tone of what it does: danger by default, warning or primary', async () => {
    const color = (w: VueWrapper) => (confirmButton(w) as HTMLElement & { color?: string }).color;
    const danger = mountDialog();
    await settle();
    expect(color(danger)).toBe('danger');
    for (const tone of ['warning', 'primary'] as const) {
      const wrapper = mountDialog({ tone });
      await settle();
      expect(color(wrapper), tone).toBe(tone);
    }
  });

  it('labels: Cancel / Confirm by default (en and es), or the page\'s («Remove from the business»)', async () => {
    const en = mountDialog();
    await settle();
    expect(confirmButton(en).textContent?.trim()).toBe('Confirm');
    expect(cancelButton(en).textContent?.trim()).toBe('Cancel');
    en.unmount();
    mounted.splice(0);
    const es = mountDialog({}, {}, 'es');
    await settle();
    expect(confirmButton(es).textContent?.trim()).toBe('Confirmar');
    expect(cancelButton(es).textContent?.trim()).toBe('Cancelar');
    es.unmount();
    mounted.splice(0);
    const own = mountDialog({ confirmLabel: 'Remove from the business', cancelLabel: 'Back', confirmIcon: 'ion:trash-outline' });
    await settle();
    expect(confirmButton(own).textContent?.trim()).toBe('Remove from the business');
    expect(cancelButton(own).textContent?.trim()).toBe('Back');
    expect(confirmButton(own).querySelector('ion-icon')).not.toBeNull();
  });

  it('confirm emits `confirm` and leaves it open: the page closes it when the action is done', async () => {
    const wrapper = mountDialog();
    await settle();
    await click(confirmButton(wrapper));
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });

  it('Cancel emits `cancel` and closes it', async () => {
    const wrapper = mountDialog();
    await settle();
    await click(cancelButton(wrapper));
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  it('Escape cancels it', async () => {
    const wrapper = mountDialog();
    await settle();
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('with nothing to type, Cancel has the focus (the safe choice on a destructive dialog)', async () => {
    const wrapper = mountDialog();
    await settle();
    expect(document.activeElement).toBe(cancelButton(wrapper));
  });

  it('pending: the action shows a spinner and nothing confirms or cancels it', async () => {
    const wrapper = mountDialog({ pending: true });
    await settle();
    expect(disabled(confirmButton(wrapper))).toBe(true);
    expect(confirmButton(wrapper).querySelector('ion-spinner')).not.toBeNull();
    await click(confirmButton(wrapper));
    await click(cancelButton(wrapper));
    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('shows the error of a failed action, at the top', async () => {
    const wrapper = mountDialog({ error: { status: 409, code: 'hubs.last_owner', message: 'A business needs an owner.' } });
    await settle();
    expect(wrapper.get('.ep-form-modal__error').text()).toContain('A business needs an owner.');
  });

  it('the default slot replaces the message (a warning banner, a link)', async () => {
    const wrapper = mountDialog({ message: undefined }, { default: () => h('strong', { class: 'own' }, 'It stops working at once') });
    await settle();
    expect(wrapper.get('.ep-confirm-dialog__message .own').text()).toBe('It stops working at once');
  });

  it('lists the consequences, each with its icon when it has one', async () => {
    const wrapper = mountDialog({
      consequences: [
        { text: 'We keep the data for 90 days: you can restore it until 11 Jan 2027.', icon: 'ion:time-outline' },
        'We email you a link to download a copy.',
      ],
    });
    await settle();
    const items = wrapper.findAll('.ep-confirm-dialog__consequences li');
    expect(items.map((li) => li.text())).toEqual([
      'We keep the data for 90 days: you can restore it until 11 Jan 2027.',
      'We email you a link to download a copy.',
    ]);
    expect(items[0].find('ion-icon').exists()).toBe(true);
    expect(items[1].find('ion-icon').exists()).toBe(false);
  });
});

describe('ConfirmDialog: type the name to confirm (`requireText`)', () => {
  const props = { title: 'Delete Panadería López', requireText: 'Panadería López', testid: 'delete' };
  const input = (): HTMLElement => document.querySelector('[data-testid="delete-input"]') as HTMLElement;

  it('asks for the text in bold, with an outlined md input focused, and keeps the action disabled until it matches', async () => {
    // Importing @ionic/vue defines ion-input: FormModal focuses it through its setFocus().
    const IonInputElement = customElements.get('ion-input') as unknown as { prototype: { setFocus(): Promise<void> } };
    const setFocus = vi.spyOn(IonInputElement.prototype, 'setFocus').mockResolvedValue(undefined);
    const wrapper = mountDialog(props);
    await settle();
    expect(setFocus.mock.contexts).toEqual([input()]);
    setFocus.mockRestore();
    expect(wrapper.get('.ep-confirm-dialog__prompt').text()).toBe('To confirm, type Panadería López:');
    expect(wrapper.get('.ep-confirm-dialog__prompt strong').text()).toBe('Panadería López');
    const field = input() as HTMLElement & { mode?: string; fill?: string };
    expect(field.tagName).toBe('ION-INPUT');
    // Vue binds an Ionic prop as a property when the element has one, else as an attribute.
    expect(field.mode ?? field.getAttribute('mode')).toBe('md');
    expect(field.fill ?? field.getAttribute('fill')).toBe('outline');
    expect(disabled(confirmButton(wrapper))).toBe(true);
    await type(field, 'Panaderia Lopez');
    expect(disabled(confirmButton(wrapper))).toBe(true);
    await type(field, 'Panadería López');
    expect(disabled(confirmButton(wrapper))).toBe(false);
    await click(confirmButton(wrapper));
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('ignores the case and the surrounding spaces, never the accents', async () => {
    const wrapper = mountDialog(props);
    await settle();
    await type(input(), '  panadería  LÓPEZ ');
    expect(disabled(confirmButton(wrapper))).toBe(false);
  });

  it('Enter in the input confirms only once it matches', async () => {
    const wrapper = mountDialog(props);
    await settle();
    // In a browser the keydown comes from the native input Ionic renders inside ion-input.
    const native = document.createElement('input');
    input().append(native);
    await type(input(), 'Panadería');
    native.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await type(input(), 'Panadería López');
    native.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('starts empty every time it opens', async () => {
    const wrapper = mountDialog(props);
    await settle();
    await type(input(), 'Panadería López');
    await wrapper.setProps({ open: false });
    await settle();
    await wrapper.setProps({ open: true });
    await settle();
    expect((input() as HTMLElement & { value?: string }).value).toBe('');
    expect(disabled(confirmButton(wrapper))).toBe(true);
  });

  it('the input is labelled («Confirmation» by default, or the page\'s «Business name»)', async () => {
    const byDefault = mountDialog(props, {}, 'es');
    await settle();
    expect((input() as HTMLElement & { label?: string }).label).toBe('Confirmación');
    byDefault.unmount();
    mounted.splice(0);
    mountDialog({ ...props, requireTextLabel: 'Business name' });
    await settle();
    expect((input() as HTMLElement & { label?: string }).label).toBe('Business name');
  });
});

describe('ConfirmDialog entry points', () => {
  it('is exported from its folder, from `@erplora/ui/components` and from the package root, with useConfirm', () => {
    expect(entry.ConfirmDialog).toBe(ConfirmDialog);
    expect((components as Record<string, unknown>).ConfirmDialog).toBe(ConfirmDialog);
    expect((root as Record<string, unknown>).ConfirmDialog).toBe(ConfirmDialog);
    expect(typeof (components as Record<string, unknown>).useConfirm).toBe('function');
  });
});
