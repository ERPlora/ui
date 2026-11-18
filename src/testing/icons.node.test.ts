// @vitest-environment node
// An app's `vitest.setup.ts` also runs before its `@vitest-environment node` files (config tests, e2e helpers), so
// what it calls has to load and run without a DOM. `scanIconsAsync` must also avoid Node's synchronous calls, which
// would hold the thread that waits for it; the setup loaded icons.ts before `node:fs` was watched, so that test loads
// it afresh.
import { describe, expect, it, vi } from 'vitest';

import { useTempTree } from './__tests__/tempTree';
import { scanIconsAsync } from './icons';
import { registerShellIcons } from './index';

// Node's synchronous listing and reading, watched (see the scanIconsAsync test).
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, globSync: vi.fn(fs.globSync), readFileSync: vi.fn(fs.readFileSync) };
});

describe('registerShellIcons without a DOM', () => {
  it('loads and runs without throwing, so a test setup can call it before any test file', () => {
    expect(typeof window).toBe('undefined');
    expect(() => registerShellIcons()).not.toThrow();
  });
});

describe('scanIconsAsync', () => {
  const tree = useTempTree('erplora-scan-icons-');

  // A Vitest worker answers its run only while its event loop turns, and fails the run after a minute held: a tree read
  // file by file on a loaded machine, each first open waiting on its own, can take that long.
  it('lists and reads the tree without holding the thread: what it was given meanwhile runs before the scan ends', async () => {
    for (let index = 0; index < 30; index += 1) tree.put(`p${index}.vue`, '<ion-icon name="add-outline" />');
    let turned = false;
    setImmediate(() => {
      turned = true;
    });
    expect(await scanIconsAsync({ root: tree.root, sources: ['*.vue'] })).toEqual({ unregistered: [], emptyGlobs: [] });
    expect(turned).toBe(true);
  });

  it('lists and reads the tree with neither of the synchronous calls scanIcons makes', async () => {
    tree.put('a/x.vue', '<HubIcon name="mdi:no-such" />');
    tree.put('a/y.vue', '<ion-icon name="add-outline" />');
    const { root } = tree;
    vi.resetModules();
    const fs = await import('node:fs');
    const icons = await import('./icons');
    /** The synchronous calls made on the tree: a listing from it, a read of one of its files. */
    const onTheTree = () => [
      ...vi.mocked(fs.globSync).mock.calls.filter(([, options]) => options?.cwd === root),
      ...vi.mocked(fs.readFileSync).mock.calls.filter(([path]) => String(path).startsWith(root)),
    ];
    const sources = ['a/*.vue', 'b/*.ts'];

    expect(await icons.scanIconsAsync({ root, sources })).toEqual({ unregistered: [{ file: 'a/x.vue', name: 'mdi:no-such' }], emptyGlobs: ['b/*.ts'] });
    expect(onTheTree()).toEqual([]);
    // And the watch sees them: `scanIcons` lists (each glob) and reads (each file) that way.
    icons.scanIcons({ root, sources });
    expect(onTheTree()).toHaveLength(4);
  });
});
