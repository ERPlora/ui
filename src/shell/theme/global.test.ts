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
});

describe('global.css: the icon of a button keeps its gap to the label (FIX-UI-CONFIRMDIALOG-ICON-GAP)', () => {
  // Preflight's `* { margin: 0 }` is a document rule too, and it beats ion-button's
  // `::slotted(ion-icon[slot=start|end])` margins: «⊘Deactivate», the icon against the word.
  it('an ion-icon in a start or end slot of an ion-button gets Ionic’s slotted margins back', () => {
    expect(baseRule('ion-button > ion-icon:is([slot="start"], [slot="end"])')).toBe('margin: revert-layer;');
  });

  // Ionic gives a spinner no slotted margin: in the icon's place while a command runs, it takes the icon's,
  // which is 0.3em (end: 0.2em) of the icon, an icon being 1.35em of its button.
  it('an ion-spinner in the start slot of an ion-button sits where Ionic puts a start icon', () => {
    expect(baseRule('ion-button > ion-spinner[slot="start"]')).toBe('margin-inline: calc(-0.3em * 1.35) calc(0.3em * 1.35);');
  });

  it('an ion-spinner in the end slot of an ion-button sits where Ionic puts an end icon', () => {
    expect(baseRule('ion-button > ion-spinner[slot="end"]')).toBe('margin-inline: calc(0.3em * 1.35) calc(-0.2em * 1.35);');
  });
});
