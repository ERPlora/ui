// The colours of data: six series (--ep-data-1 to --ep-data-6) shared by the figure card and the charts, declared with
// the other tokens in variables.css. CSS is not applied under happy-dom, so these read the sheets themselves and measure
// every series the way the browser paints it, in light and dark, with the brand theme, its «AA» contrast setting and
// every optional palette.
import { describe, expect, it } from 'vitest';

import {
  blocks,
  colour,
  contrast,
  mix,
  percent,
  PALETTE_IDS,
  type Rgb,
  themes,
  vars,
  type Vars,
} from '../../components/__tests__/themeContrast';
import { themeSheet, valueOf } from './__tests__/sheetRules';

const variables = themeSheet('variables.css');
const palettes = themeSheet('palettes.css');
const card = themeSheet('stat-card.css');

const SERIES = [1, 2, 3, 4, 5, 6] as const;
const FIXED = [2, 3, 4, 5, 6] as const;
/** Points measured along each gradient: its two ends and the colours in between. */
const STEPS = 20;

/** The colours a gradient from `from` to `to` paints, ends included (sRGB interpolation, the CSS default). */
const along = (from: Rgb, to: Rgb): Rgb[] =>
  Array.from({ length: STEPS + 1 }, (_, step) => mix(to, from, step / STEPS));

/** The lowest contrast of `ink` over a series' gradient, with `wash` of `ink` laid over it first (the icon tile). */
function lowest(scope: Vars, series: number, ink: Rgb, wash = 0): number {
  const from = colour(`var(--ep-data-${series}-from)`, scope);
  const to = colour(`var(--ep-data-${series}-to)`, scope);
  return Math.min(...along(from, to).map((under) => contrast(ink, mix(ink, under, wash))));
}

/** The series of `ratios` under `floor`, written for the failure message. */
const under = (ratios: (readonly [number, number])[], floor: number): string[] =>
  ratios.filter(([, ratio]) => ratio < floor).map(([series, ratio]) => `series ${series}: ${ratio.toFixed(2)}:1`);

describe('colours of data (--ep-data-*)', () => {
  it('series 1 is the primary of the business palette; series 2 to 6 are fixed in light and in dark', () => {
    const light = vars(variables, ':root');
    const dark = vars(variables, ':root.ion-palette-dark');
    expect(light['--ep-data-1']).toBe('var(--ion-color-primary)');
    for (const series of FIXED) {
      expect(light[`--ep-data-${series}`], `light ${series}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(dark[`--ep-data-${series}`], `dark ${series}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(dark[`--ep-data-${series}`], `dark ${series}`).not.toBe(light[`--ep-data-${series}`]);
    }
    expect(dark['--ep-data-1'], 'dark follows the palette instead').toBeUndefined();
  });

  it('series 1 darkens the primary into its gradient ends, so it follows any palette', () => {
    const light = vars(variables, ':root');
    for (const end of ['from', 'to']) {
      expect(light[`--ep-data-1-${end}`]).toMatch(/^color-mix\(in srgb, var\(--ep-data-1\) \d+%, #[0-9a-f]{6}\)$/i);
    }
  });

  it('no palette changes series 2 to 6: a measure reads the same colour in every business', () => {
    // A palette may use a series (`var(--ep-data-4)`); it may not declare one.
    for (const id of PALETTE_IDS) {
      for (const selector of [`:root[data-ep-palette='${id}']`, `:root.ion-palette-dark[data-ep-palette='${id}']`]) {
        expect(blocks(palettes, selector).join(';'), selector).not.toMatch(/--ep-data-[2-6][\w-]*\s*:/);
      }
    }
  });

  it.each(SERIES)('series %i paints its gradient from its own ends', (series) => {
    expect(vars(variables, ':root')[`--ep-data-${series}-gradient`]).toBe(
      `linear-gradient(135deg, var(--ep-data-${series}-from), var(--ep-data-${series}-to))`,
    );
  });

  it('text and icons on a gradient are one colour, white', () => {
    expect(vars(variables, ':root')['--ep-data-on-gradient']).toBe('#ffffff');
  });

  it('measures every theme: the brand, its AA setting and every optional palette, in light and dark', () => {
    expect(themes().length).toBeGreaterThanOrEqual(2 * (PALETTE_IDS.length + 2));
  });

  for (const { name, scope } of themes()) {
    it(`white text reads AA (4.5:1) along every gradient — ${name}`, () => {
      const ink = colour('var(--ep-data-on-gradient)', scope);
      const failures = under(SERIES.map((series) => [series, lowest(scope, series, ink)] as const), 4.5);
      expect(failures, failures.join('; ')).toEqual([]);
    });

    it(`a white icon on its tile reads 3:1 over every gradient — ${name}`, () => {
      const ink = colour('var(--ep-data-on-gradient)', scope);
      const tile = valueOf(card, '.ep-stat-card--live .ep-stat-card__icon', 'background');
      const match = /^color-mix\(in srgb, var\(--ep-data-on-gradient\) (\d+%), transparent\)$/.exec(tile ?? '');
      expect(match, `tile background: ${tile}`).not.toBeNull();
      const wash = percent(match![1]);
      const failures = under(SERIES.map((series) => [series, lowest(scope, series, ink, wash)] as const), 3);
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }
});
