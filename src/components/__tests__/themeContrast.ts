// Test helper: the shell's theme, read from its real stylesheets, to measure the contrast of a
// component's colours (working rules §2.4). CSS is not applied under happy-dom, so this reads the
// custom properties from the stylesheets themselves — Ionic's defaults, then `variables.css` and
// `palettes.css`, in the cascade order `createShell` loads them — and composites colours as the
// browser does with `color-mix(in srgb, …)`. Same method as `StatusPill.contrast.test.ts`.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THEME = join(dirname(fileURLToPath(import.meta.url)), '../../shell/theme');
const require = createRequire(import.meta.url);

export type Vars = Record<string, string>;
export type Rgb = [number, number, number];

/** CSS without its comments. */
export const plain = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const ionicCss = (file: string): string => plain(readFileSync(require.resolve(`@ionic/vue/css/${file}`), 'utf8'));
const themeCss = (file: string): string => plain(readFileSync(join(THEME, file), 'utf8'));

/** The `<style>` blocks of a single-file component, comments out. */
export function componentCss(sfcPath: string): string {
  const sfc = readFileSync(sfcPath, 'utf8');
  return plain([...sfc.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'));
}

/** Body of every rule whose selector is exactly `selector`. */
export function blocks(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
}

/** Custom properties declared by every rule with exactly `selector` (later ones win). */
export function vars(css: string, selector: string): Vars {
  const out: Vars = {};
  for (const body of blocks(css, selector)) {
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) out[name] = value.trim();
  }
  return out;
}

/** The value of `property` (not a custom property) in the rules with exactly `selector` (last wins). */
export function declaration(css: string, selector: string, property: string): string | undefined {
  let found: string | undefined;
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const body of blocks(css, selector)) {
    for (const m of body.matchAll(new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;]+)`, 'g'))) found = m[1].trim();
  }
  return found;
}

/** The arguments of `fn(…)` split at its top-level commas. */
function args(value: string, fn: string): string[] {
  const inner = value.slice(fn.length + 1, value.lastIndexOf(')'));
  const out: string[] = [];
  let level = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') level++;
    else if (inner[i] === ')') level--;
    else if (inner[i] === ',' && level === 0) {
      out.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(inner.slice(start).trim());
  return out;
}

/** `12%` → 0.12. */
export const percent = (value: string): number => {
  const m = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (!m) throw new Error(`not a percentage: ${value}`);
  return Number(m[1]) / 100;
};

/** `color-mix(in srgb, a p, b)`: interpolation of the gamma-encoded channels. */
export const mix = (a: Rgb, b: Rgb, p: number): Rgb => a.map((c, i) => c * p + b[i] * (1 - p)) as Rgb;

export const BLACK: Rgb = [0, 0, 0];
export const WHITE: Rgb = [255, 255, 255];

/** A plain value (`12%`) through its `var(--a, fallback)` chain against `scope`. */
export function resolved(value: string, scope: Vars, depth = 0): string {
  const v = value.trim();
  if (!v.startsWith('var(')) return v;
  if (depth > 20) throw new Error(`cyclic var(): ${value}`);
  const [name, ...fallback] = args(v, 'var');
  if (name in scope) return resolved(scope[name], scope, depth + 1);
  if (!fallback.length) throw new Error(`${name} is not defined and has no fallback`);
  return resolved(fallback.join(','), scope, depth + 1);
}

/** A colour value against `scope`: hex, `black`/`white`, `var(--a, fallback)` or `color-mix(in srgb, a p%, b)`. */
export function colour(value: string, scope: Vars, depth = 0): Rgb {
  const v = value.trim();
  if (depth > 20) throw new Error(`cyclic var(): ${value}`);
  if (v === 'black') return BLACK;
  if (v === 'white') return WHITE;
  if (v.startsWith('var(')) {
    const [name, ...fallback] = args(v, 'var');
    if (name in scope) return colour(scope[name], scope, depth + 1);
    if (!fallback.length) throw new Error(`${name} is not defined and has no fallback`);
    return colour(fallback.join(','), scope, depth + 1);
  }
  if (v.startsWith('color-mix(')) {
    const [space, first, second] = args(v, 'color-mix');
    if (space !== 'in srgb') throw new Error(`only srgb mixes are resolved: ${value}`);
    const at = first.lastIndexOf(' ');
    const amount = percent(resolved(first.slice(at + 1), scope));
    return mix(colour(first.slice(0, at), scope, depth + 1), colour(second, scope, depth + 1), amount);
  }
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (!m) throw new Error(`not a colour: ${value}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio of two opaque colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The theme, layer by layer in cascade order (specificity, then source order: Ionic's sheets load
// before ours, `variables.css` before `palettes.css`; the shell runs Ionic in `ios` mode).
const ionicDarkCss = ionicCss('palettes/dark.class.css');
const variables = themeCss('variables.css');
const palettes = themeCss('palettes.css');
const IONIC = vars(ionicCss('core.css'), ':root');
const IONIC_DARK = vars(ionicDarkCss, '.ion-palette-dark');
const IONIC_DARK_IOS = vars(ionicDarkCss, '.ion-palette-dark.ios');
const OURS = vars(variables, ':root');
const OURS_DARK = vars(variables, ':root.ion-palette-dark');

/** The optional palettes of `palettes.css` (`data-ep-palette`). */
export const PALETTE_IDS = [...new Set([...palettes.matchAll(/data-ep-palette='([\w-]+)'/g)].map((m) => m[1]))];

export interface Theme {
  name: string;
  dark: boolean;
  /** Every custom property in effect on `<html>` with this theme. */
  scope: Vars;
}

/** Light and dark of the brand theme, of its «AA» contrast setting and of every optional palette. */
export function themes(): Theme[] {
  const shared = vars(palettes, ':root[data-ep-palette]');
  const light = (extra: Vars = {}): Vars => ({ ...IONIC, ...OURS, ...extra });
  const dark = (extra: Vars = {}, extraDark: Vars = {}): Vars => ({
    ...IONIC,
    ...IONIC_DARK,
    ...OURS,
    ...IONIC_DARK_IOS,
    ...OURS_DARK,
    ...extra,
    ...extraDark,
  });
  const out: Theme[] = [
    { name: 'default light', dark: false, scope: light() },
    { name: 'default dark', dark: true, scope: dark() },
  ];
  const aa = vars(variables, ":root[data-ep-contrast='aa']:not([data-ep-palette])");
  const aaDark = vars(variables, ":root.ion-palette-dark[data-ep-contrast='aa']:not([data-ep-palette])");
  if (Object.keys(aa).length) {
    out.push({ name: 'contrast aa light', dark: false, scope: light(aa) });
    out.push({ name: 'contrast aa dark', dark: true, scope: dark(aa, aaDark) });
  }
  for (const id of PALETTE_IDS) {
    const own = vars(palettes, `:root[data-ep-palette='${id}']`);
    const ownDark = vars(palettes, `:root.ion-palette-dark[data-ep-palette='${id}']`);
    out.push({ name: `${id} light`, dark: false, scope: light({ ...shared, ...own }) });
    out.push({ name: `${id} dark`, dark: true, scope: dark({ ...shared, ...own }, ownDark) });
  }
  return out;
}

/** Where a component sits: the page, a card, a list row and, in dark, a dialog (Ionic's step-100). */
export const SURFACES = ['--ion-background-color', '--ion-card-background', '--ion-item-background'] as const;
export const DARK_SURFACES = [...SURFACES, '--ion-color-step-100'] as const;
export const surfacesOf = (theme: Theme): readonly string[] => (theme.dark ? DARK_SURFACES : SURFACES);
