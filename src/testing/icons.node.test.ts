// @vitest-environment node
// icons.ts in Node's environment. An app's `vitest.setup.ts` also runs before its `@vitest-environment node` files
// (config tests, e2e helpers), so what it calls has to load and run without a DOM. And `scanIconsAsync` lists and reads
// a tree without Node's synchronous calls, which would hold the thread that waits for it (hub#1315): watched here, where
// a module's own `node:fs` is the watched one; the setup loaded icons.ts before the watch, so its test loads it afresh.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('scanIconsAsync in Node’s environment', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'erplora-scan-icons-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('scanIconsAsync lists and reads the tree with neither of the synchronous calls scanIcons makes', async () => {
    mkdirSync(join(root, 'a'));
    writeFileSync(join(root, 'a', 'x.vue'), '<HubIcon name="mdi:no-such" />');
    writeFileSync(join(root, 'a', 'y.vue'), '<ion-icon name="add-outline" />');
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
