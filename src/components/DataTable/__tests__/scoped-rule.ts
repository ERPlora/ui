import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// From disk: Vitest's CSS handling empties a `.css?raw` import.
const controlsCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../controls.css'), 'utf8');

/** The declarations of the rule written with exactly this selector in a component's scoped styles: the sheet
 *  the table's parts share, when the component takes it, then its own block. */
export function scopedRule(source: string, selector: string): string | undefined {
  const shared = source.includes('<style scoped src="./controls.css"></style>') ? controlsCss : '';
  const css = `${shared}\n${source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? ''}`.replace(/\/\*[\s\S]*?\*\//g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(?:^|[}\\n])[ \\t]*${escaped}\\s*\\{([^}]*)\\}`))?.[1].trim();
}
