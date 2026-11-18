// Test helper: the rules of a stylesheet read as text (happy-dom applies no CSS), and the weight of a selector.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { plain } from '../../../components/__tests__/themeContrast';

const THEME = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface Rule {
  readonly selectors: readonly string[];
  readonly body: string;
}

/** A sheet of the theme folder, comments out. */
export const themeSheet = (file: string): string => plain(readFileSync(join(THEME, file), 'utf8'));

/** `list` split at its top-level commas: the commas inside `:is(…)` stay with their selector. */
function topLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  return [...out, list.slice(start)];
}

/** Every style rule of `css`, the ones inside an at-rule (`@container`, `@media`) too; at-rule preludes are not rules.
 *  Each selector comes on one line, its white space collapsed. */
export function rules(css: string): Rule[] {
  return [...css.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: topLevel(m[1])
      .map((selector) => selector.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    body: m[2],
  }));
}

/** The rules whose selector list holds `selector` exactly. */
export const rulesFor = (css: string, selector: string): Rule[] => rules(css).filter((rule) => rule.selectors.includes(selector));

/** The value of `property` in the last rule that holds `selector` and declares it. */
export function valueOf(css: string, selector: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = rulesFor(css, selector).flatMap((rule) => [
    ...rule.body.matchAll(new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;]+)`, 'g')),
  ]);
  return found.at(-1)?.[1].trim();
}

/**
 * The specificity of `selector` as [classes, attributes and pseudo-classes] then [elements]: ids are never used here.
 * `:is()` weighs its heaviest argument; a pseudo-element (`::part()`) weighs as an element.
 */
export function specificity(selector: string): [number, number] {
  let rest = selector;
  let classes = 0;
  let elements = 0;
  for (const [whole, inner] of selector.matchAll(/:is\(([^)]*)\)/g)) {
    const [c, e] = inner
      .split(',')
      .map((part) => specificity(part.trim()))
      .reduce((best, next) => (next[0] > best[0] || (next[0] === best[0] && next[1] > best[1]) ? next : best), [0, 0]);
    classes += c;
    elements += e;
    rest = rest.replace(whole, '');
  }
  rest = rest.replace(/::[\w-]+(\([^)]*\))?/g, () => {
    elements += 1;
    return '';
  });
  classes += (rest.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length;
  elements += (rest.replace(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return [classes, elements];
}

/** Whether specificity `a` beats `b`. */
export const outweighs = (a: [number, number], b: [number, number]): boolean => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

/** Every selector of `css`. */
export const selectorsOf = (css: string): string[] => rules(css).flatMap((rule) => rule.selectors);

/** A literal colour: a hex value or an `rgb()`/`hsl()` call. Colours come from the theme's tokens. */
export const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

/** The number of pixels of a length in px or rem (a rem is 16 px), `undefined` for anything else. */
export function pixels(value: string | undefined): number | undefined {
  const match = /^(\d*\.?\d+)(px|rem)$/.exec(value?.trim() ?? '');
  if (!match) return undefined;
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
}
