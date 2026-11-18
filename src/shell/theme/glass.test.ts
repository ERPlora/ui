// CSS is not applied under happy-dom, so these read the rules of glass.css themselves.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  BLACK,
  blocks,
  colour,
  contrast,
  declaration,
  mix,
  percent,
  plain,
  resolved,
  themes,
  vars,
  WHITE,
} from '../../components/__tests__/themeContrast';

const HERE = dirname(fileURLToPath(import.meta.url));
const glass = plain(readFileSync(join(HERE, 'glass.css'), 'utf8'));
const variables = plain(readFileSync(join(HERE, 'variables.css'), 'utf8'));

const LIGHT = vars(glass, ':root');
const DARK = vars(glass, ':root.ion-palette-dark');
const OPAQUE = vars(glass, ':root.ep-opaque');

/** What the at-rule `prelude { … }` holds. */
function inside(prelude: string): string {
  const at = glass.indexOf(`${prelude} {`);
  expect(at, `${prelude} is missing`).toBeGreaterThan(-1);
  const open = at + prelude.length + 1;
  let depth = 1;
  let end = open + 1;
  for (; depth > 0; end++) depth += glass[end] === '{' ? 1 : glass[end] === '}' ? -1 : 0;
  return glass.slice(open + 1, end - 1);
}

const TOKENS = [
  '--ep-glass-bg',
  '--ep-glass-opacity',
  '--ep-glass-backdrop',
  '--ep-glass-border',
  '--ep-glass-highlight',
  '--ep-shadow-float',
  '--ep-toast-solid',
  '--ep-toast-opacity',
  '--ep-toast-bg',
  '--ep-toast-text',
  '--ep-toast-muted',
  '--ep-toast-border',
  '--ep-toast-success',
  '--ep-toast-info',
  '--ep-toast-warning',
  '--ep-toast-error',
  '--ep-spring',
  '--ep-ease-out',
];

describe('glass.css: the material of floating surfaces', () => {
  it('defines every token once on :root, and dark sets only what changes with the mode', () => {
    for (const token of TOKENS) expect(LIGHT, token).toHaveProperty(token);
    for (const token of Object.keys(DARK)) expect(TOKENS, token).toContain(token);
    for (const token of ['--ep-glass-opacity', '--ep-glass-border', '--ep-glass-highlight', '--ep-shadow-float']) {
      expect(DARK, token).toHaveProperty(token);
    }
    expect(blocks(glass, ':root')).toHaveLength(1);
    expect(blocks(glass, ':root.ion-palette-dark')).toHaveLength(1);
  });

  it('is translucent by mixing the theme colour with transparency, and blurs and saturates what is behind', () => {
    expect(LIGHT['--ep-glass-bg']).toBe('color-mix(in srgb, var(--ion-card-background) var(--ep-glass-opacity), transparent)');
    expect(LIGHT['--ep-toast-bg']).toBe('color-mix(in srgb, var(--ep-toast-solid) var(--ep-toast-opacity), transparent)');
    expect(LIGHT['--ep-glass-backdrop']).toBe('blur(20px) saturate(180%)');
    // The two layers of a floating shadow: a short sharp one and a long soft one.
    expect(LIGHT['--ep-shadow-float'].split('),')).toHaveLength(2);
    expect(DARK['--ep-shadow-float'].split('),')).toHaveLength(2);
  });

  it('reads its colours from the theme (--ion-*, --ep-*), never a literal, so a palette paints it too', () => {
    const coloured = TOKENS.filter((token) => !/opacity|backdrop|shadow|spring|ease/.test(token));
    for (const scope of [LIGHT, DARK]) {
      for (const token of coloured.filter((name) => name in scope)) {
        expect(scope[token], token).toMatch(/var\(--(ion|ep)-/);
        expect(scope[token], token).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|\b(white|black)\b/i);
      }
    }
  });

  it('every --ep-* it reads without a fallback is defined by the theme or by itself', () => {
    const defined = (token: string): boolean => token in LIGHT || new RegExp(`${token}:`).test(variables);
    for (const [, token] of glass.matchAll(/var\((--ep-[a-z0-9-]+)\)/g)) expect(defined(token), token).toBe(true);
  });
});

describe('glass.css: the toast pill', () => {
  it('its rim is the light one of its two colours in both modes, as glass catches the light', () => {
    for (const theme of themes()) {
      const scope = { ...theme.scope, ...LIGHT, ...(theme.dark ? DARK : {}) };
      const rim = /^color-mix\(in srgb, (var\([^)]+\)) \d+%, transparent\)$/.exec(scope['--ep-toast-border'])?.[1] ?? '';
      const lightness = (value: string): number => contrast(colour(value, scope), BLACK);
      expect(lightness(rim), theme.name).toBe(Math.max(lightness('var(--ep-toast-text)'), lightness('var(--ep-toast-solid)')));
    }
  });
});

describe('glass.css: the same design opaque', () => {
  const OFF = {
    '--ep-glass-bg': 'var(--ion-card-background)',
    '--ep-toast-bg': 'var(--ep-toast-solid)',
    '--ep-glass-backdrop': 'none',
  };

  it('the person turns it off with the ep-opaque class on <html>', () => {
    expect(OPAQUE).toEqual(OFF);
  });

  it('the system turns it off when it asks for less transparency', () => {
    expect(vars(inside('@media (prefers-reduced-transparency: reduce)'), ':root')).toEqual(OFF);
  });

  it('a browser without backdrop-filter gets it opaque, prefixed or not', () => {
    const prelude = '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))';
    expect(vars(inside(prelude), ':root')).toEqual(OFF);
  });

  it('keeps the shape, border and shadow: only the background and the blur change', () => {
    for (const token of Object.keys(OFF)) expect(DARK, `${token} would beat the opaque rules in dark`).not.toHaveProperty(token);
  });
});

describe('.ep-glass, the class a floating surface takes', () => {
  it('paints background, blur (prefixed too), border of light, inner highlight and the floating shadow', () => {
    expect(declaration(glass, '.ep-glass', 'background')).toBe('var(--ep-glass-bg)');
    expect(declaration(glass, '.ep-glass', 'backdrop-filter')).toBe('var(--ep-glass-backdrop)');
    expect(declaration(glass, '.ep-glass', '-webkit-backdrop-filter')).toBe('var(--ep-glass-backdrop)');
    expect(declaration(glass, '.ep-glass', 'border')).toBe('1px solid var(--ep-glass-border)');
    expect(declaration(glass, '.ep-glass', 'box-shadow')).toBe('inset 0 1px 0 var(--ep-glass-highlight), var(--ep-shadow-float)');
  });

  it('never animates: no transition, animation or will-change that would animate the blur or drop it', () => {
    expect(glass).not.toMatch(/transition|animation|@keyframes|will-change|(^|[^-])filter:\s*(?!var)/m);
  });

  it('keeps body text ≥ 4.5:1 on the glass over the lightest and darkest page, and opaque, in every theme', () => {
    for (const theme of themes()) {
      const scope = { ...theme.scope, ...LIGHT, ...(theme.dark ? DARK : {}) };
      const text = colour('var(--ion-text-color)', scope);
      const card = colour('var(--ion-card-background)', scope);
      const alpha = percent(resolved('var(--ep-glass-opacity)', scope));
      for (const backdrop of [BLACK, WHITE, card]) {
        expect(contrast(text, mix(card, backdrop, alpha)), theme.name).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
