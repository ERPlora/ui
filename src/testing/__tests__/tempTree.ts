import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach } from 'vitest';

export interface TempTree {
  /** The current test's folder. */
  readonly root: string;
  /** Writes `source` at `relative` under the folder, creating its folders. */
  put(relative: string, source: string): void;
}

/** Called in a `describe`: each of its tests gets a fresh folder, removed once the test ends. */
export function useTempTree(prefix: string): TempTree {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), prefix));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return {
    get root() {
      return root;
    },
    put(relative, source) {
      mkdirSync(dirname(join(root, relative)), { recursive: true });
      writeFileSync(join(root, relative), source);
    },
  };
}
