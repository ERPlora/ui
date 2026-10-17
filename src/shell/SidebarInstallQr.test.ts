import { flushPromises, mount } from '@vue/test-utils';
import QRCode from 'qrcode';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { unnamedButtons } from '../testing/a11y';
import { createShellI18n } from './i18n';
import { INSTALL_QR_OPTIONS } from './install-qr';
import { railCollapsed } from './sidebar';
import SidebarInstallQr from './SidebarInstallQr.vue';

function mountQr(locale = 'en') {
  return mount(SidebarInstallQr, { global: { plugins: [createShellI18n({ locale })] } });
}

afterEach(() => {
  vi.restoreAllMocks();
  railCollapsed.value = false;
  window.history.replaceState(null, '', '/');
});

// hub#1715 — «Open on your phone»: the code that carries this hub to a phone, in the sidebar footer,
// for everyone and with nothing to close.
describe('SidebarInstallQr', () => {
  it("paints the QR of the hub's address, not of the screen it sits on, at 132 px", async () => {
    window.history.replaceState(null, '', '/demo/items/42?shell=1');
    const wrapper = mountQr();
    const hub = `${window.location.origin}/`;
    // The PNG is encoded off the microtask queue (a stream), so wait for the image, not one tick.
    const code = await vi.waitFor(() => wrapper.get('.sidebar-install-qr-full img.sidebar-install-qr-code'));
    expect(code.attributes('src')).toBe(await QRCode.toDataURL(hub, { ...INSTALL_QR_OPTIONS }));
    expect(code.attributes('src')).toMatch(/^data:image\/png;base64,/);
    expect([code.attributes('width'), code.attributes('height')]).toEqual(['132', '132']);
    expect(code.attributes('alt')).toBe(`QR code of ${hub}`);
  });

  it('says what it is for and how to keep it, in the language of the person', async () => {
    const en = mountQr();
    expect(en.get('.sidebar-install-qr-title').text()).toBe('Open on your phone');
    expect(en.get('.sidebar-install-qr-hint').text()).toBe(
      'Scan the code. To keep it there, add it to your home screen from your browser menu.',
    );
    const es = mountQr('es');
    expect(es.get('.sidebar-install-qr-title').text()).toBe('Ábrelo en el móvil');
    expect(es.get('.sidebar-install-qr-hint').text()).toBe(
      'Escanea el código. Para dejarlo fijo, añádelo a la pantalla de inicio desde el menú del navegador.',
    );
  });

  it('keeps the room of the code while it is drawn, so the footer does not jump', () => {
    const wrapper = mountQr();
    expect(wrapper.find('img.sidebar-install-qr-code').exists()).toBe(false);
    expect(wrapper.get('.sidebar-install-qr-full .sidebar-install-qr-pending').classes()).toContain('sidebar-install-qr-code');
  });

  it('when the code cannot be drawn, writes the address to type instead, and says why in the console', async () => {
    const failure = new Error('canvas unavailable');
    vi.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(failure);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountQr();
    await flushPromises();
    expect(wrapper.find('img.sidebar-install-qr-code').exists()).toBe(false);
    expect(wrapper.find('.sidebar-install-qr-pending').exists()).toBe(false);
    expect(wrapper.get('.sidebar-install-qr-url').text()).toBe(`${window.location.origin}/`);
    expect(logged).toHaveBeenCalledWith('shell: the install QR could not be drawn', failure);
  });

  it('on the rail, its icon stands in for the code and opens the menu back up, where the code fits', async () => {
    railCollapsed.value = true;
    const wrapper = mountQr();
    const rail = wrapper.get('ion-button.sidebar-install-qr-rail');
    expect(rail.attributes('aria-label')).toBe('Open on your phone');
    expect(unnamedButtons(wrapper.element)).toEqual([]);
    await rail.trigger('click');
    expect(railCollapsed.value).toBe(false);
  });

  it('is unconditional: no permission, no plan and nothing to close (hub#1715)', () => {
    const wrapper = mountQr();
    expect(wrapper.get('[data-testid="sidebar-install-qr"]').findAll('[data-testid$="-close"], ion-menu-toggle')).toEqual([]);
  });
});
