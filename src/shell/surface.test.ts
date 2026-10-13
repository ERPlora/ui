// Where the shell is running (PLAN-SAAS §3.6, point 5; mockups README §4): the web, the desktop app
// (Tauri on Windows), the mobile app (Tauri on Android, or another WebView that announces itself) or
// the account page the app opened in the system browser (`?surface=account`). Everything that sells
// is web only; the other three surfaces get the in-app rules.
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, withDirectives } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applySurface,
  bootSurface,
  detectSurface,
  IN_APP_CLASS,
  SURFACES,
  type SurfaceWindow,
  useSurface,
  vWebOnly,
} from './surface';

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

/** A window as `detectSurface` reads it: the bridge, the user agent, the query and `<html data-surface>`. */
function fakeWindow(overrides: Partial<SurfaceWindow> & { search?: string; rendered?: string } = {}): SurfaceWindow {
  const { search = '', rendered, ...rest } = overrides;
  return {
    navigator: { userAgent: DESKTOP_UA },
    location: { search },
    document: { documentElement: { dataset: rendered ? { surface: rendered } : {} } },
    ...rest,
  };
}

const html = document.documentElement;

afterEach(() => {
  applySurface('web');
  html.removeAttribute('data-surface');
  html.classList.remove(IN_APP_CLASS);
  window.history.replaceState(null, '', '/');
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe('detectSurface', () => {
  it('is the web in a browser: no bridge, no app user agent, no hint', () => {
    expect(detectSurface({ win: fakeWindow() })).toBe('web');
  });

  it('is the desktop app when the Tauri bridge is there (__TAURI_INTERNALS__ or __TAURI__)', () => {
    expect(detectSurface({ win: fakeWindow({ __TAURI_INTERNALS__: {} }) })).toBe('desktop');
    expect(detectSurface({ win: fakeWindow({ __TAURI__: {} }) })).toBe('desktop');
  });

  it('is the mobile app when the bridge runs in an Android (or iOS) WebView', () => {
    const android = fakeWindow({ __TAURI_INTERNALS__: {}, navigator: { userAgent: ANDROID_UA } });
    expect(detectSurface({ win: android })).toBe('mobile');
    const iphone = fakeWindow({ __TAURI__: {}, navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' } });
    expect(detectSurface({ win: iphone })).toBe('mobile');
  });

  it('a native WebView without the bridge announces itself in its user agent (ERPloraApp/<version>)', () => {
    expect(detectSurface({ win: fakeWindow({ navigator: { userAgent: `${ANDROID_UA} ERPloraApp/2.4.0` } }) })).toBe('mobile');
    expect(detectSurface({ win: fakeWindow({ navigator: { userAgent: `${DESKTOP_UA} ERPloraApp/2.4.0` } }) })).toBe('desktop');
    // A browser on a phone is still the web: only the app token makes it an app.
    expect(detectSurface({ win: fakeWindow({ navigator: { userAgent: ANDROID_UA } }) })).toBe('web');
  });

  it('takes ?surface= from the address (the account the app opens in the system browser)', () => {
    expect(detectSurface({ win: fakeWindow({ search: '?surface=account' }) })).toBe('account');
    expect(detectSurface({ win: fakeWindow({ search: '?next=/x&surface=mobile' }) })).toBe('mobile');
  });

  it('takes the surface the server rendered on <html data-surface> (sticky across page loads)', () => {
    expect(detectSurface({ win: fakeWindow({ rendered: 'account' }) })).toBe('account');
  });

  it('ignores a hint that is not a surface', () => {
    expect(detectSurface({ win: fakeWindow({ search: '?surface=kiosk', rendered: 'tv' }) })).toBe('web');
  });

  it('the bridge wins over any hint: a link cannot turn the app into the web', () => {
    expect(detectSurface({ win: fakeWindow({ __TAURI_INTERNALS__: {}, search: '?surface=web' }) })).toBe('desktop');
  });

  it('an explicit surface (createShell({ surface })) wins over everything', () => {
    expect(detectSurface({ explicit: 'account', win: fakeWindow({ __TAURI_INTERNALS__: {} }) })).toBe('account');
  });

  it('knows exactly four surfaces', () => {
    expect(SURFACES).toEqual(['web', 'desktop', 'mobile', 'account']);
  });
});

describe('applySurface / bootSurface (what createShell does at boot)', () => {
  it('marks <html> with data-surface and, off the web, the in-app-shell class', () => {
    applySurface('desktop');
    expect(html.dataset.surface).toBe('desktop');
    expect(html.classList.contains(IN_APP_CLASS)).toBe(true);
    expect(IN_APP_CLASS).toBe('in-app-shell');

    applySurface('web');
    expect(html.dataset.surface).toBe('web');
    expect(html.classList.contains(IN_APP_CLASS)).toBe(false);
  });

  it('the account surface follows the in-app rules too', () => {
    applySurface('account');
    expect(html.classList.contains(IN_APP_CLASS)).toBe(true);
  });

  it('boots from the real window: a browser is the web', () => {
    bootSurface()();
    expect(html.dataset.surface).toBe('web');
    expect(useSurface().isWeb.value).toBe(true);
  });

  it('boots from ?surface= in the address', () => {
    window.history.replaceState(null, '', '/launch?surface=account');
    bootSurface()();
    expect(html.dataset.surface).toBe('account');
    expect(useSurface().surface.value).toBe('account');
  });

  it('boots with the explicit surface', () => {
    bootSurface({ surface: 'mobile' })();
    expect(html.dataset.surface).toBe('mobile');
  });

  it('looks again when the page has loaded: Android injects the bridge late, in no guaranteed order', () => {
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'interactive' });
    try {
      const stop = bootSurface();
      expect(useSurface().surface.value).toBe('web');
      (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
      window.dispatchEvent(new Event('load'));
      expect(useSurface().surface.value).toBe('desktop');
      expect(html.classList.contains(IN_APP_CLASS)).toBe(true);
      stop();
    } finally {
      delete (document as { readyState?: unknown }).readyState;
    }
  });

  it('its cleanup stops looking', () => {
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'interactive' });
    try {
      bootSurface()();
      (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
      window.dispatchEvent(new Event('load'));
      expect(useSurface().surface.value).toBe('web');
    } finally {
      delete (document as { readyState?: unknown }).readyState;
    }
  });
});

describe('useSurface', () => {
  it('says the surface, whether it is the web and whether the in-app rules apply, live', async () => {
    const { surface, isWeb, inApp } = useSurface();
    expect([surface.value, isWeb.value, inApp.value]).toEqual(['web', true, false]);
    applySurface('mobile');
    await nextTick();
    expect([surface.value, isWeb.value, inApp.value]).toEqual(['mobile', false, true]);
  });
});

describe('v-web-only', () => {
  const Probe = defineComponent({
    props: { color: { type: String, default: 'red' } },
    setup(props) {
      return () => withDirectives(h('a', { class: 'buy', style: { color: props.color } }, 'Buy'), [[vWebOnly]]);
    },
  });

  it('shows the element on the web and hides it on every app surface, following the surface live', async () => {
    const wrapper = mount(Probe);
    const link = wrapper.get('a.buy').element as HTMLElement;
    expect(link.style.display).toBe('');

    for (const surface of ['desktop', 'mobile', 'account'] as const) {
      applySurface(surface);
      await nextTick();
      expect(link.style.display, surface).toBe('none');
    }

    applySurface('web');
    await nextTick();
    expect(link.style.display).toBe('');
  });

  it('stays hidden when its component re-renders its style', async () => {
    applySurface('desktop');
    const wrapper = mount(Probe);
    await wrapper.setProps({ color: 'blue' });
    const link = wrapper.get('a.buy').element as HTMLElement;
    expect(link.style.color).toBe('blue');
    expect(link.style.display).toBe('none');
  });

  it('stops following the surface once unmounted', async () => {
    const wrapper = mount(Probe);
    const link = wrapper.get('a.buy').element as HTMLElement;
    wrapper.unmount();
    applySurface('desktop');
    await nextTick();
    expect(link.style.display).toBe('');
  });
});
