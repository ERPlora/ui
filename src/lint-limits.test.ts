// @vitest-environment node
import { describe, expect, it } from "vitest";

import { baseRevision, gitIfAny, readRepoFile, readSuppressions, SUPPRESSIONS, versionedFiles } from "./__tests__/repo-files";
import type { Suppressions } from "./__tests__/repo-files";

// The function limits and the Vue block limit are ESLint's. What already broke them is frozen in
// eslint-suppressions.json, which only shrinks, and no comment in the code may switch them off.
const LINTED_FILE = /\.(?:ts|tsx|js|mjs|cjs|vue)$/;
const ESLINT_CONFIG = "eslint.config.js";
// The rules that keep a function or a Vue block small, which no comment in the code may switch off.
const LIMIT_RULES = new Set(["complexity", "max-depth", "max-params", "max-lines-per-function", "vue/max-lines-per-block"]);
// `eslint-disable[-line|-next-line] <rules> -- <reason>` or `eslint <rule>: <options>`, in any kind of comment.
const DIRECTIVE = /(?:\/\/|\/\*|<!--)\s*(eslint(?:-disable(?:-next-line|-line)?)?)(?![\w-])(.*)/;
const DIRECTIVE_END = /\s--\s|\*\/|-->/;
const CONFIGURED_RULE = /([@\w/-]+)["']?\s*:/g;

type Configs = { current: string; base: string };

/**
 * ESLint suppressions may not gain a file, a rule or a count against the main branch, except for a rule this
 * branch's config turns on and main's does not name yet: that change freezes what breaks the rule today.
 */
function suppressionGrowth(current: Suppressions, base: Suppressions, configs: Configs): string[] {
  const turnedOn = (rule: string) => configs.current.includes(rule) && !configs.base.includes(rule);
  return Object.entries(current).flatMap(([path, rules]) =>
    Object.entries(rules).flatMap(([rule, { count }]) => {
      const previous = base[path]?.[rule]?.count ?? 0;
      return count > previous && !turnedOn(rule)
        ? [`${path}: ${rule} suppressed ${count} times in ${SUPPRESSIONS}, ${previous} before`]
        : [];
    }),
  );
}


/** The comments that switch a limit off, or loosen it, as `<line>: <directive>`. */
function silencedLimits(text: string): string[] {
  return text.split("\n").flatMap((line, index) => {
    const match = DIRECTIVE.exec(line);
    if (!match) return [];
    const [, kind, rest] = match;
    const body = rest.split(DIRECTIVE_END)[0].trim();
    return silencesALimit(kind, body) ? [`${index + 1}: ${`${kind} ${body}`.trim()}`] : [];
  });
}

/** A directive that names no rule switches them all off, the limits included. */
function silencesALimit(kind: string, body: string): boolean {
  if (kind === "eslint") return [...body.matchAll(CONFIGURED_RULE)].some(([, rule]) => LIMIT_RULES.has(rule));
  const rules = body.split(",").map((rule) => rule.trim()).filter(Boolean);
  return rules.length === 0 || rules.some((rule) => LIMIT_RULES.has(rule));
}

function lintedFiles(): string[] {
  return versionedFiles().filter((path) => LINTED_FILE.test(path));
}

describe("lint limits", () => {
  it("flags ESLint suppressions that gain a file, a rule or a count, and lets them shrink", () => {
    const base = { "src/a.ts": { complexity: { count: 2 } } };
    expect(suppressionGrowth({ "src/a.ts": { complexity: { count: 1 } } }, base, { current: "", base: "" })).toEqual([]);
    expect(
      suppressionGrowth(
        {
          "src/a.ts": { complexity: { count: 3 }, "max-params": { count: 1 } },
          "src/b.ts": { "max-depth": { count: 1 } },
        },
        base,
        { current: "", base: "" },
      ),
    ).toEqual([
      "src/a.ts: complexity suppressed 3 times in eslint-suppressions.json, 2 before",
      "src/a.ts: max-params suppressed 1 times in eslint-suppressions.json, 0 before",
      "src/b.ts: max-depth suppressed 1 times in eslint-suppressions.json, 0 before",
    ]);
  });

  it("lets the change that turns a rule on freeze what breaks it today, and holds it to shrinking afterwards", () => {
    const config = 'rules: { complexity: ["error", 15], "vue/max-lines-per-block": ["error", { script: 300 }] }';
    const baseConfig = 'rules: { complexity: ["error", 15] }';
    const current = {
      "src/a.vue": { "vue/max-lines-per-block": { count: 2 }, complexity: { count: 1 } },
      "src/b.ts": { "@typescript-eslint/no-explicit-any": { count: 1 } },
    };
    expect(suppressionGrowth(current, {}, { current: config, base: baseConfig })).toEqual([
      "src/a.vue: complexity suppressed 1 times in eslint-suppressions.json, 0 before",
      "src/b.ts: @typescript-eslint/no-explicit-any suppressed 1 times in eslint-suppressions.json, 0 before",
    ]);
    expect(suppressionGrowth(current, {}, { current: config, base: config })).toEqual([
      "src/a.vue: vue/max-lines-per-block suppressed 2 times in eslint-suppressions.json, 0 before",
      "src/a.vue: complexity suppressed 1 times in eslint-suppressions.json, 0 before",
      "src/b.ts: @typescript-eslint/no-explicit-any suppressed 1 times in eslint-suppressions.json, 0 before",
    ]);
  });

  it("finds the comments that switch a size or function limit off, or loosen it", () => {
    // Built from pieces so that this file's own examples are not read as comments of the repository.
    const [line, block, html] = ["/" + "/", "/" + "*", "<" + "!--"];
    const code = [
      `${line} eslint-disable-next-line complexity`,
      `run(); ${line} eslint-disable-line no-console, max-params`,
      `${block} eslint-disable vue/max-lines-per-block -- frozen */`,
      `${html} eslint-disable vue/max-lines-per-block -->`,
      `${block} eslint-disable */`,
      `${line} eslint-disable-next-line`,
      `${block} eslint max-lines-per-function: ["error", 500] */`,
      `${block} eslint-disable vue/one-component-per-file -- small harness components */`,
      `${line} eslint-disable-next-line @typescript-eslint/no-explicit-any`,
      `${html} eslint-disable vue/multi-word-component-names -- the name the pages ask for -->`,
      `${block} eslint-env node */`,
      `${line} eslint-enable complexity`,
      `${line} see https:${line}eslint.org/docs/latest/rules/complexity`,
    ].join("\n");
    expect(silencedLimits(code)).toEqual([
      "1: eslint-disable-next-line complexity",
      "2: eslint-disable-line no-console, max-params",
      "3: eslint-disable vue/max-lines-per-block",
      "4: eslint-disable vue/max-lines-per-block",
      "5: eslint-disable",
      "6: eslint-disable-next-line",
      '7: eslint max-lines-per-function: ["error", 500]',
    ]);
  });

  // These read every file of the repository or ask git, which takes seconds on a busy machine.

  // These read every file of the repository or ask git, which takes seconds on a busy machine.
  it("no comment in the code switches a size or function limit off, or loosens it", { timeout: 60_000 }, () => {
    const found = lintedFiles().flatMap((path) => silencedLimits(readRepoFile(path) ?? "").map((at) => `${path}:${at}`));
    expect(found).toEqual([]);
  });

  it("every file with ESLint suppressions exists, because ESLint never reports those of a missing file", () => {
    expect(Object.keys(readSuppressions()).filter((path) => readRepoFile(path) === undefined)).toEqual([]);
  });

  it("the ESLint suppressions only shrink against the main branch", { timeout: 60_000 }, () => {
    const base = baseRevision();
    // A base without the suppressions, or without the config, counts as an empty one.
    const baseSuppressions: Suppressions = JSON.parse(gitIfAny(["show", `${base}:${SUPPRESSIONS}`]) ?? "{}");
    const configs = { current: readRepoFile(ESLINT_CONFIG) ?? "", base: gitIfAny(["show", `${base}:${ESLINT_CONFIG}`]) ?? "" };
    expect(suppressionGrowth(readSuppressions(), baseSuppressions, configs)).toEqual([]);
  });
});
