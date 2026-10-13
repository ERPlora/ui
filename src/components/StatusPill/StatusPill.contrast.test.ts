// Contrast of the StatusPill tones (working rules §2.4, UX audit of the mockups): a pill's text is
// small, so it must reach WCAG AA (4.5:1) against its own tint, on every surface a pill sits on
// (page, card, list row and, in dark, a dialog), in light and dark, with the shell's theme
// (`variables.css` over Ionic's defaults, in the cascade order `createShell` loads them) and with
// every optional palette (`palettes.css`). CSS is not applied under happy-dom, so this reads the
// custom properties from the stylesheets themselves and composites the colours as the browser
// does with `color-mix(in srgb, …)`.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = join(HERE, '../../shell/theme');
const require = createRequire(import.meta.url);

const plain = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const ionicCss = (file: string): string => plain(readFileSync(require.resolve(`@ionic/vue/css/${file}`), 'utf8'));
const themeCss = (file: string): string => plain(readFileSync(join(THEME, file), 'utf8'));
/** The `<style>` blocks of the component, comments out. */
const pillCss = plain(
  [...readFileSync(join(HERE, 'StatusPill.vue'), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join('\n'),
);

type Vars = Record<string, string>;

/** Body of every rule whose selector is exactly `selector`. */
function blocks(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
}

/** Custom properties declared by every rule with exactly `selector` (later ones win). */
function vars(css: string, selector: string): Vars {
  const out: Vars = {};
  for (const body of blocks(css, selector)) {
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) out[name] = value.trim();
  }
  return out;
}

type Rgb = [number, number, number];

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

const percent = (value: string): number => {
  const m = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (!m) throw new Error(`not a percentage: ${value}`);
  return Number(m[1]) / 100;
};

/** `color-mix(in srgb, a p, b)`: interpolation of the gamma-encoded channels. */
const mix = (a: Rgb, b: Rgb, p: number): Rgb => a.map((c, i) => c * p + b[i] * (1 - p)) as Rgb;

/** A colour value against `scope`: hex, `var(--a, fallback)` or `color-mix(in srgb, a p%, b)`. */
function colour(value: string, scope: Vars, depth = 0): Rgb {
  const v = value.trim();
  if (depth > 20) throw new Error(`cyclic var(): ${value}`);
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
    return mix(colour(first.slice(0, at), scope, depth + 1), colour(second, scope, depth + 1), percent(first.slice(at + 1)));
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
function contrast(a: Rgb, b: Rgb): number {
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
const PALETTE_IDS = [...new Set([...palettes.matchAll(/data-ep-palette='([\w-]+)'/g)].map((m) => m[1]))];

interface Theme {
  name: string;
  dark: boolean;
  scope: Vars;
}

function themes(): Theme[] {
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
  // The «AA» contrast setting of the shell (`data-ep-contrast='aa'`, brand palette only), if the
  // theme has it.
  const aa = vars(variables, ":root[data-ep-contrast='aa']:not([data-ep-palette])");
  const aaDark = vars(variables, ":root.ion-palette-dark[data-ep-contrast='aa']:not([data-ep-palette])");
  if (Object.keys(aa).length) {
    out.push({ name: 'contrast aa light', dark: false, scope: light(aa) });
    out.push({ name: 'contrast aa dark', dark: true, scope: dark(aa, aaDark) });
  }
  for (const id of PALETTE_IDS) {
    const own = vars(palettes, `:root[data-ep-palette='${id}']`);
    const ownDark = vars(palettes, `:root.ion-palette-dark[data-ep-palette='${id}']`);
    out.push({ name: `${id} light`, dark: false, scope: light(own) });
    out.push({ name: `${id} dark`, dark: true, scope: dark(own, ownDark) });
  }
  return out;
}

/** Where a pill sits: the page, a card, a list row (DataTable) and, in dark, a dialog (Ionic's step-100). */
const SURFACES = ['--ion-background-color', '--ion-card-background', '--ion-item-background'];
const DARK_SURFACES = [...SURFACES, '--ion-color-step-100'];

const TONES = ['success', 'info', 'warning', 'danger', 'neutral'] as const;
const BASE = vars(pillCss, '.status-pill');
const toneVars = (tone: string): Vars => ({ ...BASE, ...vars(pillCss, `.status-pill[data-tone='${tone}']`) });

describe('StatusPill colours', () => {
  it('derive from one tone per pill: the tint is the tone over the surface, the text the tone darkened (light) or lightened (dark)', () => {
    const base = blocks(pillCss, '.status-pill').join(';');
    expect(base).toMatch(/background:\s*color-mix\(in srgb, var\(--status-pill-tone\) var\(--status-pill-wash\), transparent\)/);
    expect(base).toMatch(/color:\s*color-mix\(in srgb, var\(--status-pill-tone\) var\(--status-pill-ink\), black\)/);
    const dark = blocks(pillCss, ':root.ion-palette-dark .status-pill').join(';');
    expect(dark).toMatch(/color:\s*color-mix\(in srgb, var\(--status-pill-tone\) var\(--status-pill-ink-dark\), white\)/);
  });

  it('every tone reads the Ionic colour of its meaning, through our --ep-* token', () => {
    const expected = { success: 'success', info: 'primary', warning: 'warning', danger: 'danger', neutral: 'medium' };
    for (const tone of TONES) {
      expect(toneVars(tone)['--status-pill-tone'], tone).toMatch(
        new RegExp(`^var\\(--ep-${expected[tone]}, var\\(--ion-color-${expected[tone]}, #[0-9a-f]{6}\\)\\)$`, 'i'),
      );
    }
  });

  it('checks every palette of palettes.css too', () => {
    expect(PALETTE_IDS.length).toBeGreaterThanOrEqual(5);
  });

  for (const theme of themes()) {
    it(`text reaches AA (4.5:1) on its tint, every tone and surface — ${theme.name}`, () => {
      const failures: string[] = [];
      for (const tone of TONES) {
        const own = toneVars(tone);
        const scope = { ...theme.scope, ...own };
        const toneRgb = colour('var(--status-pill-tone)', scope);
        const wash = percent(own['--status-pill-wash']);
        const ink = theme.dark
          ? mix(toneRgb, [255, 255, 255], percent(own['--status-pill-ink-dark']))
          : mix(toneRgb, [0, 0, 0], percent(own['--status-pill-ink']));
        for (const surface of theme.dark ? DARK_SURFACES : SURFACES) {
          const tint = mix(toneRgb, colour(`var(${surface})`, scope), wash);
          const ratio = contrast(ink, tint);
          if (ratio < 4.5) failures.push(`${tone} on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }
});
