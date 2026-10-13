import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyUserThemePreferences,
  bootTheme,
  hasLocalPalette,
  isDark,
  resetUserThemePreferences,
  setHubPalette,
  setLocalPalette,
  setThemeMode,
  setThemePersister,
  THEME_PALETTES,
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
  document.documentElement.removeAttribute('data-ok-palette');
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

describe('palette', () => {
  it('exposes the OutfitKit palettes', () => {
    expect(THEME_PALETTES).toEqual(['erplora', 'terracotta', 'corporate', 'minimal', 'forest', 'ocean', 'violet']);
  });

  it('the default palette removes data-ok-palette, any other sets it', () => {
    setHubPalette('ocean');
    expect(html.getAttribute('data-ok-palette')).toBe('ocean');
    setHubPalette('erplora');
    expect(html.hasAttribute('data-ok-palette')).toBe(false);
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
    expect(html.getAttribute('data-ok-palette')).toBe('minimal');
    applyUserThemePreferences(null, null);
    expect(html.getAttribute('data-ok-palette')).toBe('ocean');
  });
});
