// Every text of an inline notice (the tone-coloured icon and actions, the heading, the body and the close button)
// must reach WCAG AA (4.5:1) against the notice's own tint on every surface it sits on, in light and dark, with the
// shell's theme and every optional palette, read from the real stylesheets.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  colour,
  componentCss,
  contrast,
  declaration,
  mix,
  percent,
  resolved,
  surfacesOf,
  themes,
  vars,
  type Vars,
} from '../__tests__/themeContrast';
import type { InlineFeedbackTone } from './InlineFeedback.vue';

const css = componentCss(join(dirname(fileURLToPath(import.meta.url)), 'InlineFeedback.vue'));
const BASE = vars(css, '.inline-feedback');
const toneVars = (tone: string): Vars => ({ ...BASE, ...vars(css, `.inline-feedback[data-tone='${tone}']`) });

const TONES: InlineFeedbackTone[] = ['info', 'success', 'warning', 'danger', 'neutral'];
/** Each text colour of the notice: the icon and the actions, the heading and plain body, the body under a heading. */
const INKS = { 'tone text': 'var(--tone-text)', text: 'var(--color)', 'secondary text': 'var(--color-secondary)' };

describe('InlineFeedback colours', () => {
  it('paint the box with the tone tint washed over the surface, and the texts with the colours measured below', () => {
    expect(declaration(css, '.box', 'background')).toBe(
      'color-mix(in srgb, var(--tone-tint) var(--background-opacity), transparent)',
    );
    expect(declaration(css, '.box', 'color')).toBe('var(--color)');
    expect(declaration(css, '.icon', 'color')).toBe('var(--tone-text)');
    expect(declaration(css, '.heading + .body', 'color')).toBe('var(--color-secondary)');
    expect(declaration(css, '.close', 'color')).toBe('var(--color-secondary)');
  });

  for (const theme of themes()) {
    it(`every text reaches AA (4.5:1) on its tint, every tone and surface — ${theme.name}`, () => {
      const failures: string[] = [];
      for (const tone of TONES) {
        const scope = { ...theme.scope, ...toneVars(tone) };
        const amount = percent(resolved('var(--background-opacity)', scope));
        for (const surface of surfacesOf(theme)) {
          const tint = mix(colour('var(--tone-tint)', scope), colour(`var(${surface})`, scope), amount);
          for (const [ink, value] of Object.entries(INKS)) {
            const ratio = contrast(colour(value, scope), tint);
            if (ratio < 4.5) failures.push(`${tone} ${ink} on ${surface}: ${ratio.toFixed(2)}:1`);
          }
        }
      }
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }
});
