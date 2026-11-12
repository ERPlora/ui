// Shared by this package and the apps that use it: an icon that is not registered in
// `src/shell/icons.ts` paints nothing (no network for icons, by CSP), so a template that names one
// must fail a test, not a till.
// Node only (it reads the disk): import it from tests, never from app code.
import { globSync, readFileSync } from 'node:fs';
import { glob, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { addIcons } from 'ionicons';

import { ION_ICONS, resolveIcon } from '../shell/icons';

/**
 * What `createShell` does at boot, for the tests that mount without it: an `ion-icon` paints by name
 * instead of warning with the whole element, which Vitest dumps by the thousand lines. Call it once
 * from a `vitest.setup.ts`, which also runs before `@vitest-environment node` files. Idempotent; a
 * no-op without a DOM.
 */
export function registerShellIcons(): void {
  addIcons(ION_ICONS);
}

/** `HubIcon` names carry their set (`mdi:cart`); everywhere else a bare name is an Ionicons one. */
export type IconKind = 'HubIcon' | 'icon';

/** One icon name a source spells out, and how it is read. */
export interface IconReference {
  readonly kind: IconKind;
  readonly name: string;
}

/** One attribute of a tag with its whole value: a `>` inside `@click="() => …"` does not end the tag. */
const ATTR = String.raw`\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?`;
/** The first `attr` (a pattern capturing the name) of every `<tag …>`, wherever it sits in the tag. */
const inTag = (tag: string, attr: string): RegExp => new RegExp(String.raw`<(?:${tag})\b(?:${ATTR})*?\s+${attr}`, 'g');
/** Static references only: a bound `:name="item.icon"` is runtime data; a bound literal is not. */
const REFERENCES: ReadonlyArray<readonly [IconKind, RegExp]> = [
  // `<HubIcon name="set:icon">` / `:name="'set:icon'"`: the set prefix is part of the name.
  ['HubIcon', inTag('HubIcon|hub-icon', String.raw`name="([^"]*)"`)],
  ['HubIcon', inTag('HubIcon|hub-icon', String.raw`:name="'([^']*)'"`)],
  // `<ion-icon name="icon">` / `:name="'icon'"`: an Ionicons name by definition.
  ['icon', inTag('ion-icon', String.raw`name="([^"]*)"`)],
  ['icon', inTag('ion-icon', String.raw`:name="'([^']*)'"`)],
  // The `icon` of our components (`<EmptyState icon="cube-outline">`) and of an app's menu
  // (`Nav(icon="ion:flask-outline")` in apps.py): bare names are Ionicons.
  ['icon', /\sicon="([^"]*)"/g],
  ['icon', /\s:icon="'([^']*)'"/g],
  // `ionIconSrc('lucide:lock')` (the SaaS account pages), `resolveIcon('mdi:cart')`.
  ['icon', /\b(?:ionIconSrc|resolveIcon)\(\s*'([^']*)'\s*\)/g],
  // An `icon:` key in code (`{ id: 'edit', icon: 'create-outline' }`, a menu entry…).
  ['icon', /\bicon:\s*'([^']*)'/g],
];
/** `const TONE_ICONS = { info: 'information-circle', … }`: every value of a `*_ICONS` table is an icon. */
const ICON_TABLE = /\b[A-Z][A-Z0-9_]*_ICONS\b[^=;{}]*=\s*\{([^}]*)\}/g;
const TABLE_VALUE = /:\s*'([^']*)'/g;

/** Every icon name `source` (a template, TypeScript or an `apps.py`) spells out statically. */
export function iconReferences(source: string): IconReference[] {
  const named = REFERENCES.flatMap(([kind, pattern]) => [...source.matchAll(pattern)].map((m) => ({ kind, name: m[1] })));
  const tabled = [...source.matchAll(ICON_TABLE)].flatMap((table) =>
    [...table[1].matchAll(TABLE_VALUE)].map((m) => ({ kind: 'icon' as const, name: m[1] })),
  );
  return [...named, ...tabled];
}

/** Whether the icon paints: registered, and a `HubIcon` name carries its set. */
export function isRegisteredIcon({ kind, name }: IconReference): boolean {
  return (kind !== 'HubIcon' || name.includes(':')) && resolveIcon(name) !== undefined;
}

export interface ScanIconsOptions {
  /** The folder the globs, and the files reported, are relative to. */
  readonly root: string;
  /** Globs of the files that name icons (`src/**\/*.vue`, `apps/*\/apps.py`…). */
  readonly sources: readonly string[];
}

export interface UnregisteredIcon {
  /** Relative to `root`, with `/`. */
  readonly file: string;
  readonly name: string;
}

export interface ScanIconsResult {
  /** Each icon named but not registered, sorted by file and name. */
  readonly unregistered: UnregisteredIcon[];
  /** Globs that matched no file: the guardrail would pass vacuously on them. */
  readonly emptyGlobs: string[];
}

/** Tests and dependencies are not app code: they may name icons that do not exist on purpose. */
const SKIPPED = /\.test\.ts$|(?:^|\/)__tests__\/|(?:^|\/)node_modules\//;

/** What each of the `sources` globs matched (`globbed`, in their order), tests and `node_modules` aside: the files,
 *  each once and sorted, and the globs that matched none. */
function sourceFiles(sources: readonly string[], globbed: readonly string[][]): { files: string[]; emptyGlobs: string[] } {
  const files = new Set<string>();
  const emptyGlobs: string[] = [];
  sources.forEach((pattern, index) => {
    const matched = globbed[index].map((file) => file.replaceAll('\\', '/')).filter((file) => !SKIPPED.test(file));
    if (matched.length === 0) emptyGlobs.push(pattern);
    for (const file of matched) files.add(file);
  });
  return { files: [...files].sort(), emptyGlobs };
}

/** Each icon `files` name that is not registered, by file and name; `texts` are the files', in order. */
function unregisteredIn(files: readonly string[], texts: readonly string[]): UnregisteredIcon[] {
  return files.flatMap((file, index) =>
    iconReferences(texts[index])
      .filter((reference) => !isRegisteredIcon(reference))
      .map(({ name }) => name)
      .sort()
      .map((name) => ({ file, name })),
  );
}

/**
 * Reads every file the `sources` globs match under `root` (tests and `node_modules` aside) and
 * reports the icons they name that are not registered. A glob that matches nothing (or only
 * skipped files) goes to `emptyGlobs`, so a moved folder cannot turn the guardrail into a no-op.
 */
export function scanIcons({ root, sources }: ScanIconsOptions): ScanIconsResult {
  const { files, emptyGlobs } = sourceFiles(sources, sources.map((pattern) => globSync(pattern, { cwd: root })));
  return { unregistered: unregisteredIn(files, files.map((file) => readFileSync(join(root, file), 'utf8'))), emptyGlobs };
}

/**
 * `scanIcons`, its folders listed and its files read at once by Node's own pool of threads, without
 * holding the thread that waits for it. A Vitest worker answers its run only while its event loop
 * turns, and the run fails once one is held past a minute: an app's whole tree, read
 * file by file on a loaded machine, each first open waiting on its own, can take that long.
 */
export async function scanIconsAsync({ root, sources }: ScanIconsOptions): Promise<ScanIconsResult> {
  const globbed = await Promise.all(
    sources.map(async (pattern) => {
      const matched: string[] = [];
      for await (const file of glob(pattern, { cwd: root })) matched.push(file);
      return matched;
    }),
  );
  const { files, emptyGlobs } = sourceFiles(sources, globbed);
  const texts = await Promise.all(files.map((file) => readFile(join(root, file), 'utf8')));
  return { unregistered: unregisteredIn(files, texts), emptyGlobs };
}
