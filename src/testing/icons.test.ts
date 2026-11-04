// The icon reader the guardrails run on (`@erplora/ui/testing`): which icon names a source file
// spells out, whether each one is registered, and a scan of a tree of files by globs. This package
// runs it on itself (`src/shell/icons.test.ts`); hub and saas run it on their own apps. And what a
// test setup calls so an `ion-icon` paints by name, as the shell makes it paint at boot.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { IonIcon } from '@ionic/vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ION_ICONS } from '../shell/icons';
import { iconReferences, isRegisteredIcon, registerShellIcons, scanIcons } from './icons';

describe('registerShellIcons', () => {
  /** The registry an `ion-icon` reads names from; every copy of Ionicons shares it through `window`. */
  const registry = (): Map<string, string> | undefined =>
    (window as unknown as { Ionicons?: { map?: Map<string, string> } }).Ionicons?.map;

  // Ionicons holds on to the map it first created: it is emptied, never replaced.
  beforeEach(() => registry()?.clear());

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('registers every shell icon under its name, as `createShell` does at boot', () => {
    registerShellIcons();
    expect(Object.fromEntries(registry() ?? [])).toEqual(ION_ICONS);
  });

  it('makes an `ion-icon` paint by name instead of logging the warning that floods a test run', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Ionicons also logs the error it catches on the path of a missing icon.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const missingIconWarnings = () => warn.mock.calls.filter(([message]) => String(message).includes('Could not load icon'));

    // The control: with nothing registered, the warning this helper exists to remove is there
    // (once per attempt to load, and an `ion-icon` makes more than one).
    const unregistered = mount(IonIcon, { props: { name: 'refresh-outline' }, attachTo: document.body });
    await vi.waitFor(() => expect(missingIconWarnings()).not.toEqual([]));
    unregistered.unmount();
    warn.mockClear();

    registerShellIcons();
    const registered = mount(IonIcon, { props: { name: 'refresh-outline' }, attachTo: document.body });
    await vi.waitFor(() => expect(registered.element.shadowRoot?.querySelector('svg')).not.toBeNull());
    expect(missingIconWarnings()).toEqual([]);
    registered.unmount();
  });

  it('can run twice (a setup file and a harness that still registers) without logging anything', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerShellIcons();
    registerShellIcons();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('iconReferences / isRegisteredIcon', () => {
  it('reads static names in multi-line tags, PascalCase or kebab-case, and in calls; never bound ones', () => {
    const source = `
      <HubIcon slot="start" name="ion:cart-outline" />
      <hub-icon
        name="mdi:cart"
      />
      <ion-icon
        slot="icon-only"
        name="add-outline"
      />
      <EmptyState icon="cube-outline" :icon="'file-tray-outline'" />
      <ion-icon :name="item.icon" /><HubIcon :name="icon" />
      const BACK = ionIconSrc('lucide:arrow-left');
      Nav(id="demo", label=_("Demo"), icon="ion:flask-outline", path="/demo/items")`;
    expect(iconReferences(source).map(({ name }) => name).sort()).toEqual(
      ['add-outline', 'cube-outline', 'file-tray-outline', 'ion:cart-outline', 'ion:flask-outline', 'lucide:arrow-left', 'mdi:cart'].sort(),
    );
  });

  it('reads literal bound names, names after a `>` inside another attribute, calls, icon keys and *_ICONS tables', () => {
    const source = `
      <HubIcon :name="'lucide:lock'" /><ion-icon slot="end" :name="'close-outline'" />
      <ion-icon @click="() => (open = count > 1)" class="x" name="trash-outline" />
      <HubIcon :title="a > b ? 'x' : 'y'" name="material-symbols:point-of-sale" />
      const lock = resolveIcon('lucide:shield-check');
      const actions = [{ id: 'edit', icon: 'create-outline' }, { id: 'pay', icon: 'ion:card-outline' }];
      const TONE_ICONS: Record<Tone, string> = {
        info: 'information-circle',
        warning: 'warning',
      };
      export const DATA_TABLE_ICONS = { sortNone: 'swap-vertical-outline', more: 'ellipsis-vertical' } as const;
      const menu = { icon: item.icon, label: 'Not an icon' };`;
    expect(iconReferences(source).map(({ name }) => name).sort()).toEqual(
      [
        'close-outline',
        'create-outline',
        'ellipsis-vertical',
        'information-circle',
        'ion:card-outline',
        'lucide:lock',
        'lucide:shield-check',
        'material-symbols:point-of-sale',
        'swap-vertical-outline',
        'trash-outline',
        'warning',
      ].sort(),
    );
  });

  it('catches an unregistered icon and a HubIcon name without its set', () => {
    const unknown = iconReferences('<HubIcon name="cart-outline" /><ion-icon name="no-such-icon" /><HubIcon name="mdi:no-such" />');
    expect(unknown.filter((reference) => !isRegisteredIcon(reference)).map(({ name }) => name)).toEqual([
      'cart-outline',
      'mdi:no-such',
      'no-such-icon',
    ]);
  });

  it('catches an unregistered icon in every form it reads (positive control)', () => {
    const source = `
      <HubIcon :name="'lucide:no-such'" /><ion-icon :name="'no-such-bound'" />
      <ion-icon @click="() => go(a > b)" name="no-such-after-arrow" />
      resolveIcon('mdi:no-such-call'); const a = { icon: 'no-such-key' };
      const TONE_ICONS = { info: 'no-such-tone' };`;
    expect(iconReferences(source).filter((reference) => !isRegisteredIcon(reference)).map(({ name }) => name).sort()).toEqual(
      ['lucide:no-such', 'mdi:no-such-call', 'no-such-after-arrow', 'no-such-bound', 'no-such-key', 'no-such-tone'].sort(),
    );
  });
});

describe('scanIcons (a tree of files, by globs relative to root)', () => {
  let root: string;

  /** Writes `source` at `root/relative`, creating its folders. */
  const put = (relative: string, source: string): void => {
    mkdirSync(dirname(join(root, relative)), { recursive: true });
    writeFileSync(join(root, relative), source);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'erplora-scan-icons-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports each unregistered icon with its file, and every glob that matched nothing', () => {
    put('a/x.vue', '<template><HubIcon name="mdi:no-such" /><HubIcon name="mdi:cart" /></template>');
    expect(scanIcons({ root, sources: ['a/**/*.vue', 'b/**/*.ts'] })).toEqual({
      unregistered: [{ file: 'a/x.vue', name: 'mdi:no-such' }],
      emptyGlobs: ['b/**/*.ts'],
    });
  });

  it('is clean when every icon is registered and every glob matches', () => {
    put('a/x.vue', '<template><ion-icon name="add-outline" /></template>');
    put('b/menu.ts', "export const menu = { icon: 'ion:flask-outline' };");
    expect(scanIcons({ root, sources: ['a/**/*.vue', 'b/**/*.ts'] })).toEqual({ unregistered: [], emptyGlobs: [] });
  });

  it('skips tests and node_modules; a glob that only finds those is empty', () => {
    put('a/x.test.ts', "const a = { icon: 'no-such-in-test' };");
    put('a/__tests__/y.ts', "const a = { icon: 'no-such-in-tests-dir' };");
    put('a/node_modules/dep/z.ts', "const a = { icon: 'no-such-in-dep' };");
    expect(scanIcons({ root, sources: ['a/**/*.ts'] })).toEqual({ unregistered: [], emptyGlobs: ['a/**/*.ts'] });
  });

  it('lists a file matched by two globs once, sorted by file and name', () => {
    put('b/y.vue', '<HubIcon name="mdi:no-such-2" /><HubIcon name="lucide:no-such-1" />');
    put('a/x.vue', '<ion-icon name="no-such-3" />');
    expect(scanIcons({ root, sources: ['**/*.vue', 'b/*.vue'] }).unregistered).toEqual([
      { file: 'a/x.vue', name: 'no-such-3' },
      { file: 'b/y.vue', name: 'lucide:no-such-1' },
      { file: 'b/y.vue', name: 'mdi:no-such-2' },
    ]);
  });
});
