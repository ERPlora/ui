// The shell's global stylesheet (`global.css`). CSS is not applied under happy-dom, so these read
// the rules themselves. Tailwind's own sources (`@import … source(none)`, `@source`) are covered by
// `src/vite.test.ts`, with a real build.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'global.css'), 'utf8');

/** Bodies of the top-level `@layer base { … }` blocks (one level of nesting), comments removed. */
function baseLayer(): string {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...plain.matchAll(/@layer base\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)].map((m) => m[1]).join('\n');
}

/** Declarations of `selector` inside the `base` layer, whitespace-normalised. */
function baseRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(baseLayer())?.[1] ?? '';
  return body.replace(/\s+/g, ' ').trim();
}

describe('global.css: Ionic hosts Tailwind’s preflight must not reset', () => {
  // Preflight's `* { padding: 0 }` (layer `base`) is a document rule, and a document rule always
  // beats a shadow `:host` rule. `revert-layer` in the SAME layer drops the reset for that host.
  it('ion-title in md keeps its side padding', () => {
    expect(baseRule('ion-title.md')).toBe('padding: revert-layer;');
  });

  it('ion-badge keeps its pill padding', () => {
    expect(baseRule('ion-badge')).toBe('padding: revert-layer;');
  });

  it('ion-chip keeps its side padding, and only that', () => {
    expect(baseRule('ion-chip')).toBe('padding-inline: revert-layer;');
  });

  it('an ion-icon child of an ion-chip keeps Ionic’s whole margin', () => {
    expect(baseRule('ion-chip > ion-icon')).toBe('margin: revert-layer;');
  });
});

/** Selectors of the `base` layer's rules that start with `prefix`, whitespace-normalised, in file order. */
function baseSelectors(prefix: string): string[] {
  return [...baseLayer().matchAll(/(?:^|[}])\s*([^{}]+?)\s*\{/g)]
    .map((m) => m[1].replace(/\s+/g, ' ').trim())
    .filter((selector) => selector.startsWith(prefix));
}

describe('global.css: the icon of a button keeps its gap to the label', () => {
  it('an ion-icon in the start slot of an ion-button gets back Ionic’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-icon[slot="start"]')).toBe('margin-inline-end: revert-layer;');
  });

  it('an ion-icon in the end slot of an ion-button gets back Ionic’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-icon[slot="end"]')).toBe('margin-inline-start: revert-layer;');
  });

  it('an ion-spinner in the start slot of an ion-button keeps the icon’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-spinner[slot="start"]')).toBe('margin-inline-end: calc(0.3em * 1.35);');
  });

  it('an ion-spinner in the end slot of an ion-button keeps the icon’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-spinner[slot="end"]')).toBe('margin-inline-start: calc(0.3em * 1.35);');
  });

  // A `margin: revert-layer`, or any rule on the outer side, would pull every SaaS icon 4.5–5.3 px into the button's
  // padding, so these four are the only rules of the layer on what an ion-button holds.
  it('no other base rule touches what an ion-button holds', () => {
    expect(baseSelectors('ion-button')).toEqual([
      'ion-button > ion-icon[slot="start"]',
      'ion-button > ion-icon[slot="end"]',
      'ion-button > ion-spinner[slot="start"]',
      'ion-button > ion-spinner[slot="end"]',
    ]);
  });
});
