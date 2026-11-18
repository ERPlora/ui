// @vitest-environment node
// A component is a PascalCase name that `src/components/index.ts` or `src/shell/index.ts` exports from a `.vue` file.
// An entry of COMPONENTS.md is a `### ` heading, and every name in backticks on it is an export the entry documents.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { readRepoFile, REPO_ROOT } from "./__tests__/repo-files";

const CATALOG = "COMPONENTS.md";
const ENTRY_POINTS = { components: "src/components/index.ts", shell: "src/shell/index.ts" } as const;
const ENTRY_HEADING = /^### (.*)$/;
const OTHER_HEADING = /^#{1,3} /;
const NAME_IN_BACKTICKS = /`([A-Za-z_$][\w$]*)`/g;
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

type EntryPoint = keyof typeof ENTRY_POINTS;
type Export = { name: string; from: string; entryPoint: EntryPoint };
type Entry = { heading: string; names: string[]; text: string };

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/** The file a relative import names, found the way TypeScript finds it. */
function moduleFile(importer: string, specifier: string): string {
  const base = resolve(dirname(importer), specifier);
  const found = [base, `${base}.ts`, join(base, "index.ts")].find(isFile);
  if (!found) throw new Error(`${importer}: cannot find the module "${specifier}"`);
  return found;
}

/** Where each name a module imports comes from, for an `export { name }` with no `from`. */
function importOrigins(source: ts.SourceFile): Map<string, string> {
  const origins = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    const from = statement.moduleSpecifier.text;
    if (clause?.name) origins.set(clause.name.text, from);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach((element) => origins.set(element.name.text, from));
  }
  return origins;
}

/** The values a statement of the module itself exports: `export const`, `export function`, `export class`. */
function declaredNames(statement: ts.Statement): string[] {
  const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
  if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  }
  const named = ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement);
  return named && statement.name ? [statement.name.text] : [];
}

/** The values a module exports, following `export * from` into the modules it re-exports; types are left out. */
function valueExports(file: string, entryPoint: EntryPoint): Export[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
  const origins = importOrigins(source);
  return source.statements.flatMap((statement): Export[] => {
    if (!ts.isExportDeclaration(statement)) return declaredNames(statement).map((name) => ({ name, from: file, entryPoint }));
    if (statement.isTypeOnly) return [];
    const specifier = statement.moduleSpecifier;
    const from = specifier && ts.isStringLiteral(specifier) ? specifier.text : undefined;
    const clause = statement.exportClause;
    if (!clause) return from ? valueExports(moduleFile(file, from), entryPoint) : [];
    if (ts.isNamespaceExport(clause)) return [{ name: clause.name.text, from: from ?? file, entryPoint }];
    return clause.elements
      .filter((element) => !element.isTypeOnly)
      .map((element) => {
        const local = (element.propertyName ?? element.name).text;
        return { name: element.name.text, from: from ?? origins.get(local) ?? file, entryPoint };
      });
  });
}

function libraryExports(): Export[] {
  return (Object.keys(ENTRY_POINTS) as EntryPoint[]).flatMap((entryPoint) =>
    valueExports(join(REPO_ROOT, ENTRY_POINTS[entryPoint]), entryPoint),
  );
}

function isComponent({ name, from }: Export): boolean {
  return COMPONENT_NAME.test(name) && from.endsWith(".vue");
}

/** The catalog's entries: each `### ` heading with the names in backticks on it and the text up to the next heading. */
function catalogEntries(markdown: string): Entry[] {
  const entries: Entry[] = [];
  let current: Entry | undefined;
  for (const line of markdown.split("\n")) {
    const heading = ENTRY_HEADING.exec(line);
    if (heading) {
      current = { heading: heading[1], names: [...heading[1].matchAll(NAME_IN_BACKTICKS)].map((match) => match[1]), text: "" };
      entries.push(current);
    } else if (OTHER_HEADING.test(line)) {
      current = undefined;
    } else if (current) {
      current.text += `${line}\n`;
    }
  }
  return entries;
}

function readCatalog(): Entry[] {
  const markdown = readRepoFile(CATALOG);
  if (markdown === undefined) throw new Error(`${CATALOG} is missing: the catalog of the library's components`);
  return catalogEntries(markdown);
}

describe("valueExports", () => {
  it("follows export * and imported names to their files, and leaves the types out", () => {
    const root = mkdtempSync(join(tmpdir(), "component-catalog-"));
    try {
      mkdirSync(join(root, "folder"));
      writeFileSync(
        join(root, "folder", "index.ts"),
        ["export { default as Deep } from './Deep.vue';", "export type * from './types';"].join("\n"),
      );
      writeFileSync(
        join(root, "index.ts"),
        [
          "import Local from './Local.vue';",
          "import { helper } from './helpers';",
          "export * from './folder';",
          "export { default as Named } from './Named.vue';",
          "export { Local, helper };",
          "export type { Shape } from './types';",
          "export { type Hidden, shown } from './mixed';",
          "export const VERSION = '1';",
          "export function make() {}",
          "export * as tools from './tools';",
        ].join("\n"),
      );

      const found = valueExports(join(root, "index.ts"), "components").map(({ name, from }) => [name, from]);

      expect(found).toEqual([
        ["Deep", "./Deep.vue"],
        ["Named", "./Named.vue"],
        ["Local", "./Local.vue"],
        ["helper", "./helpers"],
        ["shown", "./mixed"],
        ["VERSION", join(root, "index.ts")],
        ["make", join(root, "index.ts")],
        ["tools", "./tools"],
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("isComponent", () => {
  it.each([
    ["DataTable", "./DataTable.vue", true],
    ["SpaConfigError", "./errors", false],
    ["CARD_SIZES", "./Card.vue", false],
  ])("%s from %s is a component: %s", (name, from, expected) => {
    expect(isComponent({ name, from, entryPoint: "components" })).toBe(expected);
  });
});

describe("catalogEntries", () => {
  it("reads every ### heading as an entry, with its names in backticks and its text up to the next heading", () => {
    const markdown = [
      "# Catalog",
      "## Lists",
      "### `DataTable`",
      "import { DataTable } from '@erplora/ui/components';",
      "#### Notes inside the entry",
      "## States",
      "Not part of any entry.",
      "### `toast`, `toastError` and friends",
      "### No names",
    ].join("\n");

    expect(catalogEntries(markdown)).toEqual([
      {
        heading: "`DataTable`",
        names: ["DataTable"],
        text: "import { DataTable } from '@erplora/ui/components';\n#### Notes inside the entry\n",
      },
      { heading: "`toast`, `toastError` and friends", names: ["toast", "toastError"], text: "" },
      { heading: "No names", names: [], text: "" },
    ]);
  });
});

describe("the component catalog", () => {
  it("finds the Vue components behind both entry points and leaves out what is not one", () => {
    const components = libraryExports().filter(isComponent);
    const names = components.map(({ name, entryPoint }) => `${entryPoint}:${name}`);

    expect(names).toEqual(expect.arrayContaining(["components:DataTable", "components:EmptyState", "shell:AppPage", "shell:HubIcon"]));
    expect(names).not.toContain("components:useConfirm");
    expect(names).not.toContain("components:DATA_TABLE_ICONS");
    expect(names).not.toContain("shell:toast");
  });

  it("has an entry for every component the library exports", () => {
    const catalogued = new Set(readCatalog().flatMap(({ names }) => names));
    const missing = libraryExports()
      .filter(isComponent)
      .filter(({ name }) => !catalogued.has(name))
      .map(({ name, entryPoint }) => `${name} (@erplora/ui/${entryPoint}): add a "### \`${name}\`" entry to ${CATALOG}`);

    expect(missing).toEqual([]);
  });

  it("names only what the library exports, each name once", () => {
    const exported = new Set(libraryExports().map(({ name }) => name));
    const seen = new Set<string>();
    const problems = readCatalog().flatMap(({ heading, names }) => {
      if (names.length === 0) return [`"### ${heading}": an entry names in backticks what it documents`];
      return names.flatMap((name) => {
        const repeated = seen.has(name);
        seen.add(name);
        if (!exported.has(name)) return [`${name}: the library no longer exports it; remove it from ${CATALOG}`];
        return repeated ? [`${name}: catalogued twice in ${CATALOG}`] : [];
      });
    });

    expect(problems).toEqual([]);
  });

  it("imports every name of an entry from the entry point that exports it", () => {
    const entryPointOf = new Map(libraryExports().map(({ name, entryPoint }) => [name, entryPoint]));
    const problems = readCatalog().flatMap(({ names, text }) =>
      names.flatMap((name) => {
        const entryPoint = entryPointOf.get(name);
        const path = `'@erplora/ui/${entryPoint}'`;
        return entryPoint && !text.includes(path) ? [`${name}: its entry imports it from ${path}`] : [];
      }),
    );

    expect(problems).toEqual([]);
  });
});
