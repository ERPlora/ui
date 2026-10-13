// Shell theme: light/dark mode + brand PALETTE (ADR-0138). Ported from ERPlora hub
// `apps/web/src/lib/theme.ts`. The mode is applied to <html> with Ionic's `ion-palette-dark` class
// and the palette with the `data-ep-palette` attribute (theme/palettes.css, ported from OutfitKit;
// `live/spa.html` sets the same attribute before the SPA boots, so a rename touches both). The
// palette painted last is remembered in the `ep_palette` cookie, which `live/spa.py` reads to paint
// that attribute on the next load (no flash of the default palette).
// The mode is chosen in the user menu (App.vue: light, dark, system); the palette picker in settings.
//
// Contrast, ONE switch: `brand` paints the brand colours of today (primary #1496d6, 3.3:1 with white);
// `aa` paints the AA solids of primary, success, warning and danger (`data-ep-contrast="aa"` on
// <html>, theme/variables.css; mockups README §6.15, UX-AUDIT-2 V-01). Which one is the default is
// Ioan's decision: `DEFAULT_THEME_CONTRAST`, below; a project can also pass `createShell({ contrast })`.
//
// Modes:
//  - 'system' -> follows `prefers-color-scheme` (and reacts live to its changes).
//  - 'light' / 'dark' -> force the mode, ignoring the system.
//
// Palette, TWO layers:
//  - the GLOBAL palette of the hub (set by an admin; arrives through `setHubPalette`).
//  - a PER-USER override; '' = no override (follow the global one).
//
// The source persisted nothing here (personal preferences live in the user profile API) and only
// cleaned two legacy localStorage keys; the port keeps that. Differences from the source:
//  - `toggleTheme()` no longer imports the user-profile module; the app registers
//    `setThemePersister(fn)` and gets the new mode.
//  - `isDark` reads a reactive copy of the system preference, so it cannot go stale.
import { computed, ref } from 'vue';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Valid palettes: mirror 1:1 of `theme/palettes.css` plus the default. */
export const THEME_PALETTES = [
  'erplora',
  'terracotta',
  'corporate',
  'minimal',
  'forest',
  'ocean',
  'violet',
] as const;

export type ThemePalette = (typeof THEME_PALETTES)[number];

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const _mode = ref<ThemeMode>('system');
const _systemDark = ref(false);

/** Theme mode selected by the user ('system' | 'light' | 'dark'). */
export const themeMode = computed<ThemeMode>(() => _mode.value);

/** Is the shell painting dark RIGHT NOW (resolving 'system')? */
export const isDark = computed<boolean>(
  () => _mode.value === 'dark' || (_mode.value === 'system' && _systemDark.value),
);

/** Applies the effective mode to <html> (Ionic class). No eval; direct DOM manipulation. */
function applyMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  _systemDark.value = prefersDark();
  const dark = mode === 'dark' || (mode === 'system' && _systemDark.value);
  document.documentElement.classList.toggle('ion-palette-dark', dark);
}

/** Sets the mode in memory. Personal persistence lives in the profile API. */
export function setThemeMode(mode: ThemeMode): void {
  _mode.value = mode;
  applyMode(mode);
}

let persister: ((mode: ThemeMode) => void) | undefined;

/** Registers what to do when the user toggles (typically: save it in the profile). */
export function setThemePersister(fn: ((mode: ThemeMode) => void) | undefined): void {
  persister = fn;
}

/** The person chose a mode (the user menu): apply it and hand it to the persister. */
export function chooseThemeMode(mode: ThemeMode): void {
  setThemeMode(mode);
  persister?.(mode);
}

/** Toggles light<->dark (topbar toggle). Resolves 'system' to the opposite of the real state. */
export function toggleTheme(): void {
  _systemDark.value = prefersDark();
  setThemeMode(isDark.value ? 'light' : 'dark');
  persister?.(_mode.value);
}

function isPalette(v: unknown): v is ThemePalette {
  return typeof v === 'string' && (THEME_PALETTES as readonly string[]).includes(v);
}

/** Personal override of the user ('' = no override, follows the hub's global one). */
const _localPalette = ref<ThemePalette | ''>('');
/** GLOBAL palette of the hub (hub settings). */
const _hubPalette = ref<ThemePalette>('erplora');

/** EFFECTIVE palette the shell paints (local override -> hub global -> erplora). */
export const themePalette = computed<ThemePalette>(() => _localPalette.value || _hubPalette.value);

/** Does the user have a personal override (not following the hub's global palette)? */
export const hasLocalPalette = computed<boolean>(() => _localPalette.value !== '');

/** Cookie the server reads to paint the palette before the SPA boots (`PALETTE_COOKIE` of `live/spa.py`). */
const PALETTE_COOKIE = 'ep_palette';
const PALETTE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Remembers the palette for the server, site-wide; `Secure` whenever the page is served over https. */
function rememberPalette(palette: ThemePalette): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${PALETTE_COOKIE}=${palette}; path=/; max-age=${PALETTE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * Applies the effective palette to <html> (the contract of theme/palettes.css):
 * 'erplora' (default) REMOVES the attribute; any other sets it. The default is remembered too, so
 * an old choice never outlives a reset.
 */
function applyPalette(): void {
  if (typeof document === 'undefined') return;
  const p = themePalette.value;
  const root = document.documentElement;
  if (p === 'erplora') root.removeAttribute('data-ep-palette');
  else root.setAttribute('data-ep-palette', p);
  rememberPalette(p);
}

/** Sets (or clears, with '') the personal override in memory. */
export function setLocalPalette(palette: ThemePalette | ''): void {
  _localPalette.value = isPalette(palette) ? palette : '';
  applyPalette();
}

/** Applies the user's row. `null` = inherit from the Hub (or the system for the mode). */
export function applyUserThemePreferences(
  mode: ThemeMode | null,
  palette: ThemePalette | null,
  hubPalette?: string,
): void {
  if (hubPalette) setHubPalette(hubPalette);
  setThemeMode(mode ?? 'system');
  setLocalPalette(palette ?? '');
}

/** Clears the state on sign-out so it does not leak to the next user. */
export function resetUserThemePreferences(): void {
  applyUserThemePreferences(null, null);
}

/**
 * Syncs the hub's GLOBAL palette. An unknown value degrades to the default without breaking
 * (defense against settings written by a future version).
 */
export function setHubPalette(palette: string): void {
  _hubPalette.value = isPalette(palette) ? palette : 'erplora';
  applyPalette();
}

/** `brand`: the brand colours of today; `aa`: the AA solids of primary, success, warning and danger. */
export const THEME_CONTRASTS = ['brand', 'aa'] as const;

export type ThemeContrast = (typeof THEME_CONTRASTS)[number];

/** 🔵 The one-line switch (README §6.15, pending Ioan's decision): `'aa'` makes the accessible colours the default. */
export const DEFAULT_THEME_CONTRAST: ThemeContrast = 'brand';

const _contrast = ref<ThemeContrast>(DEFAULT_THEME_CONTRAST);

/** The contrast the shell paints. */
export const themeContrast = computed<ThemeContrast>(() => _contrast.value);

/** Applies the contrast to <html>: `aa` sets `data-ep-contrast="aa"`, `brand` removes it. Unknown → brand. */
export function setThemeContrast(contrast: ThemeContrast): void {
  _contrast.value = (THEME_CONTRASTS as readonly string[]).includes(contrast) ? contrast : 'brand';
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (_contrast.value === 'aa') root.setAttribute('data-ep-contrast', 'aa');
  else root.removeAttribute('data-ep-contrast');
}

/**
 * Boots the theme: applies the mode, the palette and the contrast and, in 'system' mode, subscribes
 * to `prefers-color-scheme` changes to reflect them live. Call once at startup (the global palette
 * arrives later, when hub settings resolve).
 */
export function bootTheme(options: { contrast?: ThemeContrast } = {}): void {
  try {
    localStorage.removeItem('erplora.theme');
    localStorage.removeItem('erplora.palette');
  } catch {
    /* storage unavailable: nothing to clean */
  }
  applyMode(_mode.value);
  applyPalette();
  setThemeContrast(options.contrast ?? DEFAULT_THEME_CONTRAST);
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (_mode.value === 'system') applyMode('system');
    });
  }
}
