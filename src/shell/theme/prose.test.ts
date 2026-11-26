// CSS is not applied under happy-dom, so these read the rules of prose.css themselves. The page that shows it is the
// Hub's e2e of a guide with its steps and its limits.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { selectorsOf, themeSheet, valueOf } from './__tests__/sheetRules';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = themeSheet('prose.css');
const PROSE = '.ep-prose';

describe('prose.css: the lists of a running text', () => {
  it('styles only the lists inside a running text', () => {
    const selectors = selectorsOf(css);
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.filter((selector) => !selector.startsWith(`${PROSE} `))).toEqual([]);
  });

  it('numbers an ordered list and bullets the others, the markers Tailwind’s preflight takes away', () => {
    expect(valueOf(css, `${PROSE} ol`, 'list-style')).toBe('decimal');
    expect(valueOf(css, `${PROSE} ul`, 'list-style')).toBe('disc');
  });

  it('indents both, so the marker sits outside the text', () => {
    expect(valueOf(css, `${PROSE} ol`, 'padding-inline-start')).toBe('1.5rem');
    expect(valueOf(css, `${PROSE} ul`, 'padding-inline-start')).toBe('1.5rem');
  });

  // Preflight lives in the `base` layer: a rule outside any layer beats it whatever its order.
  it('is outside any layer, so it wins over preflight', () => {
    expect(css).not.toMatch(/@layer/);
  });

  it('neither reads nor styles anything of OutfitKit', () => {
    const raw = readFileSync(join(HERE, 'prose.css'), 'utf8');
    expect(css).not.toMatch(/--ok-/);
    expect(css).not.toMatch(/(^|[\s,>+~}])ok-[a-z]|\.ok-[a-z]/m);
    expect(raw).not.toMatch(/data-ok-/);
  });

  it('is loaded by the shell with the rest of the theme', () => {
    const shell = readFileSync(join(HERE, '..', 'createShell.ts'), 'utf8');
    expect(shell).toContain("import './theme/prose.css';");
  });
});
