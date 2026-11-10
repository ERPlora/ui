import { readFileSync } from 'node:fs';
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
