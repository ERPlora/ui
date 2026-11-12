// The templates of this package paint `ion-icon` directly, so every one they write must be decorative
// (`aria-hidden="true"`) or named. This scan covers the ones a render test does not reach (busy, gap, menu…).
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { bareIonIcons } from './testing/a11y';

const SRC = dirname(fileURLToPath(import.meta.url));

describe('accessible names in the templates of @erplora/ui', () => {
  it('every <ion-icon> is aria-hidden or named', () => {
    const files = globSync('**/*.vue', { cwd: SRC });
    expect(files.length).toBeGreaterThan(10);
    const bare = files.flatMap((file) =>
      bareIonIcons(readFileSync(join(SRC, file), 'utf8')).map((tag) => `${relative(SRC, join(SRC, file))}: ${tag.replace(/\s+/g, ' ')}`),
    );
    expect(bare).toEqual([]);
  });
});
