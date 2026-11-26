import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createShellI18n } from './i18n';
import SidebarInstallQrCode from './SidebarInstallQrCode.vue';

const URL = 'https://bar.erplora.com/';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function mountCode(props: { code?: string; failed?: boolean }, locale = 'en') {
  return mount(SidebarInstallQrCode, {
    props: { url: URL, failed: false, ...props },
    global: { plugins: [createShellI18n({ locale })] },
  });
}

describe('SidebarInstallQrCode', () => {
  it('paints the code it is given at 132 px, named by its address, over its title and hint', () => {
    const wrapper = mountCode({ code: PNG });
    const code = wrapper.get('img.sidebar-install-qr-code');
    expect(code.attributes('src')).toBe(PNG);
    expect([code.attributes('width'), code.attributes('height')]).toEqual(['132', '132']);
    expect(code.attributes('alt')).toBe(`QR code of ${URL}`);
    expect(wrapper.get('.sidebar-install-qr-title').text()).toBe('Open on your phone');
    expect(wrapper.get('.sidebar-install-qr-hint').text()).toBe(
      'Scan the code. To keep it there, add it to your home screen from your browser menu.',
    );
  });

  it('keeps the room of the code while it is drawn', () => {
    const wrapper = mountCode({});
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('.sidebar-install-qr-pending').classes()).toContain('sidebar-install-qr-code');
    expect(wrapper.get('.sidebar-install-qr-pending').attributes('aria-hidden')).toBe('true');
  });

  it('writes the address to type when the code could not be drawn', () => {
    const wrapper = mountCode({ failed: true });
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.sidebar-install-qr-pending').exists()).toBe(false);
    expect(wrapper.get('.sidebar-install-qr-url').text()).toBe(URL);
  });

  it('in the language of the person', () => {
    const wrapper = mountCode({ code: PNG }, 'es');
    expect(wrapper.get('img').attributes('alt')).toBe(`Código QR de ${URL}`);
    expect(wrapper.get('.sidebar-install-qr-title').text()).toBe('Ábrelo en el móvil');
  });
});
