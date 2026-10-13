// The language a component of `@erplora/ui/components` paints its texts and numbers in, when the
// page does not pass one: the app's vue-i18n locale (the person's, which `createShell` installs),
// else the language of the page (`<html lang>`, which the shell keeps in step), else the browser's.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import { createShellI18n } from '../shell/i18n';
import { useComponentLocale } from './locale';

const Probe = defineComponent({
  props: { explicit: { type: String, default: undefined } },
  setup(props) {
    const locale = useComponentLocale(() => props.explicit);
    return () => h('span', locale.value);
  },
});

afterEach(() => {
  document.documentElement.lang = '';
  vi.restoreAllMocks();
});

describe('useComponentLocale', () => {
  it('follows the app’s vue-i18n locale when it is installed, and its changes', async () => {
    const i18n = createShellI18n({ locale: 'es' });
    document.documentElement.lang = 'en';
    const wrapper = mount(Probe, { global: { plugins: [i18n] } });
    expect(wrapper.text()).toBe('es');
    i18n.global.locale.value = 'en';
    await nextTick();
    expect(wrapper.text()).toBe('en');
  });

  it('without vue-i18n, reads the language of the page (`<html lang>`) as written', () => {
    document.documentElement.lang = 'es-ES';
    expect(mount(Probe).text()).toBe('es-ES');
  });

  it('without vue-i18n nor `<html lang>`, the browser’s language', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-MX');
    expect(mount(Probe).text()).toBe('es-MX');
  });

  it('English when nothing says otherwise', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('');
    expect(mount(Probe).text()).toBe('en');
  });

  it('a locale the page passes wins over all of them', () => {
    document.documentElement.lang = 'en';
    const wrapper = mount(Probe, { props: { explicit: 'es-AR' }, global: { plugins: [createShellI18n({ locale: 'en' })] } });
    expect(wrapper.text()).toBe('es-AR');
  });
});
