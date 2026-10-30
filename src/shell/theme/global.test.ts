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
  it('ion-title in md keeps its side padding (hub#2314)', () => {
    expect(baseRule('ion-title.md')).toBe('padding: revert-layer;');
  });

  it('ion-badge keeps its pill padding (PoC issue D: «Open»/«Done» measured 30.8 × 11.5 px, padding 0)', () => {
    expect(baseRule('ion-badge')).toBe('padding: revert-layer;');
  });

  // Only the sides: Ionic's 6px on top and below made a chip with its 40px remove button 52px tall (40px on main),
  // while a chip of text is Ionic's 32px `min-height` either way. Preflight's `margin: 0` keeps Ionic's 4px chip
  // margin off, as each row of chips sets its gap.
  it('ion-chip keeps its side padding, and only that (FIX-UI-SHELL-ION-CHIP-PADDING-WIPED-BY-PREFLIGHT: measured 0px, text against the edge)', () => {
    expect(baseRule('ion-chip')).toBe('padding-inline: revert-layer;');
  });

  // Preflight's `* { margin: 0 }` beats ion-chip's `::slotted(ion-icon:first-child|last-child)` margins too: «⚠Not
  // configured», the icon against the word (`margin-inline-end` measured 0px). The whole margin comes back to the chip's
  // own icon, so Ionic's `:first-child`/`:last-child` picks the side of the 8px gap and the 4px pull toward the edge. Only a
  // child: an icon inside the chip's remove button (an ion-button) is not the chip's.
  it('an ion-icon child of an ion-chip keeps Ionic’s whole margin (FIX-UI-SHELL-ION-CHIP-ICON-MARGIN-WIPED-BY-PREFLIGHT: measured 0px, icon against the text)', () => {
    expect(baseRule('ion-chip > ion-icon')).toBe('margin: revert-layer;');
  });
});

/** Selectors of the `base` layer's rules that start with `prefix`, whitespace-normalised, in file order. */
function baseSelectors(prefix: string): string[] {
  return [...baseLayer().matchAll(/(?:^|[}])\s*([^{}]+?)\s*\{/g)]
    .map((m) => m[1].replace(/\s+/g, ' ').trim())
    .filter((selector) => selector.startsWith(prefix));
}

describe('global.css: the icon of a button keeps its gap to the label (FIX-UI-CONFIRMDIALOG-ICON-GAP)', () => {
  // Preflight's `* { margin: 0 }` is a document rule too, and it beats ion-button's
  // `::slotted(ion-icon[slot=start|end])` margins: «⊘Deactivate», the icon against the word. Only the side
  // of the gap comes back: the outer side stays 0, as the SaaS's own rules (`margin-inline-end` only) expect.
  it('an ion-icon in the start slot of an ion-button gets back Ionic’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-icon[slot="start"]')).toBe('margin-inline-end: revert-layer;');
  });

  it('an ion-icon in the end slot of an ion-button gets back Ionic’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-icon[slot="end"]')).toBe('margin-inline-start: revert-layer;');
  });

  // Ionic gives a spinner no slotted margin: in the icon's place while a command runs, it takes the icon's
  // gap, 0.3em of the icon, an icon being 1.35em of its button.
  it('an ion-spinner in the start slot of an ion-button keeps the icon’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-spinner[slot="start"]')).toBe('margin-inline-end: calc(0.3em * 1.35);');
  });

  it('an ion-spinner in the end slot of an ion-button keeps the icon’s gap to its label, and only that', () => {
    expect(baseRule('ion-button > ion-spinner[slot="end"]')).toBe('margin-inline-start: calc(0.3em * 1.35);');
  });

  // saas#54: a `margin: revert-layer` (or any rule on the outer side) pulled every SaaS icon 4.5–5.3 px into
  // the button's padding. These four are the only rules of the layer on what an ion-button holds.
  it('no other base rule touches what an ion-button holds', () => {
    expect(baseSelectors('ion-button')).toEqual([
      'ion-button > ion-icon[slot="start"]',
      'ion-button > ion-icon[slot="end"]',
      'ion-button > ion-spinner[slot="start"]',
      'ion-button > ion-spinner[slot="end"]',
    ]);
  });
});
