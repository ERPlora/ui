import ionSet from '@iconify-json/ion/icons.json';
import { describe, expect, it } from 'vitest';

import { buildIconSvg, type IconifyJSON, ICON_SETS, iconRegistry, resolveIcon, resolveIconAsync } from './icons';

const ion = ionSet as unknown as IconifyJSON;

describe('iconRegistry', () => {
  const registry = iconRegistry();

  it('has the icons the shell, topbar, menu and demo use', () => {
    for (const name of [
      'menu-outline',
      'home-outline',
      'cart-outline',
      'sunny-outline',
      'moon-outline',
      'log-out-outline',
      'chevron-forward',
      'backspace-outline',
      'cloud-offline-outline',
    ]) {
      expect(registry, name).toHaveProperty(name);
    }
  });

  it('guardrail: every name exists in @iconify-json/ion and the baked SVG is current', () => {
    const names = Object.keys(registry);
    expect(names.length).toBeGreaterThan(40);
    for (const name of names) {
      const fresh = buildIconSvg(ion, name);
      expect(fresh, `ion:${name} does not exist in @iconify-json/ion`).toBeDefined();
      expect(registry[name], `ion:${name} baked SVG is stale; regenerate the table in icons.ts`).toBe(fresh);
    }
  });

  it('returns SVG that sizes like ion-icon (1em, currentColor)', () => {
    for (const svg of Object.values(registry)) {
      expect(svg).toMatch(/^<svg /);
      expect(svg).toContain('width="1em"');
      expect(svg).toContain('height="1em"');
      expect(svg).toContain('fill="currentColor"');
    }
  });

  it('returns a copy, so callers cannot mutate the table', () => {
    iconRegistry()['add'] = 'x';
    expect(iconRegistry()['add']).toMatch(/^<svg /);
  });
});

describe('resolveIcon', () => {
  it('resolves baked ion icons synchronously, with or without prefix', () => {
    expect(resolveIcon('ion:cart-outline')).toBe(iconRegistry()['cart-outline']);
    expect(resolveIcon('cart-outline')).toBe(iconRegistry()['cart-outline']);
  });

  it('returns undefined for an unknown prefix or an unknown icon', () => {
    expect(resolveIcon('nope:cart')).toBeUndefined();
    expect(resolveIcon('ion:definitely-not-an-icon')).toBeUndefined();
    expect(resolveIcon('')).toBeUndefined();
  });

  it('knows the wired sets', () => {
    expect(Object.keys(ICON_SETS).sort()).toEqual(['ion', 'material-symbols', 'mdi']);
  });
});

describe('resolveIconAsync (lazy sets)', () => {
  it('loads material-symbols and mdi on demand, then resolveIcon answers synchronously', async () => {
    expect(await resolveIconAsync('material-symbols:point-of-sale')).toMatch(/^<svg /);
    expect(await resolveIconAsync('mdi:cart')).toMatch(/^<svg /);
    expect(resolveIcon('material-symbols:point-of-sale')).toMatch(/^<svg /);
    expect(resolveIcon('mdi:cart')).toContain('width="1em"');
  });

  it('loads an ion icon that is not baked', async () => {
    expect(await resolveIconAsync('ion:airplane')).toMatch(/^<svg /);
  });

  it('undefined for unknown prefix or icon', async () => {
    expect(await resolveIconAsync('nope:cart')).toBeUndefined();
    expect(await resolveIconAsync('mdi:definitely-not-an-icon')).toBeUndefined();
  });
});
