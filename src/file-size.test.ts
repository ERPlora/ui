// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// A person has to be able to hold a file in their head: production code stops at 1,000 physical lines
// and a test file at 1,500. Files that were already longer are frozen in `.file-size-allow`, one line
// per file (`<ceiling> <path> <issue>`), and that list, like ESLint's bulk suppressions of the function
// limits, can only shrink.
const LIMITS = { production: 1000, test: 1500 } as const;
const CODE_FILE = /\.(?:ts|tsx|js|mjs|cjs|vue|css|html|sh)$/;
const TEST_FILE = /\.(?:test|spec)\.[^/]+$|(?:^|\/)(?:__tests__|e2e)\//;
const ALLOW_LIST = ".file-size-allow";
const ALLOW_LINE = /^(\d+) (\S+) (#\d+)$/;
const SUPPRESSIONS = "eslint-suppressions.json";
const THIS_TEST = "src/file-size.test.ts";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

type Exception = { ceiling: number; path: string; issue: string };
type Suppressions = Record<string, Record<string, { count: number }>>;

function lineCount(text: string): number {
  if (text === "") return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function limitFor(path: string): number {
  return TEST_FILE.test(path) ? LIMITS.test : LIMITS.production;
}

function parseAllowList(text: string): Exception[] {
  const seen = new Set<string>();
  return text.split("\n").flatMap((line, index) => {
    if (line.trim() === "") return [];
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
  return [];
}

function sizeProblems(sizes: Map<string, number>, exceptions: Exception[]): string[] {
  const listed = new Set(exceptions.map(({ path }) => path));
  const unlisted = [...sizes].flatMap(([path, lines]) =>
    !listed.has(path) && lines > limitFor(path) ? [`${path}: ${lines} lines, over the ${limitFor(path)}-line limit`] : [],
  );
  return [...unlisted, ...exceptions.flatMap((exception) => exceptionProblems(exception, sizes.get(exception.path)))];
}

function allowListGrowth(current: Exception[], base: Exception[]): string[] {
  const before = new Map(base.map(({ path, ceiling }) => [path, ceiling]));
  return current.flatMap(({ path, ceiling }) => {
    const previous = before.get(path);
    if (previous === undefined) return [`${path}: a new exception in ${ALLOW_LIST}; split the file instead`];
    return ceiling > previous ? [`${path}: its ceiling in ${ALLOW_LIST} rises from ${previous} to ${ceiling}`] : [];
  });
}

function suppressionGrowth(current: Suppressions, base: Suppressions): string[] {
  return Object.entries(current).flatMap(([path, rules]) =>
    Object.entries(rules).flatMap(([rule, { count }]) => {
      const previous = base[path]?.[rule]?.count ?? 0;
      return count > previous ? [`${path}: ${rule} suppressed ${count} times in ${SUPPRESSIONS}, ${previous} before`] : [];
    }),
  );
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** `git` that answers undefined when git refuses, for a revision or a path that may not exist. */
function gitIfAny(...args: string[]): string | undefined {
  try {
    return git(...args);
  } catch {
    return undefined;
  }
}

function originMain(): string | undefined {
  return gitIfAny("rev-parse", "--verify", "--quiet", "origin/main^{commit}")?.trim();
}

// The lists are compared with the main branch the work starts from: the merge base of HEAD and
// origin/main, or origin/main itself in a shallow clone, where no merge base can be found. A GitHub
// Actions checkout fetches only the commit under test, so there the test fetches main first; anywhere
// else a missing origin/main fails the test instead of skipping the comparison.
function baseRevision(): string {
  if (!originMain() && process.env.GITHUB_ACTIONS === "true") {
    git("fetch", "--quiet", "--no-tags", "--depth=1", "origin", "+refs/heads/main:refs/remotes/origin/main");
  }
  const main = originMain();
  if (!main) throw new Error("origin/main is missing, so the exception lists cannot be compared: run `git fetch origin main`");
  return gitIfAny("merge-base", "HEAD", main)?.trim() || main;
}

function readRepoFile(path: string): string | undefined {
  const absolute = join(REPO_ROOT, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
}

function codeFileSizes(): Map<string, number> {
  const listed = git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0");
  const sizes = new Map<string, number>();
  for (const path of new Set(listed)) {
    const absolute = join(REPO_ROOT, path);
    if (!CODE_FILE.test(path) || !existsSync(absolute) || !statSync(absolute).isFile()) continue;
    sizes.set(path, lineCount(readFileSync(absolute, "utf8")));
  }
  return sizes;
}

describe("file size", () => {
  it("counts physical lines, with or without a final newline", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount("a")).toBe(1);
    expect(lineCount("a\n")).toBe(1);
    expect(lineCount("a\n\nb\n")).toBe(3);
    expect(lineCount("a\nb")).toBe(2);
  });

  it("holds test files to 1,500 lines and every other code file to 1,000", () => {
    for (const path of ["src/a.test.ts", "src/b.spec.ts", "src/c/__tests__/harness.ts", "e2e/login.ts", "src/e2e/x.ts"]) {
      expect(limitFor(path), path).toBe(1500);
    }
    for (const path of ["src/components/A.vue", "src/testing/index.ts", "src/shell/theme.css", "eslint.config.js"]) {
      expect(limitFor(path), path).toBe(1000);
    }
  });

  it("flags an unlisted file over its limit, and not one exactly at it", () => {
    const sizes = new Map([
      ["src/big.ts", 1001],
      ["src/edge.ts", 1000],
      ["src/big.test.ts", 1501],
      ["src/edge.test.ts", 1500],
    ]);
    expect(sizeProblems(sizes, [])).toEqual([
      "src/big.ts: 1001 lines, over the 1000-line limit",
      "src/big.test.ts: 1501 lines, over the 1500-line limit",
    ]);
  });

  it("flags a listed file over its ceiling, one that fits again and one that no longer exists", () => {
    const sizes = new Map([
      ["src/grown.vue", 2401],
      ["src/kept.vue", 2400],
      ["src/split.vue", 990],
    ]);
    const exceptions = [
      { ceiling: 2400, path: "src/grown.vue", issue: "#1" },
      { ceiling: 2400, path: "src/kept.vue", issue: "#1" },
      { ceiling: 2400, path: "src/split.vue", issue: "#1" },
      { ceiling: 1600, path: "src/gone.test.ts", issue: "#2" },
    ];
    expect(sizeProblems(sizes, exceptions)).toEqual([
      "src/grown.vue: 2401 lines, over its ceiling of 2400 in .file-size-allow",
      "src/split.vue: 990 lines fit under the 1000-line limit; remove its line from .file-size-allow",
      "src/gone.test.ts: listed in .file-size-allow but no such code file; remove its line",
    ]);
  });

  it("reads one `<ceiling> <path> <issue>` line per file and rejects anything else", () => {
    expect(parseAllowList("2400 src/a.vue #150\n\n1600 src/b.test.ts #151\n")).toEqual([
      { ceiling: 2400, path: "src/a.vue", issue: "#150" },
      { ceiling: 1600, path: "src/b.test.ts", issue: "#151" },
    ]);
    expect(() => parseAllowList("2400 src/a.vue")).toThrow(".file-size-allow:1:");
    expect(() => parseAllowList("src/a.vue 2400 #150")).toThrow(".file-size-allow:1:");
    expect(() => parseAllowList("2400 src/a.vue #150\n2500 src/a.vue #150")).toThrow("src/a.vue is listed twice");
  });

  it("flags an exception list that gains a file or raises a ceiling, and lets it shrink", () => {
    const base = [
      { ceiling: 2400, path: "src/a.vue", issue: "#1" },
      { ceiling: 1600, path: "src/b.test.ts", issue: "#2" },
    ];
    expect(allowListGrowth([{ ceiling: 2300, path: "src/a.vue", issue: "#1" }], base)).toEqual([]);
    expect(
      allowListGrowth(
        [
          { ceiling: 2500, path: "src/a.vue", issue: "#1" },
          { ceiling: 1100, path: "src/new.ts", issue: "#3" },
        ],
        base,
      ),
    ).toEqual([
      "src/a.vue: its ceiling in .file-size-allow rises from 2400 to 2500",
      "src/new.ts: a new exception in .file-size-allow; split the file instead",
    ]);
  });

  it("flags ESLint suppressions that gain a file, a rule or a count, and lets them shrink", () => {
    const base = { "src/a.ts": { complexity: { count: 2 } } };
    expect(suppressionGrowth({ "src/a.ts": { complexity: { count: 1 } } }, base)).toEqual([]);
    expect(
      suppressionGrowth(
        {
          "src/a.ts": { complexity: { count: 3 }, "max-params": { count: 1 } },
          "src/b.ts": { "max-depth": { count: 1 } },
        },
        base,
      ),
    ).toEqual([
      "src/a.ts: complexity suppressed 3 times in eslint-suppressions.json, 2 before",
      "src/a.ts: max-params suppressed 1 times in eslint-suppressions.json, 0 before",
      "src/b.ts: max-depth suppressed 1 times in eslint-suppressions.json, 0 before",
    ]);
  });

  // These read every file of the repository or ask git, which takes seconds on a busy machine.
  it("measures the versioned code files, this one included, and leaves lockfiles and Markdown out", { timeout: 60_000 }, () => {
    const paths = [...codeFileSizes().keys()];
    expect(paths).toContain(THIS_TEST);
    expect(paths).toContain("src/components/DataTable/DataTable.vue");
    expect(paths).not.toContain("pnpm-lock.yaml");
    expect(paths).not.toContain("package.json");
    expect(paths.filter((path) => path.endsWith(".md"))).toEqual([]);
  });

  it("every code file fits under its limit, or under its ceiling in .file-size-allow", { timeout: 60_000 }, () => {
    const exceptions = parseAllowList(readRepoFile(ALLOW_LIST) ?? "");
    expect(sizeProblems(codeFileSizes(), exceptions)).toEqual([]);
  });

  it("every file with ESLint suppressions exists, because ESLint never reports those of a missing file", () => {
    const suppressions: Suppressions = JSON.parse(readRepoFile(SUPPRESSIONS) ?? "{}");
    expect(Object.keys(suppressions).filter((path) => readRepoFile(path) === undefined)).toEqual([]);
  });

  it("the exception list and the ESLint suppressions only shrink against the main branch", { timeout: 60_000 }, (context) => {
    const base = baseRevision();
    // Only the change that brings this test in has a base without it: there is nothing to compare yet.
    // Once the test is on main, a base without one of the lists counts as an empty list.
    if (gitIfAny("cat-file", "-e", `${base}:${THIS_TEST}`) === undefined) {
      context.skip(`${base.slice(0, 7)} predates this test`);
    }
    const baseAllowList = gitIfAny("show", `${base}:${ALLOW_LIST}`);
    const baseSuppressions = gitIfAny("show", `${base}:${SUPPRESSIONS}`);
    const growth = [
      ...allowListGrowth(parseAllowList(readRepoFile(ALLOW_LIST) ?? ""), parseAllowList(baseAllowList ?? "")),
      ...suppressionGrowth(JSON.parse(readRepoFile(SUPPRESSIONS) ?? "{}"), JSON.parse(baseSuppressions ?? "{}")),
    ];
    expect(growth).toEqual([]);
  });
});
