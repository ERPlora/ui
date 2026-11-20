import { describe, expect, it } from 'vitest';

import { resolveIcon } from './icons';
import { SET_ICONS, svgUrl } from './set-icons';

describe('svgUrl', () => {
  it('wraps the raw SVG in the data URL format of ionicons, which ion-icon parses inline', () => {
    expect(svgUrl('<svg viewBox="0 0 1 1"/>')).toBe('data:image/svg+xml;utf8,<svg viewBox="0 0 1 1"/>');
  });
});

describe('SET_ICONS', () => {
  it('are the baked icons of the other Iconify sets, frozen and resolved by their full set:name', () => {
    expect(Object.isFrozen(SET_ICONS)).toBe(true);
    expect(Object.keys(SET_ICONS)).toEqual(
      expect.arrayContaining(['lucide:panel-left', 'mdi:cart', 'material-symbols:point-of-sale']),
    );
    for (const [name, src] of Object.entries(SET_ICONS)) {
      expect(name).toMatch(/^(?:lucide|mdi|material-symbols):[a-z0-9-]+$/);
      expect(src, name).toMatch(/^data:image\/svg\+xml;utf8,<svg /);
      expect(resolveIcon(name), name).toBe(src);
    }
  });
});
