// The chat's own words (`assistantMessages`, English source + Spanish), merged by the host into its catalogues
// (`createShell({ messages })`): under one root, `assistant`, so they never collide with an app's; the host's own
// words (the verb of each of its writes, its screens) stay in the host's catalogue (`AssistantConfig`).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assistantMessages } from './messages';

type Catalogue = { [key: string]: string | Catalogue };

function flatten(tree: Catalogue, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (message: string) => [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

const HERE = dirname(fileURLToPath(import.meta.url));
const EN = flatten(assistantMessages.en as Catalogue);
const ES = flatten(assistantMessages.es as Catalogue);

/** The chat's code: its components and its modules, never a test. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
    return entry.name.endsWith('.vue') || (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) ? [path] : [];
  });
}

describe('assistantMessages', () => {
  it('are English and Spanish, each under the single root `assistant`', () => {
    expect(Object.keys(assistantMessages).sort()).toEqual(['en', 'es']);
    expect(Object.keys(assistantMessages.en)).toEqual(['assistant']);
    expect(Object.keys(assistantMessages.es)).toEqual(['assistant']);
  });

  it('have exactly the same keys in both languages, none empty', () => {
    expect([...ES.keys()].sort()).toEqual([...EN.keys()].sort());
    for (const [key, message] of [...EN, ...ES]) expect(message.trim(), key).not.toBe('');
  });

  it('keep the same placeholders and plural forms in both languages', () => {
    for (const [key, message] of EN) {
      const spanish = ES.get(key) ?? '';
      expect(placeholders(spanish), key).toEqual(placeholders(message));
      expect(spanish.split('|').length, key).toBe(message.split('|').length);
    }
  });

  it("cover every key of its own that the chat's code names", () => {
    const files = sources(HERE);
    expect(files.length).toBeGreaterThan(0);
    const named = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [, key] of source.matchAll(/\bt\(\s*'(assistant\.[^']+)'/g)) named.add(key);
      for (const [, key] of source.matchAll(/\bkey: '(assistant\.[^']+)'/g)) named.add(key);
    }
    expect(named.size).toBeGreaterThan(20);
    expect([...named].filter((key) => !EN.has(key))).toEqual([]);
  });
});
