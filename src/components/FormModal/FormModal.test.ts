// Behaviour spec of FormModal: the dialog of the panel's short forms (invite, change role, new API
// key, billing details; mockups `business.html`, `billing.html`, README §3b): an `ion-modal` with
// a title and a close button, the fields (default slot) and a footer Cancel / Save. It never closes
// itself on submit (the page closes it when the command succeeds); it closes on Cancel, the close
// button, Escape and the backdrop, unless a submit is pending.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount, type VueWrapper } from '@vue/test-utils';
import { Window } from 'happy-dom';
import { addIcons } from 'ionicons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import { ION_ICONS } from '../../shell/icons';
import * as root from '../../index';
import * as components from '../index';
import FormModal from './FormModal.vue';
import * as entry from './index';
import type { IonModalStubApi } from './__tests__/ionModalStub';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('./__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

const HERE = dirname(fileURLToPath(import.meta.url));

// What `createShell` does at boot: `ion:` icons paint by name from this registry.
addIcons(ION_ICONS);

type Props = InstanceType<typeof FormModal>['$props'];
type Slots = Record<string, (props: Record<string, unknown>) => unknown>;

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

/** Mounted as a page uses it: `v-model:open` (the dialog's own `open = false` closes it). */
function mountModal(props: Partial<Props> = {}, slots: Slots = {}, locale = 'en'): VueWrapper {
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
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

const modalEl = (w: VueWrapper): HTMLElement => w.get('[data-stub="ion-modal"]').element as HTMLElement;
const modal = (w: VueWrapper): IonModalStubApi =>
  w.findComponent({ name: 'IonModal' }).vm as unknown as IonModalStubApi;
const byTestId = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const disabled = (el: Element): boolean =>
  (el as HTMLElement & { disabled?: boolean }).disabled === true || el.hasAttribute('disabled');
const click = async (el: Element | null): Promise<void> => {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
};
const key = async (el: Element, k: string, init: KeyboardEventInit = {}): Promise<void> => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  await settle();
};
const submitButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__submit').element as HTMLElement;
const cancelButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__cancel').element as HTMLElement;
const closeButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__close').element as HTMLElement;
/** The name a screen reader reads. Hydrated, `ion-button` moves `aria-label` from its host to the
 *  native button of its shadow root (Ionic's `inheritAriaAttributes`), as in a browser. */
const accessibleName = (button: HTMLElement): string | null | undefined =>
  button.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? button.getAttribute('aria-label');

describe('FormModal: opening and closing', () => {
  it('closed, the ion-modal is there with nothing inside; open, it shows the title, the fields and the footer', async () => {
    const wrapper = mountModal({ open: false });
    await settle();
    expect(modalEl(wrapper).classList).toContain('ep-form-modal');
    expect(wrapper.find('.ep-form-modal__title').exists()).toBe(false);
    await wrapper.setProps({ open: true });
    await settle();
    expect(wrapper.get('ion-title.ep-form-modal__title').text()).toBe('Invite to Bakery');
    expect(byTestId('email')).not.toBeNull();
    expect(cancelButton(wrapper).textContent?.trim()).toBe('Cancel');
    expect(submitButton(wrapper).textContent?.trim()).toBe('Save');
  });

  it('is named by its title: aria-labelledby → the title, and aria-label (the one Ionic carries into its shadow role="dialog")', async () => {
    const wrapper = mountModal();
    await settle();
    const el = modalEl(wrapper);
    const title = wrapper.get('.ep-form-modal__title').element;
    expect(title.id).not.toBe('');
    expect(el.getAttribute('aria-labelledby')).toBe(title.id);
    expect(el.getAttribute('aria-label')).toBe('Invite to Bakery');
    expect(el.getAttribute('role')).toBe('dialog');
  });

  it('each opening presents a fresh ion-modal, so Ionic (which copies aria-label once, on load) reads the current title', async () => {
    const wrapper = mountModal({ title: 'Change the role of Carlos' });
    await settle();
    const first = modalEl(wrapper);
    await wrapper.setProps({ open: false });
    await settle();
    await wrapper.setProps({ title: 'Change the role of Marta' });
    await wrapper.setProps({ open: true });
    await settle();
    const second = modalEl(wrapper);
    expect(second).not.toBe(first);
    expect(second.getAttribute('aria-label')).toBe('Change the role of Marta');
  });

  it('Cancel and the close button emit `cancel` and close it (v-model:open)', async () => {
    for (const pick of [cancelButton, closeButton]) {
      const wrapper = mountModal();
      await settle();
      await click(pick(wrapper));
      expect(wrapper.emitted('cancel')).toHaveLength(1);
      expect(wrapper.emitted('update:open')).toEqual([[false]]);
      expect(wrapper.emitted('submit')).toBeUndefined();
    }
  });

  it('the close button is labelled for a screen reader (it only shows an icon)', async () => {
    const wrapper = mountModal();
    await settle();
    expect(accessibleName(closeButton(wrapper))).toBe('Close');
  });

  it('Save emits `submit` and does NOT close it: the page closes it when its command succeeds', async () => {
    const wrapper = mountModal();
    await settle();
    await click(submitButton(wrapper));
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toBeUndefined();
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('a tap on the backdrop cancels it once (the dismissal Ionic does on its own counts as a cancel)', async () => {
    const wrapper = mountModal();
    await settle();
    expect(modalEl(wrapper).getAttribute('data-backdrop-dismiss')).toBe('true');
    expect(modal(wrapper).tapBackdrop()).toBe(true);
    await settle();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('`dismissOnBackdrop: false` keeps it open on a backdrop tap', async () => {
    const wrapper = mountModal({ dismissOnBackdrop: false });
    await settle();
    expect(modalEl(wrapper).getAttribute('data-backdrop-dismiss')).toBe('false');
    expect(modal(wrapper).tapBackdrop()).toBe(false);
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('closing from the page (open → false) is not a cancel', async () => {
    const wrapper = mountModal();
    await settle();
    await wrapper.setProps({ open: false });
    await settle();
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(wrapper.find('.ep-form-modal__title').exists()).toBe(false);
  });
});

describe('FormModal: keyboard', () => {
  it('Escape cancels it, once, with or without backdrop dismissal', async () => {
    for (const dismissOnBackdrop of [true, false]) {
      const wrapper = mountModal({ dismissOnBackdrop });
      await settle();
      await key(byTestId('email')!, 'Escape');
      expect(wrapper.emitted('cancel'), String(dismissOnBackdrop)).toHaveLength(1);
      expect(wrapper.emitted('update:open'), String(dismissOnBackdrop)).toEqual([[false]]);
    }
  });

  it('Enter in a single-line field submits the form', async () => {
    const wrapper = mountModal();
    await settle();
    await key(byTestId('email')!, 'Enter');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  // A scoped ion-input or ion-searchbar handles its own Enter and the keydown still bubbles to the
  // form: a chooser that opens on Enter, a Combo picking an option, a search box inside a child's
  // popover. Their Enter is theirs, never a submit of the form around them.
  it('Enter a field already handled (defaultPrevented) is not a submit', async () => {
    const own = (event: KeyboardEvent) => {
      if (event.key === 'Enter') event.preventDefault();
    };
    const wrapper = mountModal({}, { default: () => [h('input', { 'data-testid': 'chooser', readonly: true, onKeydown: own }), h('input', { 'data-testid': 'combo', onKeydown: own })] });
    await settle();
    await key(byTestId('chooser')!, 'Enter');
    await key(byTestId('combo')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('Enter on a read-only field (a chooser that opens on it) is not a submit', async () => {
    const wrapper = mountModal({}, { default: () => [h('input', { 'data-testid': 'chooser', readonly: true })] });
    await settle();
    await key(byTestId('chooser')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('Enter inside a popover or a modal of a field (its own search box) is not the form’s', async () => {
    const wrapper = mountModal({}, {
      default: () => [
        h('ion-popover', {}, [h('input', { 'data-testid': 'in-popover' })]),
        h('ion-modal', {}, [h('input', { 'data-testid': 'in-modal' })]),
        h('input', { 'data-testid': 'email' }),
      ],
    });
    await settle();
    await key(byTestId('in-popover')!, 'Enter');
    await key(byTestId('in-modal')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
    await key(byTestId('email')!, 'Enter');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('Enter in a textarea is a new line, and Enter while composing (IME) is not a submit', async () => {
    const wrapper = mountModal({}, { default: () => [h('textarea', { 'data-testid': 'message' }), h('input', { 'data-testid': 'email' })] });
    await settle();
    await key(byTestId('message')!, 'Enter');
    await key(byTestId('email')!, 'Enter', { isComposing: true });
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});

describe('FormModal: pending', () => {
  it('disables Save (with a spinner), Cancel and the close button, and marks the form busy', async () => {
    const wrapper = mountModal({ pending: true });
    await settle();
    expect(disabled(submitButton(wrapper))).toBe(true);
    expect(submitButton(wrapper).querySelector('ion-spinner')).not.toBeNull();
    expect(disabled(cancelButton(wrapper))).toBe(true);
    expect(disabled(closeButton(wrapper))).toBe(true);
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true');
  });

  it('nothing submits or cancels it meanwhile: clicks, Enter, Escape or the backdrop', async () => {
    const wrapper = mountModal({ pending: true });
    await settle();
    await click(submitButton(wrapper));
    await click(cancelButton(wrapper));
    await click(closeButton(wrapper));
    await key(byTestId('email')!, 'Enter');
    await key(byTestId('email')!, 'Escape');
    expect(modalEl(wrapper).getAttribute('data-backdrop-dismiss')).toBe('false');
    expect(modal(wrapper).tapBackdrop()).toBe(false);
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });

  it('without pending there is no spinner and the form is not busy', async () => {
    const wrapper = mountModal();
    await settle();
    expect(submitButton(wrapper).querySelector('ion-spinner')).toBeNull();
    expect(wrapper.get('form').attributes('aria-busy')).toBeUndefined();
  });

  it('`submitDisabled` disables Save and its Enter (an incomplete form)', async () => {
    const wrapper = mountModal({ submitDisabled: true });
    await settle();
    expect(disabled(submitButton(wrapper))).toBe(true);
    await click(submitButton(wrapper));
    await key(byTestId('email')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});

describe('FormModal: errors', () => {
  it('shows the error of the command at the top, in a danger InlineFeedback', async () => {
    const wrapper = mountModal({ error: { status: 409, code: 'hubs.member_exists', message: 'That person is already a member.' } });
    await settle();
    const banner = wrapper.get('.ep-form-modal__error');
    expect(banner.classes()).toContain('inline-feedback');
    expect(banner.attributes('data-tone')).toBe('danger');
    expect(banner.text()).toContain('That person is already a member.');
    const body = wrapper.get('.ep-form-modal__body').element;
    expect(body.firstElementChild).toBe(banner.element);
  });

  it('no error, no banner', async () => {
    const wrapper = mountModal({ error: null });
    await settle();
    expect(wrapper.find('.ep-form-modal__error').exists()).toBe(false);
  });

  it('hands the field errors (422 `fields`) to the fields slot, and `{}` without them', async () => {
    const seen: unknown[] = [];
    const slot = (props: Record<string, unknown>) => {
      seen.push(props.fieldErrors);
      return [h('input')];
    };
    const wrapper = mountModal(
      { error: { status: 422, code: 'validation_error', message: 'Check the fields.', fields: { email: 'Not a valid email.' } } },
      { default: slot },
    );
    await settle();
    expect(seen.at(-1)).toEqual({ email: 'Not a valid email.' });
    await wrapper.setProps({ error: null });
    await settle();
    expect(seen.at(-1)).toEqual({});
  });
});

describe('FormModal: focus', () => {
  it('on opening, focuses the first field', async () => {
    mountModal({}, { default: () => [h('p', 'Hint'), h('input', { 'data-testid': 'first' }), h('input', { 'data-testid': 'second' })] });
    await settle();
    expect(document.activeElement).toBe(byTestId('first'));
  });

  it('an Ionic field is focused through its setFocus() (Ionic moves the focus to its native input)', async () => {
    // Importing @ionic/vue defines its elements, ion-input among them.
    const IonInputElement = customElements.get('ion-input') as unknown as { prototype: { setFocus(): Promise<void> } };
    const setFocus = vi.spyOn(IonInputElement.prototype, 'setFocus').mockResolvedValue(undefined);
    try {
      mountModal({}, { default: () => [h('ion-input', { 'data-testid': 'name' })] });
      await settle();
      expect(setFocus).toHaveBeenCalledTimes(1);
      expect(setFocus.mock.contexts[0]).toBe(byTestId('name'));
    } finally {
      setFocus.mockRestore();
    }
  });

  it('a field marked `data-autofocus` goes first', async () => {
    mountModal({}, { default: () => [h('input', { 'data-testid': 'a' }), h('input', { 'data-testid': 'b', 'data-autofocus': '' })] });
    await settle();
    expect(document.activeElement).toBe(byTestId('b'));
  });

  it('with no field, Cancel takes the focus (the least destructive choice)', async () => {
    const wrapper = mountModal({}, { default: () => [h('p', 'Nothing to fill in')] });
    await settle();
    expect(document.activeElement).toBe(cancelButton(wrapper));
  });

  it('on closing, gives the focus back to what opened it', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Invite';
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mountModal({ open: false });
    await settle();
    await wrapper.setProps({ open: true });
    await settle();
    expect(document.activeElement).toBe(byTestId('email'));
    await click(cancelButton(wrapper));
    expect(document.activeElement).toBe(trigger);
  });
});

describe('FormModal: options', () => {
  it('labels: its own en/es defaults, or the page\'s', async () => {
    const es = mountModal({}, {}, 'es');
    await settle();
    expect(cancelButton(es).textContent?.trim()).toBe('Cancelar');
    expect(submitButton(es).textContent?.trim()).toBe('Guardar');
    expect(accessibleName(closeButton(es))).toBe('Cerrar');
    es.unmount();
    mounted.splice(0);
    const own = mountModal({ submitLabel: 'Send invitation', cancelLabel: 'Back' });
    await settle();
    expect(submitButton(own).textContent?.trim()).toBe('Send invitation');
    expect(cancelButton(own).textContent?.trim()).toBe('Back');
  });

  it('size: md by default (the mockups\' 480px dialog), sm for short confirmations', async () => {
    const md = mountModal();
    await settle();
    expect(modalEl(md).getAttribute('data-size')).toBe('md');
    const sm = mountModal({ size: 'sm' });
    await settle();
    expect(modalEl(sm).getAttribute('data-size')).toBe('sm');
  });

  it('Save takes an Ionic colour and an icon (the mockups\' «Send invitation» with its icon)', async () => {
    const wrapper = mountModal({ submitColor: 'danger', submitIcon: 'ion:trash-outline' });
    await settle();
    expect((submitButton(wrapper) as HTMLElement & { color?: string }).color).toBe('danger');
    expect(submitButton(wrapper).querySelector('ion-icon')).not.toBeNull();
  });

  it('`role: alertdialog` for consequential confirmations', async () => {
    const wrapper = mountModal({ role: 'alertdialog' });
    await settle();
    expect(modalEl(wrapper).getAttribute('role')).toBe('alertdialog');
  });

  it('the footer slot replaces the buttons and gets submit, cancel and pending', async () => {
    const wrapper = mountModal({}, {
      footer: ({ submit, cancel, pending }) => [
        h('button', { 'data-testid': 'own-submit', onClick: submit }, `Go ${String(pending)}`),
        h('button', { 'data-testid': 'own-cancel', onClick: cancel }, 'Stop'),
      ],
    });
    await settle();
    expect(wrapper.find('.ep-form-modal__submit').exists()).toBe(false);
    expect(byTestId('own-submit')?.textContent).toBe('Go false');
    await click(byTestId('own-submit'));
    expect(wrapper.emitted('submit')).toHaveLength(1);
    await click(byTestId('own-cancel'));
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    // Native buttons are `type="submit"` by default: the form's own submit event must not add a
    // second submit (own-submit) nor turn a cancel into a submit (own-cancel).
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('`testid` hooks the modal, its buttons and its error; nothing without it', async () => {
    const hooked = mountModal({ testid: 'invite', error: { message: 'Nope' } });
    await settle();
    for (const id of ['invite', 'invite-submit', 'invite-cancel', 'invite-close', 'invite-error']) {
      expect(byTestId(id), id).not.toBeNull();
    }
    hooked.unmount();
    mounted.splice(0);
    mountModal({ error: { message: 'Nope' } });
    await settle();
    expect(document.querySelectorAll('[data-testid]').length).toBe(1); // only the slot's own field
  });
});

describe('FormModal: on a phone (R-29)', () => {
  it('is a sheet by default and a centred card with `phoneLayout: card`, said on the ion-modal for the stylesheet', async () => {
    const sheet = mountModal();
    await settle();
    expect(modalEl(sheet).getAttribute('data-phone-layout')).toBe('sheet');
    const card = mountModal({ phoneLayout: 'card' });
    await settle();
    expect(modalEl(card).getAttribute('data-phone-layout')).toBe('card');
  });
});

describe('FormModal: layout (CSS, read from the stylesheet or computed in a happy-dom window)', () => {
  const sfc = readFileSync(join(HERE, 'FormModal.vue'), 'utf8');

  it('is a centred card on desktop, 480px (md) or 420px (sm) wide, its height by its content', () => {
    expect(sfc).toMatch(/ion-modal\.ep-form-modal\s*\{[^}]*--width:\s*480px;[^}]*--height:\s*auto;/);
    expect(sfc).toMatch(/ion-modal\.ep-form-modal\[data-size='sm'\]\s*\{[^}]*--width:\s*420px;/);
  });

  // R-29 (UX audit 2, 2026-10-14; Material 3 and iOS): a form on a phone is a sheet from the bottom
  // as tall as its fields, never a full-height page with ~600px of nothing under one field; it grows
  // to 90% of the screen and then its fields scroll between the title and the buttons. A
  // confirmation (`phoneLayout: 'card'`, ConfirmDialog) stays the centred card at every width.
  const STYLE = /<style>([\s\S]*?)<\/style>/.exec(sfc)?.[1] ?? '';

  /** The dialog's stylesheet applied in a window `width` px wide (happy-dom computes the media
   *  queries, not the layout), on the DOM FormModal and Ionic render. */
  async function styleAt(width: number, phoneLayout: string, size = 'md') {
    const win = new Window({ width, height: 844 });
    win.document.head.innerHTML = `<style>${STYLE}</style>`;
    win.document.body.innerHTML = `
      <ion-modal class="ep-form-modal" data-size="${size}" data-phone-layout="${phoneLayout}">
        <div class="ion-delegate-host ion-page"><div class="ep-form-modal__content">
          <form class="ep-form-modal__form"><div class="ep-form-modal__body"></div><div class="ep-form-modal__footer"></div></form>
        </div></div>
      </ion-modal>`;
    /** The computed values of `props` on `selector`, read before the window closes. */
    const read = (selector: string, props: string[]): Record<string, string> => {
      const style = win.getComputedStyle(win.document.querySelector(selector)!);
      return Object.fromEntries(props.map((prop) => [prop, style.getPropertyValue(prop)]));
    };
    const styles = {
      modal: read('ion-modal', ['--width', '--max-width', '--height', '--max-height', '--border-radius', 'align-items']),
      host: read('.ion-delegate-host', ['display', 'max-height']),
      body: read('.ep-form-modal__body', ['overflow-y', 'min-height', 'max-height']),
    };
    await win.happyDOM.close();
    return styles;
  }

  it('below 640px a form is a sheet from the bottom, as tall as its content up to 90vh, the fields scrolling inside', async () => {
    const { modal, host, body } = await styleAt(390, 'sheet');
    expect(modal['--width']).toBe('100%');
    expect(modal['--height']).toBe('auto');
    expect(modal['--max-height']).toBe('90vh');
    expect(modal['align-items']).toBe('flex-end');
    // The sheet's rounded top (--ep-radius-sheet-top, 18px 18px 0 0 without the theme).
    expect(modal['--border-radius']).toBe('18px 18px 0 0');
    // The content is capped like the sheet, so the body scrolls instead of being cut off.
    expect(host['max-height']).toBe(`${(844 * 90) / 100}px`); // 90vh of the 844px window, computed
    expect(host.display).toBe('flex');
    expect(body['overflow-y']).toBe('auto');
    expect(body['min-height']).toBe('0');
    expect(body['max-height']).toBe('none');
  });

  it('a confirmation (`phoneLayout: card`) stays the centred card below 640px: never a sheet', async () => {
    const { modal } = await styleAt(390, 'card', 'sm');
    expect(modal['--width']).toBe('420px');
    expect(modal['--max-width']).toBe('calc(100vw - 32px)');
    expect(modal['--height']).toBe('auto');
    expect(modal['align-items']).not.toBe('flex-end');
    expect(modal['--border-radius']).not.toBe('18px 18px 0 0');
  });

  it('from 640px both are the centred card', async () => {
    for (const layout of ['sheet', 'card']) {
      const { modal } = await styleAt(1024, layout);
      expect(modal['--width'], layout).toBe('480px');
      expect(modal['--height'], layout).toBe('auto');
      expect(modal['align-items'], layout).not.toBe('flex-end');
    }
  });

  it('uses Ionic\'s spacing class and our tokens, nothing of OutfitKit', () => {
    expect(sfc).toMatch(/ion-padding/);
    expect(sfc).not.toMatch(/--ok-|\bok-[a-z]/);
  });
});

describe('FormModal entry points', () => {
  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.FormModal).toBe(FormModal);
    expect((components as Record<string, unknown>).FormModal).toBe(FormModal);
    expect((root as Record<string, unknown>).FormModal).toBe(FormModal);
  });
});
