// The row is small text (0.75rem), so it must reach WCAG AA (4.5:1) on every surface it sits on, in light and dark,
// with the shell's theme and every optional palette, read from the real stylesheets.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { colour, componentCss, contrast, declaration, surfacesOf, themes } from '../__tests__/themeContrast';

const css = componentCss(join(dirname(fileURLToPath(import.meta.url)), 'AllergenRow.vue'));
const ink = declaration(css, '.allergen-row', 'color') ?? '';

describe('AllergenRow colours', () => {
  it('paints its text with a theme colour', () => {
    expect(ink).toMatch(/^var\(--/);
  });

  for (const theme of themes()) {
    it(`reaches AA (4.5:1) on every surface — ${theme.name}`, () => {
      const failures = surfacesOf(theme).flatMap((surface) => {
        const ratio = contrast(colour(ink, theme.scope), colour(`var(${surface})`, theme.scope));
        return ratio < 4.5 ? [`${surface}: ${ratio.toFixed(2)}:1`] : [];
      });
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }
});
