import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { BRAND_PALETTES } from './brandbook';
import { THEME_PALETTES } from './theme';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const plain = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

function mediaBlock(css: string, query: string): string {
  const start = css.indexOf(`@media (${query})`);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  return '';
}

describe('ERPlora brandbook', () => {
  it('is the catalogue behind the seven theme choices', () => {
    expect(BRAND_PALETTES.map((palette) => palette.id)).toEqual(THEME_PALETTES);
    expect(BRAND_PALETTES).toHaveLength(7);
  });

  it.each(BRAND_PALETTES)('$id documents its exact light and dark brand colours', (palette) => {
    const variables = plain(read('src/shell/theme/variables.css'));
    const palettes = plain(read('src/shell/theme/palettes.css'));
    const light = palette.id === 'erplora'
      ? block(variables, ':root')
      : block(palettes, `:root[data-ep-palette='${palette.id}']`);
    const dark = palette.id === 'erplora'
      ? block(variables, ':root.ion-palette-dark')
      : block(palettes, `:root.ion-palette-dark[data-ep-palette='${palette.id}']`);
    for (const [body, mode] of [[light, palette.light], [dark, palette.dark]] as const) {
      expect(body).toContain(`--ion-color-primary: ${mode.primary};`);
      expect(body).toContain(`--ion-background-color: ${mode.canvas};`);
      expect(body).toContain(`--ion-text-color: ${mode.ink};`);
    }
    const guide = read('docs/BRANDBOOK.md');
    expect(guide).toContain(`\`${palette.id}\``);
    expect(guide.toLowerCase()).toContain(palette.light.primary.toLowerCase());
    expect(guide.toLowerCase()).toContain(palette.dark.primary.toLowerCase());
  });

  it('ships a visual guide and shared Ionic primitives without page-specific selectors', () => {
    const page = read('docs/brandbook.html');
    const primitives = plain(read('src/shell/theme/brand.css'));
    expect(page).toContain('../src/shell/theme/brand.css');
    for (const selector of ['ion-card', 'ion-button', 'ion-badge', '.ep-surface', '.ep-icon-tile']) {
      expect(primitives).toContain(selector);
    }
    expect(primitives).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(primitives).not.toMatch(/\.home-|\.pos-|\.widget|\.data-card|\.settings-card/);
  });

  it('shows the figure card with the real sheets: both variants, the six data tones and its three states', () => {
    const page = read('docs/brandbook.html');
    const sheets = [...page.matchAll(/href="\.\.\/src\/shell\/theme\/([\w-]+)\.css"/g)].map((m) => m[1]);
    expect(sheets.indexOf('stat-card')).toBeGreaterThan(sheets.indexOf('brand'));
    const cards = [...page.matchAll(/<(?:article|a)\b[^>]*class="[^"]*\bep-stat-card\b[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(cards.some((card) => card.includes('ep-stat-card--live'))).toBe(true);
    expect(cards.some((card) => card.includes('ep-stat-card--soft'))).toBe(true);
    for (const tone of ['1', '2', '3', '4', '5', '6']) {
      expect(cards.some((card) => card.includes(`data-tone="${tone}"`)), `tone ${tone}`).toBe(true);
    }
    for (const state of ['loading', 'empty', 'error']) {
      expect(cards.some((card) => card.includes(`data-state="${state}"`)), state).toBe(true);
    }
  });

  it('uses only classes of the figure card that its sheet and its component define', () => {
    const page = read('docs/brandbook.html');
    const sheet = read('src/shell/theme/stat-card.css');
    const component = read('src/components/StatCard/StatCard.vue');
    const used = new Set([...page.matchAll(/\bep-stat-(?:card|grid)[\w-]*/g)].map((m) => m[0]));
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) {
      // The soft variant is the card's own look: its marker has no rule of its own.
      if (name !== 'ep-stat-card--soft') expect(sheet, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
      if (name !== 'ep-stat-grid') expect(component, name).toContain(name);
    }
  });

  it('draws the sparkline in a lively and in a soft figure card', () => {
    const page = read('docs/brandbook.html');
    const cards = [...page.matchAll(/<(article|a)\b[^>]*class="[^"]*\bep-stat-card\b[^"]*"[^>]*>[\s\S]*?<\/\1>/g)].map((m) => m[0]);
    const sparked = cards.filter((card) => /<svg class="ep-stat-card__spark"[^>]*>\s*<polyline points="[\d., ]+"/.test(card));
    expect(sparked.some((card) => card.includes('ep-stat-card--live'))).toBe(true);
    expect(sparked.some((card) => card.includes('ep-stat-card--soft'))).toBe(true);
  });

  it('shows the charts with their real sheet: bars and a line with two series and their legend, a bar list and its states', () => {
    const page = read('docs/brandbook.html');
    const sheets = [...page.matchAll(/href="\.\.\/src\/shell\/theme\/([\w-]+)\.css"/g)].map((m) => m[1]);
    expect(sheets.indexOf('charts')).toBeGreaterThan(sheets.indexOf('stat-card'));
    const figures = [...page.matchAll(/<figure\b[^>]*class="ep-chart"[^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    const ready = (kind: string) => figures.filter((f) => f.includes(`data-kind="${kind}"`) && f.includes('data-state="ready"'));
    for (const kind of ['bars', 'line']) {
      const [figure] = ready(kind);
      expect(figure, kind).toBeDefined();
      expect([...figure.matchAll(/class="ep-chart__key"/g)], `${kind} legend`).toHaveLength(2);
      expect(figure, `${kind} table`).toMatch(/<div class="ep-chart__table"><table>\s*<caption>/);
      expect(figure, `${kind} caption`).toContain('<figcaption class="ep-chart__caption">');
    }
    expect(ready('list')).toHaveLength(1);
    for (const state of ['loading', 'empty', 'error']) {
      expect(figures.some((f) => f.includes(`data-state="${state}"`)), state).toBe(true);
    }
  });

  it('uses only classes of the charts that their sheet and their components define', () => {
    const page = read('docs/brandbook.html');
    const sheet = read('src/shell/theme/charts.css');
    const folder = 'src/components/Chart';
    const components = readdirSync(join(ROOT, folder))
      .filter((file) => file.endsWith('.vue'))
      .map((file) => read(`${folder}/${file}`))
      .join('\n');
    const used = new Set([...page.matchAll(/\bep-chart[\w-]*/g)].map((m) => m[0]));
    expect(used.size).toBeGreaterThan(20);
    for (const name of used) {
      // The error is InlineFeedback's own look in the app: the class only names the part.
      if (name !== 'ep-chart__error') expect(sheet, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
      expect(components, name).toContain(name);
    }
  });

  it('sets the button height only on the default size, preserving Ionic small and large', () => {
    const primitives = plain(read('src/shell/theme/brand.css'));
    expect(block(primitives, 'ion-button')).not.toContain('height:');
    expect(block(primitives, 'ion-button:not([size])')).toContain('height: 40px;');
  });

  it('keeps every topbar action at least 44px square', () => {
    const primitives = plain(read('src/shell/theme/brand.css'));
    const topbarButton = block(primitives, '.app-topbar ion-button');
    expect(topbarButton).toContain('min-width: 44px;');
    expect(topbarButton).toContain('min-height: 44px;');
  });

  it('enlarges small buttons only on coarse-pointer devices', () => {
    const primitives = plain(read('src/shell/theme/brand.css'));
    expect(block(primitives, "ion-button[size='small']")).toBe('');
    const coarseButton = block(mediaBlock(primitives, 'pointer: coarse'), "ion-button[size='small']");
    expect(coarseButton).toContain('min-width: 44px;');
    expect(coarseButton).toContain('min-height: 44px;');
  });
});
