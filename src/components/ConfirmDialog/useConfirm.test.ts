/* eslint-disable vue/one-component-per-file -- small harness components: a caller, two callers, a caller that goes away */
// Behaviour spec of useConfirm: the imperative ConfirmDialog for a yes/no that needs nothing else
// (no pending state, no error inside the dialog), like `window.confirm` but ours:
//   const { confirm } = useConfirm();               // in setup()
//   if (await confirm({ title, message, tone: 'danger', confirmLabel })) run();
// One dialog is shared by the whole app (mounted on first use, with the app's context: i18n,
// plugins); it closes and resolves `true` on confirm, `false` on cancel, Escape or the backdrop.
import { mount, type VueWrapper } from '@vue/test-utils';
import { addIcons } from 'ionicons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Component, defineComponent, h, nextTick, shallowRef } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import { ION_ICONS } from '../../shell/icons';
import { ionModalStubOf } from '../FormModal/__tests__/ionModalStub';
import type { ConfirmOptions } from './types';
import { useConfirm } from './useConfirm';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

addIcons(ION_ICONS);

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const Caller = defineComponent({
  name: 'ConfirmCaller',
  setup(_, { expose }) {
    const { confirm } = useConfirm();
    expose({ confirm });
    return () => h('button', { class: 'caller' }, 'Remove');
  },
});

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

function mountApp(component: Component = Caller, locale = 'en'): VueWrapper {
  const wrapper = mount(component, { attachTo: document.body, global: { plugins: [createShellI18n({ locale })] } });
  mounted.push(wrapper);
  return wrapper;
}

const confirmOf = (w: VueWrapper): Confirm => (w.vm as unknown as { confirm: Confirm }).confirm;

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

const dialog = (): HTMLElement | null => document.querySelector('.ep-confirm-dialog');
const title = (): string | undefined => document.querySelector('.ep-confirm-dialog .ep-form-modal__title')?.textContent?.trim();
const button = (cls: string): HTMLElement => document.querySelector(`.ep-confirm-dialog .${cls}`) as HTMLElement;
const click = async (el: Element): Promise<void> => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
};

const REMOVE: ConfirmOptions = {
  title: 'Remove Marta Gil?',
  message: 'She can no longer open Bakery.',
  tone: 'danger',
  confirmLabel: 'Remove from the business',
};

describe('useConfirm', () => {
  it('shows the dialog and resolves true on confirm, then closes it', async () => {
    const app = mountApp();
    const answer = confirmOf(app)(REMOVE);
    await settle();
    expect(title()).toBe('Remove Marta Gil?');
    expect(dialog()?.getAttribute('role')).toBe('alertdialog');
    expect(button('ep-form-modal__submit').textContent?.trim()).toBe('Remove from the business');
    await click(button('ep-form-modal__submit'));
    await expect(answer).resolves.toBe(true);
    expect(title()).toBeUndefined();
  });

  it('resolves false on Cancel, on Escape and on the backdrop', async () => {
    const app = mountApp();
    const confirm = confirmOf(app);

    const cancelled = confirm(REMOVE);
    await settle();
    await click(button('ep-form-modal__cancel'));
    await expect(cancelled).resolves.toBe(false);

    const escaped = confirm(REMOVE);
    await settle();
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    await expect(escaped).resolves.toBe(false);

    const tapped = confirm(REMOVE);
    await settle();
    expect(app.findAllComponents({ name: 'IonModal' })).toHaveLength(0); // it lives outside the caller's tree
    expect(ionModalStubOf(dialog()).tapBackdrop()).toBe(true);
    await settle();
    await expect(tapped).resolves.toBe(false);
  });

  it('uses the app\'s language (it is mounted with the app\'s context)', async () => {
    const app = mountApp(Caller, 'es');
    void confirmOf(app)({ title: '¿Quitar a Marta Gil?' });
    await settle();
    expect(button('ep-form-modal__submit').textContent?.trim()).toBe('Confirmar');
    expect(button('ep-form-modal__cancel').textContent?.trim()).toBe('Cancelar');
  });

  it('passes the dialog\'s options through: tone, labels, consequences and the text to type', async () => {
    const app = mountApp();
    const answer = confirmOf(app)({
      title: 'Delete Bakery',
      tone: 'warning',
      cancelLabel: 'Keep it',
      consequences: ['It stops working at once.'],
      requireText: 'Bakery',
    });
    await settle();
    const submit = button('ep-form-modal__submit') as HTMLElement & { color?: string; disabled?: boolean };
    expect(submit.color).toBe('warning');
    expect(button('ep-form-modal__cancel').textContent?.trim()).toBe('Keep it');
    expect(document.querySelector('.ep-confirm-dialog__consequences li')?.textContent?.trim()).toBe('It stops working at once.');
    expect(submit.disabled).toBe(true);
    const input = document.querySelector('.ep-confirm-dialog ion-input') as HTMLElement & { value?: string };
    input.value = 'Bakery';
    input.dispatchEvent(new CustomEvent('ionInput', { detail: { value: 'Bakery' }, bubbles: true }));
    await settle();
    expect(submit.disabled).toBe(false);
    await click(submit);
    await expect(answer).resolves.toBe(true);
  });

  it('mounts ONE shared dialog per app, whoever asks', async () => {
    const Two = defineComponent({ render: () => [h(Caller, { ref: 'a' }), h(Caller, { ref: 'b' })] });
    const app = mountApp(Two);
    const [a, b] = app.findAllComponents(Caller).map((c) => (c.vm as unknown as { confirm: Confirm }).confirm);
    const first = a(REMOVE);
    await settle();
    await click(button('ep-form-modal__cancel'));
    await first;
    void b({ title: 'Transfer the ownership?' });
    await settle();
    expect(document.querySelectorAll('.ep-confirm-host')).toHaveLength(1);
    expect(title()).toBe('Transfer the ownership?');
  });

  it('a new question while one is open replaces it: the open one resolves false', async () => {
    const app = mountApp();
    const confirm = confirmOf(app);
    const first = confirm(REMOVE);
    await settle();
    const second = confirm({ title: 'Transfer the ownership?', tone: 'warning' });
    await expect(first).resolves.toBe(false);
    await settle();
    expect(title()).toBe('Transfer the ownership?');
    await click(button('ep-form-modal__submit'));
    await expect(second).resolves.toBe(true);
  });

  it('when the component that asked goes away, its open question resolves false and the dialog closes', async () => {
    const show = shallowRef(true);
    const Parent = defineComponent({ render: () => (show.value ? h(Caller) : h('p', 'elsewhere')) });
    const app = mountApp(Parent);
    const answer = (app.findComponent(Caller).vm as unknown as { confirm: Confirm }).confirm(REMOVE);
    await settle();
    expect(title()).toBe('Remove Marta Gil?');
    show.value = false;
    await settle();
    await expect(answer).resolves.toBe(false);
    expect(title()).toBeUndefined();
  });

  it('the shared dialog goes away with the app', async () => {
    const app = mountApp();
    void confirmOf(app)(REMOVE);
    await settle();
    expect(document.querySelector('.ep-confirm-host')).not.toBeNull();
    app.unmount();
    mounted.splice(0);
    expect(document.querySelector('.ep-confirm-host')).toBeNull();
  });

  it('must be called from setup() (it needs the app it belongs to)', () => {
    expect(() => useConfirm()).toThrow(/setup\(\)/);
  });
});
