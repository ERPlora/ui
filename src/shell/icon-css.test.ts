import { describe, expect, it } from 'vitest';

import { ICON_CLASS, ICON_COLORS, ICON_CSS } from './icon-css';

describe('ICON_CSS', () => {
  it('sizes the box like ion-icon: 1em, currentColor fill, content-box', () => {
    const base = ICON_CSS.slice(ICON_CSS.indexOf(`.${ICON_CLASS} {`));
    for (const rule of [
      'display: inline-block',
      'width: 1em',
      'height: 1em',
      'font-size: 1em',
      'contain: layout style',
      'fill: currentColor',
      'box-sizing: content-box !important',
    ]) {
      expect(base).toContain(rule);
    }
  });

  it('makes the inner svg fill the box', () => {
    expect(ICON_CSS).toMatch(/\.hub-icon > svg\s*{[^}]*width: 100%[^}]*height: 100%/);
  });

  it('hooks --ion-color-* the way ion-icon does', () => {
    expect(ICON_CSS).toContain('.hub-icon.ion-color {\n  color: var(--ion-color-base) !important;');
    for (const color of ICON_COLORS) {
      expect(ICON_CSS).toContain(`.hub-icon.ion-color-${color} { --ion-color-base: var(--ion-color-${color}`);
    }
    expect(ICON_COLORS).toEqual([
      'primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'light', 'medium', 'dark',
    ]);
  });

  it('mirrors the ion-button slot rules for icons (ios mode, the shell default)', () => {
    expect(ICON_CSS).toContain('ion-button .hub-icon[slot="start"]');
    expect(ICON_CSS).toContain('ion-button .hub-icon[slot="end"]');
    expect(ICON_CSS).toContain('ion-button .hub-icon[slot="icon-only"]');
    expect(ICON_CSS).toContain('font-size: clamp(15.12px, 1.125em, 43.02px)');
  });
});
