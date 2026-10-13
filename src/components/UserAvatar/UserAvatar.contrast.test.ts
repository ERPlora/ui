// Contrast of the UserAvatar tones (working rules §2.4): the initials are small text, so they must
// reach WCAG AA (4.5:1) against the avatar's tint, on every surface an avatar sits on (the sidebar
// on the page canvas, a card, a list row and, in dark, a dialog), in light and dark, with the
// shell's theme and every optional palette, read from the real stylesheets.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  BLACK,
  blocks,
  colour,
  componentCss,
  contrast,
  mix,
  percent,
  surfacesOf,
  themes,
  vars,
  type Vars,
  WHITE,
} from '../__tests__/themeContrast';
import { USER_AVATAR_TONES } from './avatar';

const css = componentCss(join(dirname(fileURLToPath(import.meta.url)), 'UserAvatar.vue'));
const BASE = vars(css, '.user-avatar');
const toneVars = (tone: string): Vars => ({ ...BASE, ...vars(css, `.user-avatar[data-tone='${tone}']`) });

describe('UserAvatar colours', () => {
  it('derive from one tone per avatar: the tint is the tone over the surface, the initials the tone darkened (light) or lightened (dark)', () => {
    const base = blocks(css, '.user-avatar').join(';');
    expect(base).toMatch(/background:\s*color-mix\(in srgb, var\(--user-avatar-tone\) var\(--user-avatar-wash\), transparent\)/);
    expect(base).toMatch(/color:\s*color-mix\(in srgb, var\(--user-avatar-tone\) var\(--user-avatar-ink\), black\)/);
    const dark = blocks(css, ':root.ion-palette-dark .user-avatar').join(';');
    expect(dark).toMatch(/color:\s*color-mix\(in srgb, var\(--user-avatar-tone\) var\(--user-avatar-ink-dark\), white\)/);
  });

  it('every tone reads an Ionic colour of the theme through our --ep-* token (brand = primary, as in the mockups)', () => {
    const expected = { brand: 'primary', green: 'success', violet: 'secondary', amber: 'warning' } as const;
    expect(USER_AVATAR_TONES.length).toBe(Object.keys(expected).length);
    for (const tone of USER_AVATAR_TONES) {
      expect(toneVars(tone)['--user-avatar-tone'], tone).toMatch(
        new RegExp(`^var\\(--ep-${expected[tone]}, var\\(--ion-color-${expected[tone]}, #[0-9a-f]{6}\\)\\)$`, 'i'),
      );
    }
  });

  for (const theme of themes()) {
    it(`initials reach AA (4.5:1) on their tint, every tone and surface — ${theme.name}`, () => {
      const failures: string[] = [];
      for (const tone of USER_AVATAR_TONES) {
        const own = toneVars(tone);
        const scope = { ...theme.scope, ...own };
        const toneRgb = colour('var(--user-avatar-tone)', scope);
        const ink = theme.dark
          ? mix(toneRgb, WHITE, percent(own['--user-avatar-ink-dark']))
          : mix(toneRgb, BLACK, percent(own['--user-avatar-ink']));
        for (const surface of surfacesOf(theme)) {
          const tint = mix(toneRgb, colour(`var(${surface})`, scope), percent(own['--user-avatar-wash']));
          const ratio = contrast(ink, tint);
          if (ratio < 4.5) failures.push(`${tone} on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }
});
