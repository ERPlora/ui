// The shell theme's own stylesheets (PLAN §16.11): our tokens are `--ep-*` with the values OutfitKit's
// tokens had, and the optional palettes and the footer tabbar that came from OutfitKit live here,
// with the same values. CSS is not applied under happy-dom, so these read the rules themselves.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { THEME_PALETTES } from '../theme';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (sheet: string): string => readFileSync(join(HERE, sheet), 'utf8');
const plain = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const SHEETS = ['variables.css', 'palettes.css', 'erplora-logo.css', 'tabbar.css', 'polish.css', 'global.css', 'print.css'];
const variables = plain(read('variables.css'));

/** Every value `variables.css` gives `name`, in file order (light, then dark). */
const values = (name: string): string[] =>
  [...variables.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim());

/** Body of every block whose selector is exactly `selector`. */
function blocks(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
}

/** Custom properties a block declares. */
const declared = (body: string): string[] => [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);

describe('theme tokens: ours (--ep-*), none of OutfitKit', () => {
  it('no shell stylesheet declares or reads an OutfitKit token, nor styles an OutfitKit element', () => {
    for (const sheet of SHEETS) {
      const css = plain(read(sheet));
      expect(css, sheet).not.toMatch(/--ok-/);
      expect(css, sheet).not.toMatch(/(^|[\s,>+~}])ok-[a-z]|\.ok-[a-z]/m);
      // Nor OutfitKit's `data-ok-*` attributes, not even in a comment: the palette is `data-ep-palette`.
      expect(read(sheet), sheet).not.toMatch(/data-ok-/);
    }
  });

  it('keeps every value the OutfitKit tokens had, light then dark', () => {
    const expected: Record<string, string[]> = {
      '--ep-radius': ['14px'],
      '--ep-radius-sm': ['10px'],
      '--ep-radius-pill': ['999px'],
      '--ep-radius-lg': ['16px'],
      '--ep-radius-sheet-top': ['18px 18px 0 0'],
      '--ep-shadow-xs': ['0 1px 2px rgba(17, 24, 39, 0.05)', '0 1px 2px rgba(0, 0, 0, 0.4)'],
      '--ep-shadow-sm': [
        '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
        '0 1px 3px rgba(0, 0, 0, 0.5)',
      ],
      '--ep-shadow-md': [
        '0 6px 20px rgba(17, 24, 39, 0.08), 0 2px 6px rgba(17, 24, 39, 0.04)',
        '0 8px 24px rgba(0, 0, 0, 0.55)',
      ],
      '--ep-shadow-pop': ['0 12px 32px rgba(17, 24, 39, 0.14)', '0 12px 32px rgba(0, 0, 0, 0.55)'],
      '--ep-shadow-modal': ['0 18px 50px rgba(17, 24, 39, 0.18)', '0 18px 50px rgba(0, 0, 0, 0.65)'],
      '--ep-surface-muted': ['var(--ion-color-step-50)', '#101216'],
      '--ep-touch-min': ['48px'],
      '--ep-touch-lg': ['56px'],
      '--ep-work-surface-min': ['480px'],
      '--ep-ring-accent': ['inset 0 0 0 1px var(--ion-color-primary)'],
      '--ep-scrim': ['rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.6)'],
      '--ep-on-accent': ['var(--ion-color-primary-contrast)'],
    };
    for (const [token, value] of Object.entries(expected)) expect(values(token), token).toEqual(value);
  });

  it('every --ep-* a shell stylesheet reads without a fallback is defined by the theme', () => {
    for (const sheet of SHEETS) {
      for (const [, token] of plain(read(sheet)).matchAll(/var\((--ep-[a-z0-9-]+)\)/g)) {
        expect(values(token), `${sheet}: ${token}`).not.toEqual([]);
      }
    }
  });
});

describe('palettes.css (the optional brand palettes, ported from OutfitKit with the same values)', () => {
  const palettes = plain(read('palettes.css'));
  const optional = THEME_PALETTES.filter((palette) => palette !== 'erplora');

  it('has a light and a dark block for every palette but the default, selected by data-ep-palette on <html>', () => {
    // `data-ep-palette` is the attribute theme.ts writes and live/spa.html reads before the SPA boots.
    expect(optional).toHaveLength(6);
    for (const palette of optional) {
      expect(blocks(palettes, `:root[data-ep-palette='${palette}']`), palette).toHaveLength(1);
      expect(blocks(palettes, `:root.ion-palette-dark[data-ep-palette='${palette}']`), palette).toHaveLength(1);
    }
  });

  it('both blocks of a palette set the same --ion-* tokens, so its dark block overrides the base dark theme', () => {
    for (const palette of optional) {
      const [light] = blocks(palettes, `:root[data-ep-palette='${palette}']`);
      const [dark] = blocks(palettes, `:root.ion-palette-dark[data-ep-palette='${palette}']`);
      const ion = (body: string) => declared(body).filter((token) => token.startsWith('--ion-'));
      expect(ion(light).length, palette).toBeGreaterThan(20);
      expect(ion(dark), palette).toEqual(ion(light));
      // The base dark theme gives the muted surface a zinc literal: the palette's must follow the palette.
      expect(dark, palette).toMatch(/--ep-surface-muted:\s*var\(--ion-color-step-50\);/);
    }
  });

  it('keeps the brand colour of each palette', () => {
    const primary = (palette: string) =>
      /--ion-color-primary:\s*([^;]+);/.exec(blocks(palettes, `:root[data-ep-palette='${palette}']`)[0])?.[1];
    expect(primary('terracotta')).toBe('#E8552A');
    expect(primary('corporate')).toBe('#0F3F9C');
  });
});

/** The declarations of a block, one per entry, in order and without their whitespace. */
const declarations = (body: string | undefined): string[] =>
  (body ?? '')
    .split(';')
    .map((declaration) => declaration.trim().replace(/\s+/g, ' '))
    .filter(Boolean);

/** Body of the block `selector` inside every `@media <query>` of `css`. */
function mediaBlocks(css: string, query: string, selector: string): string[] {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`@media ${escaped}\\s*\\{((?:[^{}]*\\{[^}]*\\})*)\\s*\\}`, 'g'))].flatMap((m) =>
    blocks(m[1], selector),
  );
}

describe('tabbar.css (the footer ion-segment as navigation, ported from OutfitKit)', () => {
  const tabbar = plain(read('tabbar.css'));

  it('fills the footer, with a minimum tab width before it scrolls (--ep-tabbar-min, 64px)', () => {
    expect(blocks(tabbar, '.tabbar')).toHaveLength(1);
    expect(declarations(blocks(tabbar, '.tabbar')[0]).join('; ')).toBe(
      [
        'width: 100%',
        'margin-inline: 0',
        'box-sizing: border-box',
        'grid-auto-columns: minmax(var(--ep-tabbar-min, 64px), 1fr)',
        'justify-content: start',
        'overflow-x: auto',
        'scrollbar-width: none',
        'cursor: grab',
      ].join('; '),
    );
  });

  // FIX-UI-TABBAR-375: a phone's bottom bar shows four or five tabs whole (iOS tab bar, Material's
  // navigation bar). Ionic's iOS segment button brings `min-width: 70px` and 13px of side padding, made
  // for the compact segmented control: five of them need 374px, more than a 375px phone's strip (367px).
  it('lets a footer tab shrink to the floor and keeps its label 4px off its edges', () => {
    expect(blocks(tabbar, '.tabbar ion-segment-button')).toHaveLength(1);
    expect(declarations(blocks(tabbar, '.tabbar ion-segment-button')[0]).join('; ')).toBe(
      ['min-width: 0', '--padding-start: 4px', '--padding-end: 4px'].join('; '),
    );
  });

  it('on a phone (≤640px) writes the tab labels at 11px, between the iOS tab bar (10pt) and Material (12sp)', () => {
    expect(mediaBlocks(tabbar, '(max-width: 640px)', '.tabbar ion-segment-button')).toHaveLength(1);
    expect(declarations(mediaBlocks(tabbar, '(max-width: 640px)', '.tabbar ion-segment-button')[0]).join('; ')).toBe(
      'font-size: 11px',
    );
  });

  it('fades only the edge that hides tabs (--ep-tabbar-fade, 36px) and drags without selecting text', () => {
    for (const side of ['end', 'start', 'both']) {
      expect(blocks(tabbar, `.tabbar[data-overflow='${side}']`)[0], side).toContain('var(--ep-tabbar-fade, 36px)');
    }
    expect(blocks(tabbar, '.tabbar-dragging')[0]).toContain('user-select: none');
    expect(blocks(tabbar, '.tabbar::-webkit-scrollbar')[0]).toContain('display: none');
  });

  it('polish.css wraps its labels by word on the same class', () => {
    expect(blocks(plain(read('polish.css')), 'ion-footer .tabbar ion-label')[0]).toContain('white-space: normal');
  });
});

// ── Semantic palette, step aliases and contrast (L0-C; mockups README §6.9 and §6.15, UX-AUDIT-2
// V-01..V-03, V-16) ──────────────────────────────────────────────────────────────────────────────

/** WCAG 2.x relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgbOf(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `#rrggbb` → [r, g, b]. */
function rgbOf(hex: string): number[] {
  expect(hex, 'a literal #rrggbb').toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
}

/** WCAG 2.x contrast ratio of two colours. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The value one block gives a token (`undefined` when it does not declare it). */
const tokenIn = (body: string, name: string): string | undefined =>
  new RegExp(`(?:^|[\\s;{])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^;]+);`).exec(body)?.[1].trim();

const LIGHT = blocks(variables, ':root')[0];
const DARK = blocks(variables, ':root.ion-palette-dark')[0];
const AA_LIGHT = blocks(variables, ":root[data-ep-contrast='aa']:not([data-ep-palette])")[0];
const AA_DARK = blocks(variables, ":root.ion-palette-dark[data-ep-contrast='aa']:not([data-ep-palette])")[0];

/** The surfaces text sits on, per theme. */
const SURFACES = {
  light: { card: '#ffffff', canvas: '#f6f7f9', step100: '#eceef1', body: LIGHT },
  dark: { card: '#16181c', canvas: '#0b0c0e', step100: '#1d2025', body: DARK },
} as const;

/** A token as the theme resolves it: the dark block first, then the light one (same element). */
const resolved = (theme: keyof typeof SURFACES, name: string): string | undefined =>
  (theme === 'dark' ? tokenIn(DARK, name) : undefined) ?? tokenIn(LIGHT, name);

const VARIANTS = ['', '-rgb', '-contrast', '-contrast-rgb', '-shade', '-tint'];

describe('semantic palette (ported from the old SaaS ionic-theme.css, saas origin/develop)', () => {
  it('sets secondary, success, warning, danger and medium with all six Ionic variants', () => {
    for (const colour of ['primary', 'secondary', 'success', 'warning', 'danger', 'medium']) {
      for (const variant of VARIANTS) {
        expect(tokenIn(LIGHT, `--ion-color-${colour}${variant}`), `--ion-color-${colour}${variant}`).toBeDefined();
      }
    }
  });

  it('keeps the brand values of the old SaaS', () => {
    const brand: Record<string, string> = {
      '--ion-color-primary': '#1496d6',
      '--ion-color-secondary': '#6366f1',
      '--ion-color-success': '#23944e',
      '--ion-color-warning': '#e8a912',
      '--ion-color-warning-contrast': '#1c1b18',
      '--ion-color-danger': '#d6404f',
      '--ion-color-medium': '#6b7280',
    };
    for (const [token, value] of Object.entries(brand)) expect(tokenIn(LIGHT, token), token).toBe(value);
  });

  it('leaves tertiary, light and dark to Ionic (its defaults equal the old SaaS, and its dark palette inverts them)', () => {
    for (const colour of ['tertiary', 'light', 'dark']) expect(tokenIn(LIGHT, `--ion-color-${colour}`), colour).toBeUndefined();
  });

  it('every -rgb is its hex, in every block that sets one', () => {
    for (const body of [LIGHT, DARK, AA_LIGHT, AA_DARK]) {
      for (const [, name, value] of body.matchAll(/(--ion-color-[a-z]+(?:-contrast)?)-rgb:\s*([^;]+);/g)) {
        const hex = tokenIn(body, name);
        if (hex === undefined) continue;
        expect(value.split(',').map((part) => Number(part.trim())), name).toEqual(rgbOf(hex));
      }
    }
  });

  it('the medium chip is legible in both themes: its contrast colour flips to dark text in dark (V-16)', () => {
    for (const theme of ['light', 'dark'] as const) {
      const solid = resolved(theme, '--ion-color-medium') as string;
      const text = resolved(theme, '--ion-color-medium-contrast') as string;
      expect(contrastRatio(text, solid), `${theme}: ${text} on ${solid}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('step ramp: Ionic 8 names with the legacy ones aliased (old SaaS ionic-theme.css)', () => {
  const STEPS = [50, 100, 150, 200, 250, 300, 500, 700, 850];

  it('the --ion-background-color-step-* ramp is literal in both themes, and --ion-color-step-* reads it', () => {
    for (const step of STEPS) {
      expect(tokenIn(LIGHT, `--ion-background-color-step-${step}`), `light ${step}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokenIn(DARK, `--ion-background-color-step-${step}`), `dark ${step}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokenIn(LIGHT, `--ion-color-step-${step}`)).toBe(`var(--ion-background-color-step-${step})`);
      // Declared once, on <html>: the dark block only moves the ramp, the alias follows it.
      expect(tokenIn(DARK, `--ion-color-step-${step}`), `dark ${step}`).toBeUndefined();
    }
  });

  it('keeps the values the ramp had (light greys, dark zinc)', () => {
    expect(tokenIn(LIGHT, '--ion-background-color-step-50')).toBe('#f3f4f6');
    expect(tokenIn(LIGHT, '--ion-background-color-step-850')).toBe('#2a2d33');
    expect(tokenIn(DARK, '--ion-background-color-step-50')).toBe('#16181c');
    expect(tokenIn(DARK, '--ion-background-color-step-850')).toBe('#d7dae0');
  });

  it('dark defines --ion-color-step-600, the body text of ion-card, at AA on the card and the canvas (README §6.9)', () => {
    // Without it ion-card falls back to Ionic's grey: #666 on #16181c is about 3:1.
    const text = tokenIn(DARK, '--ion-color-step-600') as string;
    expect(text).toBe('#8b919d');
    expect(contrastRatio(text, SURFACES.dark.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text, SURFACES.dark.canvas)).toBeGreaterThanOrEqual(4.5);
  });
});

// Always on, both themes: text on a tinted background (a status pill, a notice, the selected menu
// item) and secondary text. The SaaS pages and @erplora/ui components read these names.
describe('AA text tokens (--ep-<colour>-text on --ep-<colour>-tint, --ep-text-muted)', () => {
  const COLOURS = ['primary', 'success', 'warning', 'danger'];

  it('-text is ≥ 4.5:1 on its -tint, on the card and on the canvas, in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const { card, canvas } = SURFACES[theme];
      for (const colour of COLOURS) {
        const text = resolved(theme, `--ep-${colour}-text`) as string;
        const tint = resolved(theme, `--ep-${colour}-tint`) as string;
        for (const [surface, bg] of [['tint', tint], ['card', card], ['canvas', canvas]]) {
          expect(contrastRatio(text, bg), `${theme} ${colour}: ${text} on ${surface} ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('the primary text on tints is the deep shade #0b5f8a (UX-AUDIT-2 V-02)', () => {
    expect(tokenIn(LIGHT, '--ep-primary-text')).toBe('#0b5f8a');
  });

  it('the tints are the brand colours washed over the card (12 % light, 14 % dark)', () => {
    expect(tokenIn(LIGHT, '--ep-primary-tint')).toBe('#e3f2fa');
    expect(tokenIn(LIGHT, '--ep-success-tint')).toBe('#e5f2ea');
    expect(tokenIn(LIGHT, '--ep-warning-tint')).toBe('#fcf5e3');
    expect(tokenIn(LIGHT, '--ep-danger-tint')).toBe('#fae8ea');
  });

  it('--ep-text-muted is ≥ 4.5:1 on the card, the canvas and the step-100 surface (table headers), in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const muted = resolved(theme, '--ep-text-muted') as string;
      for (const surface of ['card', 'canvas', 'step100'] as const) {
        expect(contrastRatio(muted, SURFACES[theme][surface]), `${theme} muted on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('the brand accent and its accessible twin are tokens of their own', () => {
    expect(tokenIn(LIGHT, '--ep-primary-brand')).toBe('#1496d6');
    expect(tokenIn(LIGHT, '--ep-primary-accessible')).toBe('#0e78ad');
  });

  it('polish.css paints the secondary text of the menu with --ep-text-muted (V-03: 3.74:1 before)', () => {
    const polish = plain(read('polish.css'));
    expect(blocks(polish, '.sidebar-user-email')[0]).toContain('color: var(--ep-text-muted)');
    expect(blocks(polish, '.sidebar-foot-text')[0]).toContain('color: var(--ep-text-muted)');
  });

  it('an optional palette derives the primary tint and text from its own primary', () => {
    const [rule] = blocks(plain(read('palettes.css')), ':root[data-ep-palette]');
    expect(rule).toContain('--ep-primary-tint: color-mix(in srgb, var(--ion-color-primary) 12%, var(--ion-card-background))');
    expect(rule).toContain('--ep-primary-text: color-mix(in srgb, var(--ion-color-primary) 60%, var(--ion-text-color))');
  });
});

// The switch (theme.ts `setThemeContrast('aa')`, createShell `{ contrast: 'aa' }`): the AA solids for
// the ERPlora palette. Default: the brand colours, until Ioan decides (README §6.15).
describe("the 'aa' contrast (data-ep-contrast='aa'): AA solids for primary, success, warning and danger", () => {
  const COLOURS = ['primary', 'success', 'warning', 'danger'];

  it('the brand primary is why it exists: white on #1496d6 is under 4.5:1', () => {
    expect(contrastRatio('#ffffff', tokenIn(LIGHT, '--ion-color-primary') as string)).toBeLessThan(4.5);
  });

  it('has a light and a dark block that set the same tokens (the dark one must override the light one)', () => {
    expect(AA_LIGHT, 'light block').toBeDefined();
    expect(AA_DARK, 'dark block').toBeDefined();
    const ion = (body: string) => declared(body).filter((token) => token.startsWith('--ion-'));
    expect(ion(AA_DARK)).toEqual(ion(AA_LIGHT));
    expect(ion(AA_LIGHT)).toEqual(COLOURS.flatMap((colour) => VARIANTS.map((variant) => `--ion-color-${colour}${variant}`)));
  });

  it('its contrast colour is ≥ 4.5:1 on the solid, the shade (pressed) and the tint (hover), in both themes', () => {
    for (const [theme, body] of [['light', AA_LIGHT], ['dark', AA_DARK]] as const) {
      for (const colour of COLOURS) {
        const text = tokenIn(body, `--ion-color-${colour}-contrast`) as string;
        for (const variant of ['', '-shade', '-tint']) {
          const solid = tokenIn(body, `--ion-color-${colour}${variant}`) as string;
          expect(contrastRatio(text, solid), `${theme} ${colour}${variant}: ${text} on ${solid}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('light primary is the accessible blue (4.87:1); dark keeps #2aa6e4 with dark text, as Material 3 and iOS do', () => {
    expect(tokenIn(AA_LIGHT, '--ion-color-primary')).toBe('#0e78ad');
    expect(tokenIn(AA_LIGHT, '--ion-color-danger')).toBe('#c8374a');
    expect(tokenIn(AA_DARK, '--ion-color-primary')).toBe('#2aa6e4');
    expect(tokenIn(AA_DARK, '--ion-color-primary-contrast')).toBe('#0b0c0e');
  });

  it('polish.css: the selected menu item reads the AA text on its tint', () => {
    const polish = plain(read('polish.css'));
    const [selected] = blocks(polish, ":root[data-ep-contrast='aa']:not([data-ep-palette]) .nav-item.selected");
    expect(selected).toContain('--background: var(--ep-primary-tint)');
    expect(selected).toContain('--color: var(--ep-primary-text)');
    const [avatar] = blocks(polish, ":root[data-ep-contrast='aa']:not([data-ep-palette]) .sidebar-user-avatar");
    expect(avatar).toContain('background: var(--ep-primary-tint)');
    expect(avatar).toContain('color: var(--ep-primary-text)');
  });
});

describe('shell layout rules of the SaaS dashboard (dashboard-shell.css) the SPA shell keeps', () => {
  const polish = plain(read('polish.css'));

  it('pinned menu 232–248 px, rail 68 px, drawer 280 px below lg', () => {
    expect(blocks(polish, 'ion-split-pane')[0]).toContain('--side-max-width: 248px');
    expect(blocks(polish, 'ion-split-pane.rail')[0]).toContain('--side-width: 68px');
    expect(blocks(polish, 'ion-menu.dash-menu')[0]).toContain('--width: 280px');
  });

  it('the topbar names the section after the title, muted, hidden on a phone', () => {
    expect(blocks(polish, '.topbar-section::before')[0]).toContain("content: '· '");
    expect(blocks(polish, '.topbar-section')[0]).toContain('color: var(--ep-text-muted)');
    expect(polish).toMatch(/@media \(max-width: 640px\) \{\s*\.topbar-section \{\s*display: none;/);
  });
});
