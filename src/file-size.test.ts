// @vitest-environment node
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { baseRevision, gitIfAny, readRepoFile, REPO_ROOT, versionedFiles } from "./__tests__/repo-files";

// A person has to be able to hold a file in their head. Each language has its limit in physical lines,
// blank lines and comments included, as ESLint's `max-lines` counts them: TypeScript and JavaScript 300
// (tests 500) and shell scripts 100; CSS and HTML have no figure of their own and keep 1,000 (tests 1,500).
// A Vue component is left to the lint, which measures each of its blocks (`vue/max-lines-per-block`).
// Files that were already longer are frozen in `.file-size-allow`, one line per file
// (`<ceiling> <path> <issue>`, the ceiling being the file's exact size), and that list, like ESLint's bulk
// suppressions, can only shrink.
const SCRIPT_LIMITS = { production: 300, test: 500 };
const OTHER_LIMITS = { production: 1000, test: 1500 };
const LIMITS: Record<string, { production: number; test: number }> = {
  ".ts": SCRIPT_LIMITS,
  ".tsx": SCRIPT_LIMITS,
  ".js": SCRIPT_LIMITS,
  ".mjs": SCRIPT_LIMITS,
  ".cjs": SCRIPT_LIMITS,
  ".sh": { production: 100, test: 1500 },
  ".css": OTHER_LIMITS,
  ".html": OTHER_LIMITS,
};
const TEST_FILE = /\.(?:test|spec)\.[^/]+$|(?:^|\/)(?:__tests__|e2e)\//;
const ALLOW_LIST = ".file-size-allow";
const ALLOW_LINE = /^(\d+) (\S+) (#\d+)$/;
const THIS_TEST = "src/file-size.test.ts";


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

function exceptionProblems({ path, ceiling }: Exception, lines: number | undefined): string[] {
  if (lines === undefined) return [`${path}: listed in ${ALLOW_LIST} but no such code file; remove its line`];
  const limit = limitFor(path);
  if (lines <= limit) return [`${path}: ${lines} lines fit under the ${limit}-line limit; remove its line from ${ALLOW_LIST}`];
  if (lines > ceiling) return [`${path}: ${lines} lines, over its ceiling of ${ceiling} in ${ALLOW_LIST}`];
  // The ceiling follows the file down, so the lines someone removes cannot quietly come back.
  if (ceiling > lines) return [`${path}: ${lines} lines; lower its ceiling in ${ALLOW_LIST} from ${ceiling} to ${lines}`];
  return [];
}

function sizeProblems(sizes: Map<string, number>, exceptions: Exception[]): string[] {
  const listed = new Set(exceptions.map(({ path }) => path));
  const unlisted = [...sizes].flatMap(([path, lines]) =>
    !listed.has(path) && lines > limitFor(path) ? [`${path}: ${lines} lines, over the ${limitFor(path)}-line limit`] : [],
  );
  return [...unlisted, ...exceptions.flatMap((exception) => exceptionProblems(exception, sizes.get(exception.path)))];
}

/**
 * The exception list may not gain a file or raise a ceiling against the main branch. The one way in is the
 * change that lowers a limit: a file main already had over it enters at its size there, at most.
 */
function allowListGrowth(current: Exception[], base: Exception[], sizesOnMain: Map<string, number>): string[] {
  const before = new Map(base.map(({ path, ceiling }) => [path, ceiling]));
  return current.flatMap(({ path, ceiling }) => {
    const previous = before.get(path) ?? overLimitOnMain(path, sizesOnMain);
    if (previous === undefined) return [`${path}: a new exception in ${ALLOW_LIST}; split the file instead`];
    return ceiling > previous ? [`${path}: its ceiling in ${ALLOW_LIST} rises from ${previous} to ${ceiling}`] : [];
  });
}

function overLimitOnMain(path: string, sizesOnMain: Map<string, number>): number | undefined {
  const lines = sizesOnMain.get(path);
  return lines !== undefined && isMeasured(path) && lines > limitFor(path) ? lines : undefined;
}

/** The lines each of `paths` had at `revision`, leaving out those it did not have. */
function sizesAt(revision: string, paths: string[]): Map<string, number> {
  return new Map(
    paths.flatMap((path) => {
      const text = gitIfAny(["show", `${revision}:${path}`]);
      return text === undefined ? [] : [[path, lineCount(text)] as const];
    }),
  );
}

function codeFileSizes(): Map<string, number> {
  const measured = versionedFiles().filter(isMeasured);
  return new Map(measured.map((path) => [path, lineCount(readFileSync(join(REPO_ROOT, path), "utf8"))]));
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
    expect(parseAllowList("# a note\n569 src/a.ts #150\n\n1503 src/b.test.ts #151\n")).toEqual([
      { ceiling: 569, path: "src/a.ts", issue: "#150" },
      { ceiling: 1503, path: "src/b.test.ts", issue: "#151" },
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

  it("measures the versioned code files, this one included, and leaves lockfiles and Markdown out", { timeout: 60_000 }, () => {
    const paths = [...codeFileSizes().keys()];
    expect(paths).toContain(THIS_TEST);
    expect(paths).toContain("src/shell/theme/polish.css");
    expect(paths).not.toContain("src/components/DataTable/DataTable.vue");
    expect(paths).not.toContain("pnpm-lock.yaml");
    expect(paths).not.toContain("package.json");
    expect(paths.filter((path) => path.endsWith(".md"))).toEqual([]);
  });

  it("every code file fits under its limit, or under its ceiling in .file-size-allow", { timeout: 60_000 }, () => {
    const exceptions = parseAllowList(readRepoFile(ALLOW_LIST) ?? "");
    expect(sizeProblems(codeFileSizes(), exceptions)).toEqual([]);
  });

  it("the exception list only shrinks against the main branch", { timeout: 60_000 }, (context) => {
    const base = baseRevision();
    // Only the change that brings this test in has a base without it: there is nothing to compare yet.
    // Once the test is on main, a base without the list counts as an empty one.
    if (gitIfAny(["cat-file", "-e", `${base}:${THIS_TEST}`]) === undefined) {
      context.skip(`${base.slice(0, 7)} predates this test`);
    }
    const exceptions = parseAllowList(readRepoFile(ALLOW_LIST) ?? "");
    const baseExceptions = parseAllowList(gitIfAny(["show", `${base}:${ALLOW_LIST}`]) ?? "");
    const sizesOnMain = sizesAt(base, exceptions.map(({ path }) => path));
    expect(allowListGrowth(exceptions, baseExceptions, sizesOnMain)).toEqual([]);
  });
});
