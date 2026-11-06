// SettingsFormFooter: the end of a settings page's form, the one every «Settings» tab of the Hub had copied
// (hub#897; APPOINTMENT-F19, RESERVATION-F03, ONLINE_BOOKING-F07, STAFF-F22, TABLE-F08, KITCHEN-F26,
// ATTENDANCE-F04, SERVICE-F11): the refusal's red notice, «saved» and «Save», painted from what
// useSettingsForm gives and from the page's own texts. Its variants are the pages' (Staff and Attendance:
// a spinner on Save; Attendance: its icon, Save on without changes and only for whoever may change them).
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { defineComponent, effectScope, h, ref, shallowRef, type EffectScope, type PropType } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import { resolveIcon } from '../../shell/icons';
import * as components from '../index';
import SettingsFormFooter, { type SettingsFormFooterState } from './SettingsFormFooter.vue';
import { useSettingsForm } from './settingsForm';
import type { FormModalError } from './types';

type Props = InstanceType<typeof SettingsFormFooter>['$props'];

interface StateSeed {
  saved?: boolean;
  dirty?: boolean;
  pending?: boolean;
  showsError?: boolean;
  error?: FormModalError | null;
}

/** What useSettingsForm gives the footer, by hand. */
function state(seed: StateSeed = {}) {
  return {
    saved: ref(seed.saved ?? false),
    dirty: ref(seed.dirty ?? false),
    pending: ref(seed.pending ?? false),
    showsError: ref(seed.showsError ?? false),
    error: shallowRef<FormModalError | null>(seed.error ?? null),
    save: vi.fn(async (): Promise<void> => {}),
  };
}

const TEXTS = { saveLabel: 'Save', savedLabel: 'Settings saved' } as const;

const REFUSED: FormModalError = { code: 'conflict', message: 'Someone else changed them.', status: 409 };

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

/** A settings page's form: a field, then the footer at its end. */
const SettingsPage = defineComponent({
  props: { footer: { type: Object as PropType<Props>, required: true } },
  setup: (props) => () =>
    h('form', { 'data-testid': 'page-form' }, [h('p', { 'data-testid': 'page-field' }, 'A field'), h(SettingsFormFooter, props.footer)]),
});

/** Mounts the footer where a page has it: at the end of its `<form>`. */
function mountFooter<S extends SettingsFormFooterState>(settings: S, props: Partial<Props> = {}) {
  const footer = { settings, testid: 'demo-settings', ...TEXTS, ...props };
  const wrapper = mount(SettingsPage, { props: { footer }, global: { plugins: [createShellI18n({ locale: 'en' })] } });
  mounted.push(wrapper);
  const hook = (suffix: string, prefix = 'demo-settings') => wrapper.find(`[data-testid="${prefix}-${suffix}"]`);
  return { wrapper, settings, hook };
}

const disabled = (el: Element): boolean =>
  (el as HTMLElement & { disabled?: boolean }).disabled === true || el.hasAttribute('disabled');

const iconOf = (el: Element): string | undefined => (el as HTMLElement & { icon?: string }).icon;

/** An `ion-button`'s type: Vue sets it as the element's property (as `disabled`), not as an attribute. */
const typeOf = (el: Element): string | null => (el as HTMLElement & { type?: string }).type ?? el.getAttribute('type');

describe('SettingsFormFooter', () => {
  it('is in @erplora/ui/components, next to useSettingsForm', () => {
    expect(components.SettingsFormFooter).toBe(SettingsFormFooter);
  });

  it('paints «Save» alone while nothing happened, off with nothing to send', () => {
    const { hook } = mountFooter(state());
    const save = hook('save');
    expect(save.exists()).toBe(true);
    expect(save.element.tagName).toBe('ION-BUTTON');
    expect(typeOf(save.element)).toBe('submit');
    expect(save.text()).toBe('Save');
    expect(disabled(save.element)).toBe(true);
    expect(hook('save-error').exists()).toBe(false);
    expect(hook('saved').exists()).toBe(false);
  });

  it('turns «Save» on when there is something to send, and off again while it is on its way', async () => {
    const { hook, settings } = mountFooter(state({ dirty: true }));
    expect(disabled(hook('save').element)).toBe(false);
    settings.pending.value = true;
    await flushPromises();
    expect(disabled(hook('save').element)).toBe(true);
  });

  it('a tap on «Save» saves the form', async () => {
    const { hook, settings } = mountFooter(state({ dirty: true }));
    await hook('save').trigger('click');
    expect(settings.save).toHaveBeenCalledTimes(1);
  });

  it('a refusal says itself in a red notice, with its message under the page heading, while useSettingsForm says it has something to say', async () => {
    const { hook, settings } = mountFooter(state({ showsError: true, error: REFUSED }), { errorHeading: 'The settings were not saved' });
    const notice = hook('save-error');
    expect(notice.exists()).toBe(true);
    expect(notice.attributes('data-tone')).toBe('danger');
    expect(notice.get('.heading').text()).toBe('The settings were not saved');
    expect(notice.get('.body').text()).toBe('Someone else changed them.');
    // It follows useSettingsForm's `showsError`, not the bare error: a corrected field takes it away.
    settings.showsError.value = false;
    await flushPromises();
    expect(hook('save-error').exists()).toBe(false);
  });

  it('without a heading, the red notice is the message alone', () => {
    const { hook } = mountFooter(state({ showsError: true, error: REFUSED }));
    expect(hook('save-error').find('.heading').exists()).toBe(false);
    expect(hook('save-error').get('.body').text()).toBe('Someone else changed them.');
  });

  it('«saved» says the page text in a green notice while the last save stands', async () => {
    const { hook, settings } = mountFooter(state({ saved: true }));
    const notice = hook('saved');
    expect(notice.exists()).toBe(true);
    expect(notice.attributes('data-tone')).toBe('success');
    expect(notice.get('.body').text()).toBe('Settings saved');
    settings.saved.value = false;
    await flushPromises();
    expect(hook('saved').exists()).toBe(false);
  });

  it('every text is the page one: the piece says nothing of its own', () => {
    const { wrapper, hook } = mountFooter(state({ saved: true, showsError: true, error: REFUSED }), {
      saveLabel: 'Guardar',
      savedLabel: 'Ajustes guardados',
      errorHeading: 'No se pudieron guardar los ajustes',
    });
    expect(hook('save').text()).toBe('Guardar');
    expect(hook('saved').get('.body').text()).toBe('Ajustes guardados');
    expect(hook('save-error').get('.heading').text()).toBe('No se pudieron guardar los ajustes');
    expect(wrapper.text()).not.toMatch(/\bSave\b|saved/);
  });

  it('the notices go right before «Save», all three children of the page form, so the page lays them out as before', () => {
    const { wrapper, hook } = mountFooter(state({ saved: true, showsError: true, error: REFUSED }));
    const form = wrapper.get('[data-testid="page-form"]').element;
    const ids = [...form.children].map((child) => child.getAttribute('data-testid'));
    expect(ids).toEqual(['page-field', 'demo-settings-save-error', 'demo-settings-saved', 'demo-settings-save']);
    expect(hook('save').element.parentElement).toBe(form);
  });

  it('its hooks carry the page prefix (`<testid>-save-error`, `-saved`, `-save`)', () => {
    const { hook } = mountFooter(state({ saved: true, showsError: true, error: REFUSED }), { testid: 'ob-settings' });
    expect(hook('save-error', 'ob-settings').exists()).toBe(true);
    expect(hook('saved', 'ob-settings').exists()).toBe(true);
    expect(hook('save', 'ob-settings').exists()).toBe(true);
  });

  describe('variants', () => {
    it('`spinner`: «Save» spins while it is on its way, and only then (Staff, Attendance)', async () => {
      const { hook, settings } = mountFooter(state({ dirty: true }), { spinner: true });
      expect(hook('save').find('ion-spinner').exists()).toBe(false);
      settings.pending.value = true;
      await flushPromises();
      const spinner = hook('save').get('ion-spinner');
      expect(spinner.attributes('slot')).toBe('start');
      expect(spinner.attributes('aria-hidden')).toBe('true');
    });

    it('without `spinner`, «Save» never spins (the other six pages)', () => {
      const { hook } = mountFooter(state({ dirty: true, pending: true }));
      expect(hook('save').find('ion-spinner').exists()).toBe(false);
    });

    it('`saveIcon`: «Save» shows its icon, and the spinner instead of it while saving (Attendance)', async () => {
      const { hook, settings } = mountFooter(state({ dirty: true }), { spinner: true, saveIcon: 'lucide:save' });
      const icon = hook('save').get('ion-icon');
      expect(icon.attributes('slot')).toBe('start');
      expect(iconOf(icon.element)).toBe(resolveIcon('lucide:save'));
      settings.pending.value = true;
      await flushPromises();
      expect(hook('save').find('ion-icon').exists()).toBe(false);
      expect(hook('save').find('ion-spinner').exists()).toBe(true);
    });

    it('`allowUnchanged`: «Save» stays on with nothing to send, off only while saving (Attendance)', async () => {
      const { hook, settings } = mountFooter(state({ dirty: false }), { allowUnchanged: true });
      expect(disabled(hook('save').element)).toBe(false);
      await hook('save').trigger('click');
      expect(settings.save).toHaveBeenCalledTimes(1);
      settings.pending.value = true;
      await flushPromises();
      expect(disabled(hook('save').element)).toBe(true);
    });

    it('`readonly`: whoever may not change the settings has no «Save» (Attendance)', () => {
      const { hook } = mountFooter(state({ dirty: true }), { readonly: true });
      expect(hook('save').exists()).toBe(false);
    });
  });

  describe('with useSettingsForm', () => {
    const scopes: EffectScope[] = [];
    afterEach(() => {
      for (const scope of scopes.splice(0)) scope.stop();
    });

    interface Out {
      name: string;
    }
    type Form = Out;

    /** A command as `useCommand` gives it: pending while on its way, its error after a refusal. */
    function command(answer: (input: Partial<Out>) => Promise<Out>) {
      const pending = ref(false);
      const error = shallowRef<FormModalError | null>(null);
      const run = vi.fn(async (input: Partial<Out>): Promise<Out> => {
        pending.value = true;
        error.value = null;
        try {
          return await answer(input);
        } catch (err) {
          error.value = err as FormModalError;
          throw err;
        } finally {
          pending.value = false;
        }
      });
      return { run, pending, error };
    }

    function mountPage(answer: (input: Partial<Out>) => Promise<Out>) {
      const data = shallowRef<Out>({ name: 'Old' });
      const cmd = command(answer);
      const scope = effectScope();
      scopes.push(scope);
      const settings = scope.run(() => useSettingsForm(data, cmd, { toForm: (out: Out): Form => ({ name: out.name }) }))!;
      const { hook } = mountFooter(settings, { errorHeading: 'The settings were not saved' });
      return { cmd, settings, hook };
    }

    it('takes what useSettingsForm gives as it is', () => {
      expectTypeOf<ReturnType<typeof useSettingsForm<Out, Form, Partial<Out>>>>().toMatchTypeOf<SettingsFormFooterState>();
    });

    it('a change turns «Save» on; «Save» sends it and says «saved»; another change takes «saved» away', async () => {
      const { cmd, settings, hook } = mountPage(async (input) => ({ name: input.name ?? 'Old' }));
      expect(disabled(hook('save').element)).toBe(true);
      settings.set('name', 'New');
      await flushPromises();
      expect(disabled(hook('save').element)).toBe(false);
      await hook('save').trigger('click');
      await flushPromises();
      expect(cmd.run).toHaveBeenCalledWith({ name: 'New' });
      expect(hook('saved').exists()).toBe(true);
      expect(disabled(hook('save').element)).toBe(true);
      settings.set('name', 'Newer');
      await flushPromises();
      expect(hook('saved').exists()).toBe(false);
    });

    it('a refusal by fields says itself in red until the person corrects something', async () => {
      const refusal: FormModalError = {
        code: 'invalid_payload',
        message: 'Check the highlighted details.',
        status: 422,
        fields: { name: 'Too long.' },
      };
      const { settings, hook } = mountPage(async () => Promise.reject(refusal));
      settings.set('name', 'A very long name');
      await flushPromises();
      await hook('save').trigger('click');
      await flushPromises();
      expect(hook('save-error').get('.body').text()).toBe('Check the highlighted details.');
      expect(hook('saved').exists()).toBe(false);
      settings.set('name', 'Short');
      await flushPromises();
      expect(hook('save-error').exists()).toBe(false);
    });
  });
});
