// The scoped stylesheet of a floor plan component, read from its file: happy-dom paints nothing, so a test that
// a rule is there reads it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..');

export function scopedStyle(file: string): { style: string; rule: (selector: string) => string } {
  const source = readFileSync(join(FOLDER, file), 'utf8');
  const style = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const rule = (selector: string): string => {
    const at = style.indexOf(`${selector} {`);
    return at === -1 ? '' : style.slice(at, style.indexOf('}', at));
  };
  return { style, rule };
}
