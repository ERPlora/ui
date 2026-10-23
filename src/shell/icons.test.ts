// The shell's icon registry (PLAN §16.4): Ionicons from `ionicons/icons`, the other Iconify sets
// baked at build time by `unplugin-icons`; nothing is fetched at runtime. And the guardrail: every
// icon a template or a call of this package names is registered (`scanIcons` of
// `@erplora/ui/testing`; hub and saas run it on their own apps).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { addIcons } from 'ionicons';
import { defineCustomElement as defineIonIcon } from 'ionicons/components/ion-icon.js';
import { addOutline, flaskOutline } from 'ionicons/icons';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DATA_TABLE_ICONS } from '../components/DataTable/model';
import { scanIcons } from '../testing';
import { ION_ICONS, ionIconSrc, resolveIcon } from './icons';

/** The format of ionicons' own icons: `ion-icon` parses it inline (no fetch, CSP-safe). */
const SVG_URL = /^data:image\/svg\+xml;utf8,<svg /;

describe('ION_ICONS (registered with addIcons by createShell)', () => {
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
      // The demo (PoC issue A): its menu icon, «New item», «Back» and the empty state.
      'flask-outline',
      'add-outline',
      'arrow-back-outline',
      'cube-outline',
      // The hub's sidebar (PLAN-MIGRATIONS §16): its entries and the QR on the rail.
      'people-outline',
      'folder-outline',
      'card-outline',
      'storefront-outline',
      'hardware-chip-outline',
      'settings-outline',
      'qr-code-outline',
    ]) {
      expect(ION_ICONS, name).toHaveProperty(name);
    }
  });

  it('covers every icon the DataTable chrome paints', () => {
    for (const name of Object.values(DATA_TABLE_ICONS)) expect(ION_ICONS, name).toHaveProperty(name);
  });

  it('are the data URLs of ionicons/icons themselves, by kebab-case Ionicons name', () => {
    expect(ION_ICONS['add-outline']).toBe(addOutline);
    expect(ION_ICONS['flask-outline']).toBe(flaskOutline);
    expect(Object.keys(ION_ICONS).length).toBeGreaterThanOrEqual(74);
    for (const [name, src] of Object.entries(ION_ICONS)) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(src, name).toMatch(SVG_URL);
    }
  });

  it('cannot be changed by a caller', () => {
    expect(Object.isFrozen(ION_ICONS)).toBe(true);
  });
});

describe('ION_ICONS + ionicons (the real ion-icon, registered with addIcons)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('paints <ion-icon name="flask-outline"> inline, without fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    addIcons(ION_ICONS);
    defineIonIcon();
    const icon = document.createElement('ion-icon');
    icon.setAttribute('name', 'flask-outline');
    document.body.append(icon);
    await vi.waitFor(() => {
      expect(icon.shadowRoot?.querySelector('.icon-inner svg')).not.toBeNull();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('paints a baked icon of another set (lucide) given as the icon property, without fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    defineIonIcon();
    const icon = document.createElement('ion-icon') as HTMLElement & { icon?: string };
    icon.icon = resolveIcon('lucide:panel-left');
    document.body.append(icon);
    await vi.waitFor(() => {
      expect(icon.shadowRoot?.querySelector('.icon-inner svg')).not.toBeNull();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('resolveIcon', () => {
  it('resolves an ion: icon, prefixed or bare, to its Ionicons data URL', () => {
    expect(resolveIcon('ion:cart-outline')).toBe(ION_ICONS['cart-outline']);
    expect(resolveIcon('cart-outline')).toBe(ION_ICONS['cart-outline']);
  });

  it('resolves the other sets to their baked SVG, as the data URL ion-icon parses: 1em box, currentColor', () => {
    for (const name of [
      'lucide:panel-left',
      'lucide:arrow-left',
      'mdi:cart',
      'material-symbols:point-of-sale',
    ]) {
      const src = resolveIcon(name);
      expect(src, name).toMatch(SVG_URL);
      expect(src, name).toContain('width="1em"');
      expect(src, name).toContain('height="1em"');
      expect(src, name).toContain('currentColor');
    }
  });

  it("resolves the lucide icons of the SaaS's sign-in steps (the mailed code of a new account)", () => {
    const src = resolveIcon('lucide:mail-check');
    expect(src).toMatch(SVG_URL);
    expect(src).toContain('currentColor');
  });

  it("resolves the lucide icons of the SaaS panel's menu (saas-next base/navigation.py)", () => {
    for (const name of ['lucide:store', 'lucide:shopping-bag', 'lucide:receipt', 'lucide:circle-user']) {
      const src = resolveIcon(name);
      expect(src, name).toMatch(SVG_URL);
      expect(src, name).toContain('currentColor');
    }
  });

  it("resolves the icons of the Hub's staff app and the account pages (hub-next apps/staff)", () => {
    for (const name of [
      'lucide:user',
      'lucide:sliders-horizontal',
      'lucide:camera',
      'lucide:save',
      'lucide:pencil',
      'lucide:copy',
      'lucide:eye',
      'lucide:user-x',
      'lucide:unlink',
      'lucide:sparkles',
      'lucide:hand',
      'lucide:mail-open',
      'lucide:send',
      'lucide:monitor-down',
      'lucide:layers',
      'lucide:credit-card',
      'lucide:life-buoy',
      'lucide:rotate-ccw',
      'lucide:layout-dashboard',
      'ion:ban-outline',
      'ion:laptop-outline',
      'ion:phone-portrait-outline',
      'ion:key-outline',
      'ion:mail-unread-outline',
      'ion:person-add-outline',
      'ion:person-remove-outline',
      'ion:close-circle-outline',
      'ion:desktop-outline',
      'ion:shield-outline',
    ]) {
      const src = resolveIcon(name);
      expect(src, name).toMatch(SVG_URL);
      if (name.startsWith('ion:')) expect(ION_ICONS, name).toHaveProperty(name.slice(4));
      else expect(src, name).toContain('currentColor');
    }
  });

  it('returns undefined for an unknown set, an unknown icon, a broken name or nothing', () => {
    for (const name of ['nope:cart', 'ion:definitely-not-an-icon', 'mdi:cart-plus', 'constructor', 'ion:', ':cart', '']) {
      expect(resolveIcon(name), name).toBeUndefined();
    }
  });
});

describe('ionIconSrc (value for the `icon` property of ion-icon, any set, no network)', () => {
  it('turns a registered icon of any set into the data URL ion-icon parses without fetching', () => {
    expect(ionIconSrc('mdi:cart')).toBe(resolveIcon('mdi:cart'));
    expect(ionIconSrc('cart-outline')).toBe(ION_ICONS['cart-outline']);
    expect(ionIconSrc('lucide:arrow-left')).toMatch(SVG_URL);
  });

  it('bakes an inline SVG the caller passes', () => {
    expect(ionIconSrc('  <svg viewBox="0 0 1 1"></svg>')).toBe('data:image/svg+xml;utf8,<svg viewBox="0 0 1 1"></svg>');
  });

  it('hands any other name to ion-icon as is (its addIcons registry decides)', () => {
    expect(ionIconSrc('ion:definitely-not-an-icon')).toBe('ion:definitely-not-an-icon');
  });

  it('undefined for nothing', () => {
    expect(ionIconSrc(undefined)).toBeUndefined();
    expect(ionIconSrc('')).toBeUndefined();
  });
});

// Guardrail (replaces the generated list): an icon that is not registered paints NOTHING (no network
// for icons, by CSP), so a template that names one must fail a test, not a till. The reader and its
// positive controls live in `src/testing/icons.test.ts`.
describe('guardrail: every icon a template or a call of this package names is registered', () => {
  /** The root of this package: the globs below are relative to it. */
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
  /** Where this package names icons: its components and the shell. */
  const SOURCES = ['src/**/*.vue', 'src/shell/**/*.ts', 'src/components/**/*.ts'];

  it('every icon named in this package is registered, and every glob reads something', () => {
    expect(scanIcons({ root: ROOT, sources: SOURCES })).toEqual({ unregistered: [], emptyGlobs: [] });
  });
});

// Ionicons the SaaS panel asks for: each one is the data URL of `ionicons/icons` itself.
describe('ION_ICONS: layers, sparkles, arrow-down, pricetag and ticket (SaaS panel)', () => {
  it('registers them by their kebab-case Ionicons name, as ion: names resolve', async () => {
    const ionicons = await import('ionicons/icons');
    for (const [name, src] of [
      ['layers-outline', ionicons.layersOutline],
      ['sparkles-outline', ionicons.sparklesOutline],
      ['arrow-down-outline', ionicons.arrowDownOutline],
      ['pricetag-outline', ionicons.pricetagOutline],
      ['ticket-outline', ionicons.ticketOutline],
    ]) {
      expect(src, name).toMatch(SVG_URL);
      expect(ION_ICONS[name], name).toBe(src);
      expect(resolveIcon(`ion:${name}`), name).toBe(src);
    }
  });
});

// Ionicons the Hub modules ask for (hub-next apps/{tax,customer}/UI-REQUESTS.md): Categories and
// Tags (pricetags), Aliases (swap-horizontal) and «Reactivate» a tax rule (arrow-undo).
describe('ION_ICONS: pricetags, swap-horizontal and arrow-undo (Hub tax and customer)', () => {
  it('registers them by their kebab-case Ionicons name, as ion: names resolve', async () => {
    const ionicons = await import('ionicons/icons');
    for (const [name, src] of [
      ['pricetags', ionicons.pricetags],
      ['pricetags-outline', ionicons.pricetagsOutline],
      ['swap-horizontal-outline', ionicons.swapHorizontalOutline],
      ['arrow-undo-outline', ionicons.arrowUndoOutline],
    ]) {
      expect(src, name).toMatch(SVG_URL);
      expect(ION_ICONS[name], name).toBe(src);
      expect(resolveIcon(`ion:${name}`), name).toBe(src);
    }
  });
});

// Ionicons the Hub's Services, Tasks and Price lists ask for (hub-next apps/{service,task,pricing}/
// UI-REQUESTS.md), the ones of the old modules: Services (briefcase), Packages (gift), «Archive»
// (archive), the «Main service» star (star / star-outline), Tasks (checkbox), «Details» and «Open»
// (open), «Start» (play-circle), «Complete» (checkmark-done) and Price lists (pricetag).
describe('ION_ICONS: briefcase, gift, archive, star, checkbox, open, play-circle, checkmark-done and pricetag (Hub service, task and pricing)', () => {
  it('registers them by their kebab-case Ionicons name, as ion: names resolve', async () => {
    const ionicons = await import('ionicons/icons');
    for (const [name, src] of [
      ['briefcase-outline', ionicons.briefcaseOutline],
      ['gift-outline', ionicons.giftOutline],
      ['archive-outline', ionicons.archiveOutline],
      ['star', ionicons.star],
      ['star-outline', ionicons.starOutline],
      ['checkbox-outline', ionicons.checkboxOutline],
      ['open-outline', ionicons.openOutline],
      ['play-circle-outline', ionicons.playCircleOutline],
      ['checkmark-done-outline', ionicons.checkmarkDoneOutline],
      ['pricetag', ionicons.pricetag],
    ]) {
      expect(src, name).toMatch(SVG_URL);
      expect(ION_ICONS[name], name).toBe(src);
      expect(resolveIcon(`ion:${name}`), name).toBe(src);
    }
  });
});
