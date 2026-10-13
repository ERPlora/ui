import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyUserThemePreferences,
  bootTheme,
  chooseThemeMode,
  DEFAULT_THEME_CONTRAST,
  hasLocalPalette,
  isDark,
  resetUserThemePreferences,
  setHubPalette,
  setLocalPalette,
  setThemeContrast,
  setThemeMode,
  setThemePersister,
  THEME_CONTRASTS,
  THEME_PALETTES,
  themeContrast,
  themeMode,
  themePalette,
  toggleTheme,
} from './theme';

let dark = false;
let listeners: Array<() => void> = [];

beforeEach(() => {
  dark = false;
  listeners = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') && dark,
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  }));
  window.matchMedia = globalThis.matchMedia;
  resetUserThemePreferences();
  setHubPalette('erplora');
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-ep-palette');
  document.documentElement.removeAttribute('data-ep-contrast');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setThemePersister(undefined);
});

const html = document.documentElement;

describe('mode', () => {
  it('system follows prefers-color-scheme', () => {
    dark = true;
    bootTheme();
    expect(html.classList.contains('ion-palette-dark')).toBe(true);
    expect(isDark.value).toBe(true);
  });

  it('live-follows a prefers-color-scheme change while in system mode', () => {
    bootTheme();
    expect(html.classList.contains('ion-palette-dark')).toBe(false);
    dark = true;
    listeners.forEach((cb) => cb());
    expect(html.classList.contains('ion-palette-dark')).toBe(true);
  });

  it('an explicit mode wins over the system and is not touched by system changes', () => {
    dark = true;
    bootTheme();
    setThemeMode('light');
    expect(html.classList.contains('ion-palette-dark')).toBe(false);
    listeners.forEach((cb) => cb());
    expect(html.classList.contains('ion-palette-dark')).toBe(false);
    setThemeMode('dark');
    expect(html.classList.contains('ion-palette-dark')).toBe(true);
  });

  it('bootTheme clears the legacy localStorage keys', () => {
    const store = new Map([
      ['erplora.theme', 'dark'],
      ['erplora.palette', 'ocean'],
    ]);
    vi.stubGlobal('localStorage', { removeItem: (k: string) => store.delete(k) });
    bootTheme();
    expect([...store.keys()]).toEqual([]);
  });

  it('toggleTheme flips to the opposite of the real state and calls the persister', () => {
    const persist = vi.fn();
    setThemePersister(persist);
    dark = true;
    setThemeMode('system');
    toggleTheme();
    expect(html.classList.contains('ion-palette-dark')).toBe(false);
    expect(persist).toHaveBeenCalledWith('light');
  });
});

describe('chooseThemeMode (the user menu: light, dark, system)', () => {
  it('applies the mode the person chose and hands it to the persister', () => {
    const persist = vi.fn();
    setThemePersister(persist);
    chooseThemeMode('dark');
    expect(themeMode.value).toBe('dark');
    expect(html.classList.contains('ion-palette-dark')).toBe(true);
    chooseThemeMode('system');
    expect(themeMode.value).toBe('system');
    expect(html.classList.contains('ion-palette-dark')).toBe(false);
    expect(persist.mock.calls).toEqual([['dark'], ['system']]);
  });
});

// The accessible colours (mockups README §6.15, UX-AUDIT-2 V-01/V-02): the brand primary #1496d6 is
// 3.3:1 with white; `aa` switches primary, success, warning and danger to AA solids (theme-css.test.ts
// measures them). Ioan decides which one is the default: ONE line, `DEFAULT_THEME_CONTRAST`.
describe('contrast (brand colours or AA colours)', () => {
  it('has two settings and the brand colours are the default until Ioan decides', () => {
    expect(THEME_CONTRASTS).toEqual(['brand', 'aa']);
    expect(DEFAULT_THEME_CONTRAST).toBe('brand');
  });

  it('aa sets data-ep-contrast on <html>; brand removes it', () => {
    setThemeContrast('aa');
    expect(html.getAttribute('data-ep-contrast')).toBe('aa');
    expect(themeContrast.value).toBe('aa');
    setThemeContrast('brand');
    expect(html.hasAttribute('data-ep-contrast')).toBe(false);
    expect(themeContrast.value).toBe('brand');
  });

  it('an unknown setting degrades to the brand colours', () => {
    setThemeContrast('aa');
    setThemeContrast('neon' as never);
    expect(themeContrast.value).toBe('brand');
    expect(html.hasAttribute('data-ep-contrast')).toBe(false);
  });

  it('bootTheme applies the default, or the contrast it is given (createShell({ contrast }))', () => {
    bootTheme();
    expect(html.hasAttribute('data-ep-contrast')).toBe(false);
    bootTheme({ contrast: 'aa' });
    expect(html.getAttribute('data-ep-contrast')).toBe('aa');
  });
});

describe('palette', () => {
  it('exposes the brand palettes of theme/palettes.css', () => {
    expect(THEME_PALETTES).toEqual(['erplora', 'terracotta', 'corporate', 'minimal', 'forest', 'ocean', 'violet']);
  });

  it('the default palette removes data-ep-palette, any other sets it', () => {
    setHubPalette('ocean');
    expect(html.getAttribute('data-ep-palette')).toBe('ocean');
    setHubPalette('erplora');
    expect(html.hasAttribute('data-ep-palette')).toBe(false);
  });

  it('a personal override beats the hub palette; clearing it falls back', () => {
    setHubPalette('forest');
    setLocalPalette('violet');
    expect(themePalette.value).toBe('violet');
    expect(hasLocalPalette.value).toBe(true);
    setLocalPalette('');
    expect(themePalette.value).toBe('forest');
    expect(hasLocalPalette.value).toBe(false);
  });

  it('an unknown palette degrades to the default without breaking', () => {
    setHubPalette('from-the-future');
    expect(themePalette.value).toBe('erplora');
  });

  it('applyUserThemePreferences applies mode, palette and the hub palette; null inherits', () => {
    applyUserThemePreferences('dark', 'minimal', 'ocean');
    expect(html.classList.contains('ion-palette-dark')).toBe(true);
    expect(html.getAttribute('data-ep-palette')).toBe('minimal');
    applyUserThemePreferences(null, null);
    expect(html.getAttribute('data-ep-palette')).toBe('ocean');
  });
});

// The server paints the palette into the HTML before the SPA boots (`live/spa.py` reads this cookie
// into `<html data-ep-palette>`): without it, every load flashed the default palette first.
describe('palette cookie (ep_palette)', () => {
  let written: string[];

  beforeEach(() => {
    written = [];
    vi.spyOn(document, 'cookie', 'set').mockImplementation((value: string) => {
      written.push(value);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('remembers the effective palette on every change, for the whole site, for a year', () => {
    setHubPalette('forest');
    expect(written.at(-1)).toBe('ep_palette=forest; path=/; max-age=31536000; SameSite=Lax');
    setLocalPalette('violet');
    expect(written.at(-1)).toBe('ep_palette=violet; path=/; max-age=31536000; SameSite=Lax');
    setLocalPalette('');
    expect(written.at(-1)).toBe('ep_palette=forest; path=/; max-age=31536000; SameSite=Lax');
  });

  it('remembers the default palette too, so an old choice never outlives a reset', () => {
    setHubPalette('ocean');
    setHubPalette('erplora');
    expect(written.at(-1)).toBe('ep_palette=erplora; path=/; max-age=31536000; SameSite=Lax');
  });

  it('bootTheme remembers the palette it paints', () => {
    bootTheme();
    expect(written.at(-1)).toBe('ep_palette=erplora; path=/; max-age=31536000; SameSite=Lax');
  });

  it('is Secure over https', () => {
    vi.stubGlobal('location', { ...window.location, protocol: 'https:' });
    setHubPalette('ocean');
    expect(written.at(-1)).toBe('ep_palette=ocean; path=/; max-age=31536000; SameSite=Lax; Secure');
  });
});
