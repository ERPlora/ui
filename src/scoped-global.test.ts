// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { readRepoFile, versionedFiles } from './__tests__/repo-files';

// In a scoped style Vue swaps the whole selector for what `:global(…)` holds: `:global(html.docked) .stack` reaches the
// browser as `html.docked`, and the rule lands on the page root instead of the stack. A selector that needs a global
// part keeps all of it inside the parentheses, `:global(html.docked .stack)`.

const SCOPED_STYLE = /<style\b[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/g;
const COMMENT = /\/\*[\s\S]*?\*\//g;

/** The selectors of `css`, split at their top-level commas, without at-rule preludes. */
function selectors(css: string): string[] {
  const preludes = [...css.replace(COMMENT, '').matchAll(/([^{}]+)\{/g)].map((m) => m[1].split(';').pop()!.trim());
  return preludes.filter((prelude) => !prelude.startsWith('@')).flatMap(topLevelParts);
}

function topLevelParts(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    else if (selector[i] === ')') depth--;
    else if (selector[i] === ',' && depth === 0) {
      parts.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(selector.slice(start).trim());
  return parts;
}

/** Whether `selector` is one `:global(…)` and nothing else around it. */
function wholeGlobal(selector: string): boolean {
  if (!selector.startsWith(':global(')) return false;
  let depth = 0;
  for (let i = ':global'.length; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    else if (selector[i] === ')' && --depth === 0) return i === selector.length - 1;
  }
  return false;
}

/** The selectors of the scoped styles of `sfc` that Vue would cut short. */
function cutShortGlobals(sfc: string): string[] {
  return [...sfc.matchAll(SCOPED_STYLE)]
    .flatMap((m) => selectors(m[1]))
    .filter((selector) => selector.includes(':global(') && !wholeGlobal(selector));
}

describe('a :global() selector in a scoped style', () => {
  it('is caught when something sits before or after it, which Vue would drop', () => {
    const sfc = `<style scoped>
      :global(html.assistant-docked) .ep-toast-stack { right: 0; }
      .layer :global(.ghost) { opacity: 0; }
      @media (max-width: 599px) { .a, :global(html.docked) .b { right: 12px; } }
    </style>`;
    expect(cutShortGlobals(sfc)).toEqual([
      ':global(html.assistant-docked) .ep-toast-stack',
      '.layer :global(.ghost)',
      ':global(html.docked) .b',
    ]);
  });

  it('passes when the whole selector sits inside it', () => {
    const sfc = `<style scoped>
      :global(html.assistant-docked .ep-toast-stack) { right: var(--assistant-width, 0px); }
      @media (max-width: 599px) { .layer, :global(html.docked .layer) { right: 12px; } }
    </style>`;
    expect(cutShortGlobals(sfc)).toEqual([]);
  });

  it('holds the whole selector in every component of the library', () => {
    const cutShort = versionedFiles()
      .filter((path) => path.startsWith('src/') && path.endsWith('.vue'))
      .flatMap((path) => cutShortGlobals(readRepoFile(path) ?? '').map((selector) => `${path}: ${selector}`));
    expect(cutShort).toEqual([]);
  });
});
