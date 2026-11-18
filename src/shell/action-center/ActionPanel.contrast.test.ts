import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  colour,
  componentCss,
  contrast,
  mix,
  percent,
  plain,
  resolved,
  surfacesOf,
  themes,
  vars,
  type Rgb,
  type Vars,
} from '../../components/__tests__/themeContrast';

const HERE = dirname(fileURLToPath(import.meta.url));
const glass = plain(readFileSync(join(HERE, '../theme/glass.css'), 'utf8'));
const TEXT = 4.5;
const INKS = ['--ion-text-color', '--ep-glass-muted', '--ep-primary-text', '--ep-warning-text', '--ep-danger-text'];

function scopes(): Array<{ name: string; scope: Vars; theme: ReturnType<typeof themes>[number] }> {
  return themes().map((theme) => ({
    name: theme.name,
    scope: { ...theme.scope, ...vars(glass, ':root'), ...(theme.dark ? vars(glass, ':root.ion-palette-dark') : {}) },
    theme,
  }));
}

function surfaces(scope: Vars, theme: ReturnType<typeof themes>[number]): Array<[string, Rgb]> {
  const card = colour('var(--ion-card-background)', scope);
  const amount = percent(resolved('var(--ep-glass-opacity)', scope));
  return [
    ...surfacesOf(theme).map((name): [string, Rgb] => [`glass on ${name}`, mix(card, colour(`var(${name})`, scope), amount)]),
    ['opaque', colour(vars(glass, ':root.ep-opaque')['--ep-glass-bg'], scope)],
  ];
}

describe('action center contrast', () => {
  it('keeps text and severity accents at AA on glass and opaque surfaces in every theme', () => {
    const failures: string[] = [];
    for (const { name, scope, theme } of scopes()) {
      for (const [surface, background] of surfaces(scope, theme)) {
        for (const token of INKS) {
          const ratio = contrast(colour(`var(${token})`, scope), background);
          if (ratio < TEXT) failures.push(`${name}, ${token}, ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures, failures.join('; ')).toEqual([]);
  });

  it('keeps the primary action label at AA on its own accent in every theme', () => {
    for (const { name, scope } of scopes()) {
      const ratio = contrast(colour('var(--ep-action-text)', scope), colour('var(--ep-action-bg)', scope));
      expect(ratio, name).toBeGreaterThanOrEqual(TEXT);
    }
  });
});

describe('action center type sizes', () => {
  const SMALLEST_TEXT_PX = 11;
  const COMPONENTS = ['ActionArrival', 'ActionBell', 'ActionFeatured', 'ActionPanel', 'ActionRow'];

  it(`sets no text smaller than ${SMALLEST_TEXT_PX}px, so every label stays legible on a phone`, () => {
    const tiny = COMPONENTS.flatMap((name) =>
      [...componentCss(join(HERE, `${name}.vue`)).matchAll(/font-size:\s*([\d.]+)px/g)]
        .filter(([, px]) => Number(px) < SMALLEST_TEXT_PX)
        .map(([found]) => `${name}: ${found}`),
    );
    expect(tiny).toEqual([]);
  });
});
