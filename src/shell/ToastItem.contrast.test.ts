// A toast's text and icons must reach WCAG AA on its pill in every theme: light and dark, the «AA» contrast setting
// and every optional palette, as glass and opaque. Glass lets the page through, so the pill is measured over the
// lightest and the darkest page there can be (white and black) and over the theme's own canvas. happy-dom applies no
// CSS, so this reads the custom properties from the stylesheets themselves.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  BLACK,
  colour,
  componentCss,
  contrast,
  declaration,
  mix,
  percent,
  plain,
  resolved,
  type Rgb,
  themes,
  type Vars,
  vars,
  WHITE,
} from '../components/__tests__/themeContrast';

const HERE = dirname(fileURLToPath(import.meta.url));
const glass = plain(readFileSync(join(HERE, 'theme/glass.css'), 'utf8'));
const pill = componentCss(join(HERE, 'ToastItem.vue'));

const TONES = ['success', 'error', 'info', 'warning'] as const;
/** WCAG AA: 4.5:1 for text; 3:1 for an icon that is a control or carries meaning (1.4.11). */
const TEXT = 4.5;
const GRAPHIC = 3;

/** The tone token the pill paints the icon and the action of `tone` with. */
function toneToken(tone: (typeof TONES)[number]): string {
  const value = tone === 'info' ? declaration(pill, '.ep-toast', '--tone') : declaration(pill, `.ep-toast[data-tone='${tone}']`, '--tone');
  expect(value, tone).toBe(`var(--ep-toast-${tone})`);
  return value as string;
}

/** Every pill a toast can be painted on in `scope`: glass over a white, a black and the theme's page, and opaque. */
function pills(scope: Vars): Array<[string, Rgb]> {
  const solid = colour('var(--ep-toast-solid)', scope);
  const alpha = percent(resolved('var(--ep-toast-opacity)', scope));
  const page = colour('var(--ion-background-color)', scope);
  return [
    ['glass over white', mix(solid, WHITE, alpha)],
    ['glass over black', mix(solid, BLACK, alpha)],
    ['glass over the page', mix(solid, page, alpha)],
    ['opaque', colour(vars(glass, ':root.ep-opaque')['--ep-toast-bg'], scope)],
  ];
}

const scopes = themes().map((theme) => ({
  name: theme.name,
  scope: { ...theme.scope, ...vars(glass, ':root'), ...(theme.dark ? vars(glass, ':root.ion-palette-dark') : {}) },
}));

describe('a toast reads on its pill', () => {
  it('the pill is the glass mix of its solid colour, and opaque is that solid colour', () => {
    expect(vars(glass, ':root')['--ep-toast-bg']).toBe('color-mix(in srgb, var(--ep-toast-solid) var(--ep-toast-opacity), transparent)');
    expect(vars(glass, ':root.ep-opaque')['--ep-toast-bg']).toBe('var(--ep-toast-solid)');
    expect(declaration(pill, '.ep-toast', 'background')).toBe('var(--ep-toast-bg)');
  });

  it('its message is ≥ 4.5:1 in every theme, as glass and opaque', () => {
    expect(declaration(pill, '.ep-toast', 'color')).toBe('var(--ep-toast-text)');
    for (const { name, scope } of scopes) {
      const text = colour('var(--ep-toast-text)', scope);
      for (const [surface, bg] of pills(scope)) {
        expect(contrast(text, bg), `${name}, ${surface}`).toBeGreaterThanOrEqual(TEXT);
      }
    }
  });

  it('the icon and the action of each tone are ≥ 4.5:1: the action is text', () => {
    expect(declaration(pill, '.ep-toast__icon', 'color')).toBe('var(--tone)');
    expect(declaration(pill, '.ep-toast ion-button', '--color')).toBe('var(--tone)');
    for (const tone of TONES) {
      const token = toneToken(tone);
      for (const { name, scope } of scopes) {
        const ink = colour(token, scope);
        for (const [surface, bg] of pills(scope)) {
          expect(contrast(ink, bg), `${tone}, ${name}, ${surface}`).toBeGreaterThanOrEqual(TEXT);
        }
      }
    }
  });

  it('the close icon is ≥ 3:1, and its hover is the text colour', () => {
    expect(declaration(pill, '.ep-toast ion-button.ep-toast__close', '--color')).toBe('var(--ep-toast-muted)');
    expect(declaration(pill, '.ep-toast ion-button.ep-toast__close', '--color-hover')).toBe('var(--ep-toast-text)');
    for (const { name, scope } of scopes) {
      const ink = colour('var(--ep-toast-muted)', scope);
      for (const [surface, bg] of pills(scope)) {
        expect(contrast(ink, bg), `${name}, ${surface}`).toBeGreaterThanOrEqual(GRAPHIC);
      }
    }
  });
});
