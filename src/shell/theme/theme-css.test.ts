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

describe('tabbar.css (the footer ion-segment as navigation, ported from OutfitKit)', () => {
  const tabbar = plain(read('tabbar.css'));

  it('fills the footer, with a minimum tab width before it scrolls (--ep-tabbar-min, 88px)', () => {
    const [rule] = blocks(tabbar, '.tabbar');
    for (const declaration of [
      'width: 100%',
      'margin-inline: 0',
      'box-sizing: border-box',
      'grid-auto-columns: minmax(var(--ep-tabbar-min, 88px), 1fr)',
      'justify-content: start',
      'overflow-x: auto',
      'scrollbar-width: none',
      'cursor: grab',
    ]) {
      expect(rule, declaration).toContain(declaration);
    }
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
