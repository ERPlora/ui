// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { baseRevision, git, gitIfAny, readRepoFile, readSuppressions, REPO_ROOT, versionedFiles } from "./__tests__/repo-files";
import type { Suppressions } from "./__tests__/repo-files";

// A person has to be able to hold a file in their head. Each language has its limit in physical lines,
// blank lines and comments included, as ESLint's `max-lines` counts them: TypeScript and JavaScript 300
// (tests 500) and shell scripts 100 (shell tests 1,500); CSS and HTML have no figure of their own and keep
// 1,000 (tests 1,500). A limit only comes down against the main branch. A Vue component is measured by
// blocks in the lint (`vue/max-lines-per-block`), with no limit for the whole file.
// Files that were already longer are frozen in `.file-size-allow`, one line per file
// (`<ceiling> <path> <issue>`, the ceiling being the file's exact size), and that list can only shrink. A Vue
// component with a block frozen in the ESLint suppressions stays in it too, so that it does not grow either.
const LIMITS: Record<string, Limits> = {
  ".ts": { production: 300, test: 500 },
  ".tsx": { production: 300, test: 500 },
  ".js": { production: 300, test: 500 },
  ".mjs": { production: 300, test: 500 },
  ".cjs": { production: 300, test: 500 },
  ".sh": { production: 100, test: 1500 },
  ".css": { production: 1000, test: 1500 },
  ".html": { production: 1000, test: 1500 },
};
const LIMITS_TABLE = /^const LIMITS: Record<string, Limits> = \{\n([\s\S]*?)\n\};$/m;
const LIMITS_ROW = /^ {2}"(\.\w+)": \{ production: (\d+), test: (\d+) \},$/;
const COMPONENT = ".vue";
const TEST_FILE = /\.(?:test|spec)\.[^/]+$|(?:^|\/)(?:__tests__|e2e)\//;
const ALLOW_LIST = ".file-size-allow";
const ALLOW_LINE = /^(\d+) (\S+) ([\w.-]*#\d+)$/;
const THIS_TEST = "src/file-size.test.ts";

type Limits = { production: number; test: number };
type Exception = { ceiling: number; path: string; issue: string };

function lineCount(text: string): number {
  if (text === "") return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function isMeasured(path: string): boolean {
  return extname(path) in LIMITS;
}

function limitFor(path: string): number {
  const limits = LIMITS[extname(path)];
  return TEST_FILE.test(path) ? limits.test : limits.production;
}

/** The limits table as `source`, the text of this test, sets it; undefined when it has none by language. */
function limitsIn(source: string): Record<string, Limits> | undefined {
  const table = LIMITS_TABLE.exec(source);
  if (!table) return undefined;
  const rows = table[1].split("\n").map((row) => {
    const match = LIMITS_ROW.exec(row);
    if (!match) throw new Error(`${THIS_TEST}: "${row}" is not a row of the limits table`);
    return [match[1], { production: Number(match[2]), test: Number(match[3]) }] as const;
  });
  return Object.fromEntries(rows);
}

function raisedLimits(current: Record<string, Limits>, onMain: Record<string, Limits>): string[] {
  return Object.entries(onMain).flatMap(([type, before]) => {
    const now = current[type];
    if (!now) return [`${type}: no longer measured`];
    return (["production", "test"] as const).flatMap((kind) =>
      now[kind] > before[kind] ? [`${type}: the ${kind} limit rises from ${before[kind]} to ${now[kind]}`] : [],
    );
  });
}

/** The Vue components with a block over its limit frozen in the ESLint suppressions. */
function frozenComponents(suppressions: Suppressions): Set<string> {
  return new Set(Object.keys(suppressions).filter((path) => (suppressions[path]["vue/max-lines-per-block"]?.count ?? 0) > 0));
}

/** A file belongs in the list while it is over its limit or, a Vue component, while a block of it is frozen. */
function needsListing(path: string, lines: number, frozen: Set<string>): boolean {
  if (extname(path) === COMPONENT) return frozen.has(path);
  return isMeasured(path) && lines > limitFor(path);
}

function parseAllowList(text: string): Exception[] {
  const seen = new Set<string>();
  return text.split("\n").flatMap((line, index) => {
    if (line.trim() === "" || line.startsWith("#")) return [];
    const match = ALLOW_LINE.exec(line);
    if (!match) throw new Error(`${ALLOW_LIST}:${index + 1}: expected "<ceiling> <path> <issue>", got "${line}"`);
    if (seen.has(match[2])) throw new Error(`${ALLOW_LIST}:${index + 1}: ${match[2]} is listed twice`);
    seen.add(match[2]);
    return [{ ceiling: Number(match[1]), path: match[2], issue: match[3] }];
  });
}

function unlistedProblem(path: string, lines: number): string {
  if (extname(path) === COMPONENT) {
    return `${path}: ${lines} lines with a block frozen in eslint-suppressions.json; list it in ${ALLOW_LIST} at its size`;
  }
  return `${path}: ${lines} lines, over the ${limitFor(path)}-line limit`;
}

function staleProblem(path: string, lines: number): string {
  if (extname(path) === COMPONENT) {
    return `${path}: no block of it is frozen in eslint-suppressions.json; remove its line from ${ALLOW_LIST}`;
  }
  return `${path}: ${lines} lines fit under the ${limitFor(path)}-line limit; remove its line from ${ALLOW_LIST}`;
}

function exceptionProblems({ path, ceiling }: Exception, lines: number | undefined, frozen: Set<string>): string[] {
  if (lines === undefined) return [`${path}: listed in ${ALLOW_LIST} but no such code file; remove its line`];
  if (!needsListing(path, lines, frozen)) return [staleProblem(path, lines)];
  if (lines > ceiling) return [`${path}: ${lines} lines, over its ceiling of ${ceiling} in ${ALLOW_LIST}`];
  // The ceiling follows the file down, so the lines someone removes cannot quietly come back.
  if (ceiling > lines) return [`${path}: ${lines} lines; lower its ceiling in ${ALLOW_LIST} from ${ceiling} to ${lines}`];
  return [];
}

function sizeProblems(sizes: Map<string, number>, exceptions: Exception[], frozen = new Set<string>()): string[] {
  const listed = new Set(exceptions.map(({ path }) => path));
  const unlisted = [...sizes].flatMap(([path, lines]) =>
    !listed.has(path) && needsListing(path, lines, frozen) ? [unlistedProblem(path, lines)] : [],
  );
  const listedProblems = exceptions.flatMap((exception) => exceptionProblems(exception, sizes.get(exception.path), frozen));
  return [...unlisted, ...listedProblems];
}

/**
 * The exception list may not gain a file or raise a ceiling against the main branch. The one way in is the
 * change that lowers a limit or turns a block limit on: a file main already had, and that needs listing now,
 * enters at its size there, at most.
 */
function allowListGrowth(
  current: Exception[],
  base: Exception[],
  sizesOnMain: Map<string, number>,
  frozen = new Set<string>(),
): string[] {
  const before = new Map(base.map(({ path, ceiling }) => [path, ceiling]));
  return current.flatMap(({ path, ceiling }) => {
    const previous = before.get(path) ?? listedSizeOnMain(path, sizesOnMain, frozen);
    if (previous === undefined) return [`${path}: a new exception in ${ALLOW_LIST}; split the file instead`];
    return ceiling > previous ? [`${path}: its ceiling in ${ALLOW_LIST} rises from ${previous} to ${ceiling}`] : [];
  });
}

function listedSizeOnMain(path: string, sizesOnMain: Map<string, number>, frozen: Set<string>): number | undefined {
  const lines = sizesOnMain.get(path);
  return lines !== undefined && needsListing(path, lines, frozen) ? lines : undefined;
}

/** The exception list in `root`'s working tree against the one at `base`, with the sizes `base` had. */
function allowListGrowthAt(base: string, root = REPO_ROOT): string[] {
  const exceptions = parseAllowList(readRepoFile(ALLOW_LIST, root) ?? "");
  const baseExceptions = parseAllowList(gitIfAny(["show", `${base}:${ALLOW_LIST}`], root) ?? "");
  const sizesOnMain = sizesAt(base, exceptions.map(({ path }) => path), root);
  return allowListGrowth(exceptions, baseExceptions, sizesOnMain, frozenComponents(readSuppressions(root)));
}

/** The lines each of `paths` had at `revision`, leaving out those it did not have. */
function sizesAt(revision: string, paths: string[], root = REPO_ROOT): Map<string, number> {
  return new Map(
    paths.flatMap((path) => {
      const text = gitIfAny(["show", `${revision}:${path}`], root);
      return text === undefined ? [] : [[path, lineCount(text)] as const];
    }),
  );
}

/** The sizes of the files with a limit of their own, and of the Vue components the list may hold. */
function codeFileSizes(): Map<string, number> {
  const sized = versionedFiles().filter((path) => isMeasured(path) || extname(path) === COMPONENT);
  return new Map(sized.map((path) => [path, lineCount(readFileSync(join(REPO_ROOT, path), "utf8"))]));
}

function writeRepoFile(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

describe("file size", () => {
  it("counts physical lines, with or without a final newline", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount("a")).toBe(1);
    expect(lineCount("a\n")).toBe(1);
    expect(lineCount("a\n\nb\n")).toBe(3);
    expect(lineCount("a\nb")).toBe(2);
  });

  it("holds each language to its own limit: TypeScript and JavaScript 300 (tests 500), shell 100, CSS and HTML 1,000", () => {
    const limits = {
      "src/sdk/allauth.ts": 300,
      "src/shell/view.tsx": 300,
      "eslint.config.js": 300,
      "scripts/build.mjs": 300,
      "scripts/build.cjs": 300,
      "src/a.test.ts": 500,
      "src/b.spec.ts": 500,
      "src/c/__tests__/harness.ts": 500,
      "e2e/login.ts": 500,
      "src/e2e/x.ts": 500,
      "scripts/release.sh": 100,
      ".githooks/pre-push.test.sh": 1500,
      "src/shell/theme/polish.css": 1000,
      "docs/brandbook.html": 1000,
      "src/components/DataTable/__tests__/lit-styles.css": 1500,
    };
    expect(Object.fromEntries(Object.keys(limits).map((path) => [path, limitFor(path)]))).toEqual(limits);
  });

  it("reads the limits table from this test's own source, and none from one older than limits by language", () => {
    expect(limitsIn(readRepoFile(THIS_TEST) ?? "")).toEqual(LIMITS);
    expect(limitsIn("const LIMITS = { production: 1000, test: 1500 } as const;\n")).toBeUndefined();
  });

  it("flags a limit that rises against main and a file type that stops being measured, and lets limits come down", () => {
    const onMain = {
      ".ts": { production: 300, test: 500 },
      ".sh": { production: 100, test: 1500 },
      ".css": { production: 1000, test: 1500 },
    };
    const current = {
      ".ts": { production: 250, test: 600 },
      ".css": { production: 1001, test: 1500 },
      ".tsx": { production: 300, test: 500 },
    };
    expect(raisedLimits(onMain, onMain)).toEqual([]);
    expect(raisedLimits(current, onMain)).toEqual([
      ".ts: the test limit rises from 500 to 600",
      ".sh: no longer measured",
      ".css: the production limit rises from 1000 to 1001",
    ]);
  });

  it("flags an unlisted file over its limit, and not one exactly at it", () => {
    const sizes = new Map([
      ["src/big.ts", 301],
      ["src/edge.ts", 300],
      ["src/big.test.ts", 501],
      ["src/edge.test.ts", 500],
      ["scripts/big.sh", 101],
      ["scripts/edge.sh", 100],
      ["src/big.css", 1001],
      ["src/edge.css", 1000],
    ]);
    expect(sizeProblems(sizes, [])).toEqual([
      "src/big.ts: 301 lines, over the 300-line limit",
      "src/big.test.ts: 501 lines, over the 500-line limit",
      "scripts/big.sh: 101 lines, over the 100-line limit",
      "src/big.css: 1001 lines, over the 1000-line limit",
    ]);
  });

  it("flags a listed file over its ceiling, one that fits again and one that no longer exists", () => {
    const sizes = new Map([
      ["src/grown.ts", 570],
      ["src/kept.ts", 569],
      ["src/split.ts", 300],
    ]);
    const exceptions = [
      { ceiling: 569, path: "src/grown.ts", issue: "#1" },
      { ceiling: 569, path: "src/kept.ts", issue: "#1" },
      { ceiling: 569, path: "src/split.ts", issue: "#1" },
      { ceiling: 1503, path: "src/gone.test.ts", issue: "#2" },
    ];
    expect(sizeProblems(sizes, exceptions)).toEqual([
      "src/grown.ts: 570 lines, over its ceiling of 569 in .file-size-allow",
      "src/split.ts: 300 lines fit under the 300-line limit; remove its line from .file-size-allow",
      "src/gone.test.ts: listed in .file-size-allow but no such code file; remove its line",
    ]);
  });

  it("asks to lower a ceiling to the exact size of a file that shrinks", () => {
    const exceptions = [{ ceiling: 569, path: "src/a.ts", issue: "#1" }];
    expect(sizeProblems(new Map([["src/a.ts", 569]]), exceptions)).toEqual([]);
    expect(sizeProblems(new Map([["src/a.ts", 568]]), exceptions)).toEqual([
      "src/a.ts: 568 lines; lower its ceiling in .file-size-allow from 569 to 568",
    ]);
  });

  it("holds a Vue component with a frozen block to its exact size in the list, and lets it go once none is frozen", () => {
    const frozen = new Set(["src/Table.vue", "src/Kept.vue", "src/Unlisted.vue"]);
    const sizes = new Map([
      ["src/Table.vue", 2369],
      ["src/Kept.vue", 640],
      ["src/Unlisted.vue", 400],
      ["src/Split.vue", 200],
      ["src/Free.vue", 900],
    ]);
    const exceptions = [
      { ceiling: 2368, path: "src/Table.vue", issue: "#1" },
      { ceiling: 640, path: "src/Kept.vue", issue: "#1" },
      { ceiling: 300, path: "src/Split.vue", issue: "#1" },
    ];
    expect(sizeProblems(sizes, exceptions, frozen)).toEqual([
      "src/Unlisted.vue: 400 lines with a block frozen in eslint-suppressions.json; list it in .file-size-allow at its size",
      "src/Table.vue: 2369 lines, over its ceiling of 2368 in .file-size-allow",
      "src/Split.vue: no block of it is frozen in eslint-suppressions.json; remove its line from .file-size-allow",
    ]);
  });

  it("takes in a Vue component with a frozen block at most at its size on main, and no other new one", () => {
    const onMain = new Map([
      ["src/Combo.vue", 640],
      ["src/Panel.vue", 500],
      ["src/Free.vue", 400],
    ]);
    const current = [
      { ceiling: 640, path: "src/Combo.vue", issue: "#1" },
      { ceiling: 501, path: "src/Panel.vue", issue: "#1" },
      { ceiling: 400, path: "src/Free.vue", issue: "#1" },
      { ceiling: 50, path: "src/New.vue", issue: "#1" },
    ];
    const frozen = new Set(["src/Combo.vue", "src/Panel.vue", "src/New.vue"]);
    expect(allowListGrowth(current, [], onMain, frozen)).toEqual([
      "src/Panel.vue: its ceiling in .file-size-allow rises from 500 to 501",
      "src/Free.vue: a new exception in .file-size-allow; split the file instead",
      "src/New.vue: a new exception in .file-size-allow; split the file instead",
    ]);
  });

  it("names the Vue components with a block frozen in the ESLint suppressions", () => {
    const suppressions = {
      "src/Table.vue": { "vue/max-lines-per-block": { count: 3 }, complexity: { count: 1 } },
      "src/Combo.vue": { complexity: { count: 1 } },
      "src/state.ts": { "max-lines-per-function": { count: 2 } },
    };
    expect([...frozenComponents(suppressions)]).toEqual(["src/Table.vue"]);
  });

  it("leaves a Vue component to the lint, which measures each of its blocks", () => {
    expect(isMeasured("src/components/DataTable/DataTable.vue")).toBe(false);
    for (const path of ["src/a.ts", "src/a.test.ts", "scripts/release.sh", "src/theme.css", "docs/brandbook.html"]) {
      expect(isMeasured(path), path).toBe(true);
    }
    for (const path of ["README.md", "package.json", "pnpm-lock.yaml", ".file-size-allow"]) {
      expect(isMeasured(path), path).toBe(false);
    }
  });

  it("reads one `<ceiling> <path> <issue>` line per file, skips comments and rejects anything else", () => {
    expect(parseAllowList("# a note\n569 src/a.ts #150\n\n1503 src/b.test.ts erplora-next#87\n")).toEqual([
      { ceiling: 569, path: "src/a.ts", issue: "#150" },
      { ceiling: 1503, path: "src/b.test.ts", issue: "erplora-next#87" },
    ]);
    expect(() => parseAllowList("569 src/a.ts")).toThrow(".file-size-allow:1:");
    expect(() => parseAllowList("src/a.ts 569 #150")).toThrow(".file-size-allow:1:");
    expect(() => parseAllowList("569 src/a.ts #150\n570 src/a.ts #150")).toThrow("src/a.ts is listed twice");
  });

  it("flags an exception list that gains a file or raises a ceiling, and lets it shrink", () => {
    const base = [
      { ceiling: 569, path: "src/a.ts", issue: "#1" },
      { ceiling: 1503, path: "src/b.test.ts", issue: "#2" },
    ];
    expect(allowListGrowth([{ ceiling: 568, path: "src/a.ts", issue: "#1" }], base, new Map())).toEqual([]);
    expect(
      allowListGrowth(
        [
          { ceiling: 570, path: "src/a.ts", issue: "#1" },
          { ceiling: 301, path: "src/new.ts", issue: "#3" },
        ],
        base,
        new Map(),
      ),
    ).toEqual([
      "src/a.ts: its ceiling in .file-size-allow rises from 569 to 570",
      "src/new.ts: a new exception in .file-size-allow; split the file instead",
    ]);
  });

  it("takes in, at most at its size there, a file the main branch already had over a lowered limit", () => {
    const onMain = new Map([
      ["src/model.ts", 420],
      ["src/state.ts", 413],
      ["src/small.ts", 290],
    ]);
    const current = [
      { ceiling: 420, path: "src/model.ts", issue: "#1" },
      { ceiling: 414, path: "src/state.ts", issue: "#1" },
      { ceiling: 301, path: "src/small.ts", issue: "#1" },
      { ceiling: 301, path: "src/new.ts", issue: "#1" },
    ];
    expect(allowListGrowth(current, [], onMain)).toEqual([
      "src/state.ts: its ceiling in .file-size-allow rises from 413 to 414",
      "src/small.ts: a new exception in .file-size-allow; split the file instead",
      "src/new.ts: a new exception in .file-size-allow; split the file instead",
    ]);
  });

  it("reads the main branch's sizes from its commit, not from the working tree", { timeout: 60_000 }, () => {
    const root = mkdtempSync(join(tmpdir(), "file-size-"));
    try {
      writeRepoFile(root, "src/grown.ts", "x\n".repeat(290));
      writeRepoFile(root, "src/model.ts", "x\n".repeat(420));
      git(["init", "--quiet"], root);
      git(["add", "--all"], root);
      const author = ["-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"];
      git([...author, "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "main"], root);
      const base = git(["rev-parse", "HEAD"], root).trim();
      writeRepoFile(root, "src/grown.ts", "x\n".repeat(350));
      writeRepoFile(root, ALLOW_LIST, "350 src/grown.ts #1\n420 src/model.ts #1\n");
      expect(allowListGrowthAt(base, root)).toEqual(["src/grown.ts: a new exception in .file-size-allow; split the file instead"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("measures the versioned code files, this one included, and leaves lockfiles and Markdown out", { timeout: 60_000 }, () => {
    const paths = [...codeFileSizes().keys()];
    expect(paths).toContain(THIS_TEST);
    expect(paths).toContain("src/shell/theme/polish.css");
    expect(paths).toContain("src/components/DataTable/DataTable.vue");
    expect(paths).not.toContain("pnpm-lock.yaml");
    expect(paths).not.toContain("package.json");
    expect(paths.filter((path) => path.endsWith(".md"))).toEqual([]);
  });

  it("every code file fits under its limit, or under its ceiling in .file-size-allow", { timeout: 60_000 }, () => {
    const exceptions = parseAllowList(readRepoFile(ALLOW_LIST) ?? "");
    expect(sizeProblems(codeFileSizes(), exceptions, frozenComponents(readSuppressions()))).toEqual([]);
  });

  it("the exception list only shrinks against the main branch", { timeout: 60_000 }, (context) => {
    const base = baseRevision();
    // Only the change that brings this test in has a base without it: there is nothing to compare yet.
    // Once the test is on main, a base without the list counts as an empty one.
    if (gitIfAny(["cat-file", "-e", `${base}:${THIS_TEST}`]) === undefined) {
      context.skip(`${base.slice(0, 7)} predates this test`);
    }
    expect(allowListGrowthAt(base)).toEqual([]);
  });

  it("no limit rises against the main branch", { timeout: 60_000 }, (context) => {
    const onMain = limitsIn(gitIfAny(["show", `${baseRevision()}:${THIS_TEST}`]) ?? "");
    // Only the change that brings limits by language in has a base without them: there is nothing to compare yet.
    if (onMain === undefined) context.skip("the main branch has no limits by language yet");
    expect(raisedLimits(LIMITS, onMain ?? {})).toEqual([]);
  });
});
