// Shell theme: light/dark mode + brand PALETTE (ADR-0138). Ported from ERPlora hub
// `apps/web/src/lib/theme.ts`. The mode is applied to <html> with Ionic's `ion-palette-dark` class
// and the palette with the `data-ep-palette` attribute (theme/palettes.css, ported from OutfitKit;
// `live/spa.html` sets the same attribute before the SPA boots, so a rename touches both).
// The mode toggle lives in the topbar (AppTopbar.vue); the palette picker in settings.
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

/**
 * Applies the effective palette to <html> (the contract of theme/palettes.css):
 * 'erplora' (default) REMOVES the attribute; any other sets it.
 */
function applyPalette(): void {
  if (typeof document === 'undefined') return;
  const p = themePalette.value;
  const root = document.documentElement;
  if (p === 'erplora') root.removeAttribute('data-ep-palette');
  else root.setAttribute('data-ep-palette', p);
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

/**
 * Boots the theme: applies the mode and palette and, in 'system' mode, subscribes to
 * `prefers-color-scheme` changes to reflect them live. Call once at startup (the global palette
 * arrives later, when hub settings resolve).
 */
export function bootTheme(): void {
  try {
    localStorage.removeItem('erplora.theme');
    localStorage.removeItem('erplora.palette');
  } catch {
    /* storage unavailable: nothing to clean */
  }
  applyMode(_mode.value);
  applyPalette();
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (_mode.value === 'system') applyMode('system');
    });
  }
}
