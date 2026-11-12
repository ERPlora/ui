// The mode goes on <html> as Ionic's `ion-palette-dark` class and the palette as the `data-ep-palette`
// attribute, which `live/spa.html` also sets before the SPA boots, so a rename touches both. The palette
// painted last is remembered in the `ep_palette` cookie, which `live/spa.py` reads to paint that
// attribute on the next load (no flash of the default palette).
//
// The palette has two layers: the hub's global one (set by an admin, through `setHubPalette`) and a
// per-user override ('' follows the global one). Nothing is persisted here: personal preferences live
// in the user profile API, and the app registers `setThemePersister(fn)` to save the person's mode.
import { computed, ref } from 'vue';

import { BRAND_PALETTE_IDS, type BrandPaletteId } from './brandbook';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_SCALES = [80, 90, 100, 110, 120] as const;

export type ThemeScale = (typeof THEME_SCALES)[number];

const _scale = ref<ThemeScale>(100);

export const themeScale = computed<ThemeScale>(() => _scale.value);

export function setThemeScale(scale: number): void {
  _scale.value = (THEME_SCALES as readonly number[]).includes(scale) ? (scale as ThemeScale) : 100;
  if (typeof document !== 'undefined') document.documentElement.style.zoom = `${_scale.value}%`;
}

/** Valid palettes, catalogued in brandbook.ts and painted by theme/palettes.css. */
export const THEME_PALETTES = BRAND_PALETTE_IDS;

export type ThemePalette = BrandPaletteId;

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const _mode = ref<ThemeMode>('system');
const _systemDark = ref(false);

export const themeMode = computed<ThemeMode>(() => _mode.value);

/** Is the shell painting dark RIGHT NOW (resolving 'system')? */
export const isDark = computed<boolean>(
  () => _mode.value === 'dark' || (_mode.value === 'system' && _systemDark.value),
);

/** Applies the effective mode to <html> (Ionic class). */
function applyMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  _systemDark.value = prefersDark();
  const dark = mode === 'dark' || (mode === 'system' && _systemDark.value);
  document.documentElement.classList.toggle('ion-palette-dark', dark);
}

/** Sets the mode in memory only. */
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
  scale = 100,
): void {
  if (hubPalette) setHubPalette(hubPalette);
  setThemeMode(mode ?? 'system');
  setLocalPalette(palette ?? '');
  setThemeScale(scale);
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

/** `'aa'` makes the accessible colours the default. */
export const DEFAULT_THEME_CONTRAST: ThemeContrast = 'brand';

const _contrast = ref<ThemeContrast>(DEFAULT_THEME_CONTRAST);

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
 * Boots the theme: applies the mode, the palette, the interface scale and the contrast and, in 'system' mode,
 * subscribes to `prefers-color-scheme` changes to reflect them live. Call once at startup (the global palette
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
  setThemeScale(_scale.value);
  setThemeContrast(options.contrast ?? DEFAULT_THEME_CONTRAST);
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (_mode.value === 'system') applyMode('system');
    });
  }
}
