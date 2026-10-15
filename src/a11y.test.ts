// R-03 (UX audit 2, 2026-10-14): 740 icons of the panel reached assistive tech as unnamed images,
// almost all from this package's own templates (DataTable, AppTopbar), which paint `ion-icon`
// directly. Every `ion-icon` a template of this package writes is decorative (`aria-hidden="true"`)
// or named: this scan keeps it so for the ones a render test does not reach (busy, gap, menu…).
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { bareIonIcons } from './testing/a11y';

const SRC = dirname(fileURLToPath(import.meta.url));

describe('accessible names in the templates of @erplora/ui (R-03)', () => {
  it('every <ion-icon> is aria-hidden or named', () => {
    const files = globSync('**/*.vue', { cwd: SRC });
    expect(files.length).toBeGreaterThan(10);
    const bare = files.flatMap((file) =>
      bareIonIcons(readFileSync(join(SRC, file), 'utf8')).map((tag) => `${relative(SRC, join(SRC, file))}: ${tag.replace(/\s+/g, ' ')}`),
    );
    expect(bare).toEqual([]);
  });
});
