// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse as parseSfc } from "vue/compiler-sfc";

// Code is read by people who have never seen the planning documents, so a comment, a test name or a
// log line must not send them to one: no section signs, no dated decision rounds, no work slices.
const PLANNING_REFERENCE =
  /§ ?[0-9]|(Plan|PLAN)(-[A-Z]+)?(\.md)? ?§|[Rr](onda|ound) [0-9]{4}-[0-9]{2}|[Tt]ajada S?[0-9]/;

// A section of an external standard is a citation the reader can look up, not internal planning.
const EXTERNAL_STANDARD_SECTION = /\bRFC \d+ §\d+/g;

// Nor to internal bookkeeping a reader cannot look up: the ids of tasks, audit findings and flows, an
// issue of another repository or of a private tracker, or a folder name that no longer exists.
const INTERNAL_REFERENCE = new RegExp(
  [
    String.raw`\b[A-Z]-[0-9]{2}\b`,
    String.raw`\bL[0-9]-[A-Z]\b`,
    String.raw`\bFIX-[A-Z0-9]`,
    String.raw`\bUX[- ](?:AUDIT|audit)\b`,
    String.raw`\bAPP-[A-Z]+\b`,
    String.raw`\bBASE-[A-Z][0-9]+\b`,
    String.raw`\b[A-Z][A-Z_]*-F[0-9]{2}\b`,
    String.raw`\b(?:hub|saas|outfitkit|pm|knowledge)#[0-9]+`,
    String.raw`\b(?:hub|saas)-next\b`,
    String.raw`\bADR-[0-9]{3,4}\b`,
    String.raw`\bPoC issue\b`,
  ].join("|"),
);

// Only what a person reads as an explanation is held to that: comments and test names. Test data is
// code and keeps its values, such as the made-up project paths of `src/vite.test.ts`.
const TEST_CALLEE = /^(?:describe|it|test)(?:\.\w+)*$/;
const TABLE_TEST_CALLEE = /^(?:describe|it|test)(?:\.\w+)*\.each$/;

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

type Note = { line: number; text: string };

function findPlanningReferences(text: string): number[] {
  return text.split("\n").flatMap((line, index) =>
    PLANNING_REFERENCE.test(line.replace(EXTERNAL_STANDARD_SECTION, "")) ? [index + 1] : [],
  );
}

/** The 1-based line of each offset of `text`, in O(log n) per offset. */
function lineFinder(text: string): (offset: number) => number {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}

function matchNotes(text: string, pattern: RegExp, firstLine = 1): Note[] {
  const lineAt = lineFinder(text);
  return [...text.matchAll(pattern)].map((m) => ({ line: firstLine + lineAt(m.index) - 1, text: m[0] }));
}

function scriptNotes(code: string, fileName: string, firstLine = 1): Note[] {
  const kind = /\.(?:js|mjs|cjs)$/.test(fileName) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, kind);
  const lineAt = lineFinder(code);
  const notes = new Map<number, Note>();
  const at = (pos: number, text: string) => notes.set(pos, { line: firstLine + lineAt(pos) - 1, text });
  const comments = (ranges: ts.CommentRange[] | undefined) =>
    ranges?.forEach((range) => at(range.pos, code.slice(range.pos, range.end)));
  const visit = (node: ts.Node) => {
    comments(ts.getLeadingCommentRanges(code, node.getFullStart()));
    comments(ts.getTrailingCommentRanges(code, node.getEnd()));
    const callee = ts.isCallExpression(node) ? node.expression : undefined;
    const isTest =
      callee !== undefined &&
      (TEST_CALLEE.test(callee.getText(source)) ||
        (ts.isCallExpression(callee) && TABLE_TEST_CALLEE.test(callee.expression.getText(source))));
    if (ts.isCallExpression(node) && isTest) {
      const [name] = node.arguments;
      if (name && (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) || ts.isTemplateExpression(name))) {
        at(name.getStart(source), name.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  comments(ts.getLeadingCommentRanges(code, source.endOfFileToken.getFullStart()));
  return [...notes.values()];
}

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HASH_COMMENT = /(?:^|[ \t])#.*$/gm;

function explanatoryNotes(path: string, text: string): Note[] {
  if (/\.(?:ts|mts|js|mjs|cjs)$/.test(path)) return scriptNotes(text, path);
  if (path.endsWith(".css")) return matchNotes(text, CSS_COMMENT);
  if (path.endsWith(".html")) return [...matchNotes(text, HTML_COMMENT), ...matchNotes(text, CSS_COMMENT)];
  if (path.endsWith(".vue")) {
    const { descriptor } = parseSfc(text, { filename: path });
    const scripts = [descriptor.script, descriptor.scriptSetup].flatMap((block) =>
      block ? scriptNotes(block.content, `${path}.${block.lang ?? "js"}`, block.loc.start.line) : [],
    );
    const template = descriptor.template
      ? matchNotes(descriptor.template.content, HTML_COMMENT, descriptor.template.loc.start.line)
      : [];
    const styles = descriptor.styles.flatMap((style) => matchNotes(style.content, CSS_COMMENT, style.loc.start.line));
    return [...scripts, ...template, ...styles];
  }
  if (path.endsWith(".json")) return [];
  if (/\.ya?ml$/.test(path) || path.endsWith(".gitignore")) return matchNotes(text, HASH_COMMENT);
  return text.split("\n").map((line, index) => ({ line: index + 1, text: line }));
}

function findInternalReferences(path: string, text: string): number[] {
  const lines = explanatoryNotes(path, text).flatMap(({ line, text: note }) =>
    note.split("\n").flatMap((part, index) => (INTERNAL_REFERENCE.test(part) ? [line + index] : [])),
  );
  return [...new Set(lines)].sort((a, b) => a - b);
}

function versionedCodeFiles(): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return [...new Set(listed.split("\0"))].filter((path) => {
    if (!path || path.endsWith(".md")) return false;
    const absolute = join(REPO_ROOT, path);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
}

let readable: { path: string; text: string }[] | undefined;

function readableFiles(): { path: string; text: string }[] {
  readable ??= versionedCodeFiles().flatMap((path) => {
    const content = readFileSync(join(REPO_ROOT, path));
    return content.includes(0) ? [] : [{ path, text: content.toString("utf8") }];
  });
  return readable;
}

describe("code reads on its own, without the planning documents", () => {
  // The examples are assembled at run time so that this file does not trip its own check.
  const sign = "§";
  const year = "2026";

  it("flags section signs, dated rounds and work slices, but not a section of an external standard", () => {
    expect(findPlanningReferences(`// see Plan ${sign}12`)).toEqual([1]);
    expect(findPlanningReferences(`ok\n// PLAN-HUB.md ${sign} intro`)).toEqual([2]);
    expect(findPlanningReferences(`it('works (${sign}3b)')`)).toEqual([1]);
    expect(findPlanningReferences(`// decided in ${"round"} ${year}-11-04a`)).toEqual([1]);
    expect(findPlanningReferences(`/* ${"ronda"} ${year}-10-24b */`)).toEqual([1]);
    expect(findPlanningReferences(`// ${"tajada"} S3 of the cut`)).toEqual([1]);
    expect(findPlanningReferences(`// base64url is unpadded (RFC 4648 ${sign}5).`)).toEqual([]);
    expect(findPlanningReferences(`// RFC 4648 ${sign}5, and Plan ${sign}5`)).toEqual([1]);
    expect(findPlanningReferences("// a plain sentence about rounding prices")).toEqual([]);
  });

  it("flags internal ids, other trackers' issues and old folder names in comments and test names", () => {
    const flagged = [
      "// what fits is decided by the box (W-19)",
      "// the old filter row (FIX-UI-TABBAR-375)",
      "/** measured in the UX audit 2 */",
      "// the project's chrome (APP-BASE-1)",
      "// the old hub's SSE client (BASE-G06)",
      "// the print host (PRINTING-F18)",
      "// a long name is cut on the tile (hub#1106)",
      "// back from a payment (saas#344)",
      "// the server refuses it (outfitkit#116)",
      "// see pm#43 and knowledge#62",
      "// also read by hub-next",
      "// a palette step (L0-C)",
      "/* the tap target in ios mode (ADR-0143) */",
      "// PoC issue B: the scan read the whole project",
    ];
    for (const comment of flagged) expect(findInternalReferences("src/x.ts", `const a = 1;\n${comment}\n`), comment).toEqual([2]);
    expect(findInternalReferences("src/x.test.ts", "it('pins the floor (hub#1841)', () => {});")).toEqual([1]);
    expect(findInternalReferences("src/x.test.ts", "describe.each([1])('a row %s (R-14)', () => {});")).toEqual([1]);
    expect(findInternalReferences(".github/workflows/test.yml", "on: push\n# runs the suite (hub#12)\n")).toEqual([2]);
    expect(findInternalReferences("src/x.css", ".a { color: red; }\n/* the drawer button (hub#1831) */")).toEqual([2]);
    expect(
      findInternalReferences("src/X.vue", "<template>\n  <!-- hub#1715: always on -->\n  <div />\n</template>\n<script setup lang=\"ts\">\n// kept (saas#272)\nconst a = 1;\n</script>\n"),
    ).toEqual([2, 6]);
    expect(findInternalReferences("patches/some-lib@1.0.0.patch", "+const a = 1;\n+ * one page at a time (hub#2242)\n")).toEqual([2]);
  });

  it("leaves test data, external ids and plain prose alone", () => {
    expect(findInternalReferences("src/vite.test.ts", "const importers = ['/repo/hub-next/frontend/main.ts'];")).toEqual([]);
    expect(findInternalReferences("src/x.test.ts", "const rows = [{ code: 'A-1' }, { session: 'S-2' }];")).toEqual([]);
    expect(findInternalReferences("src/x.ts", "// UTF-8, ISO-8601 and WCAG 2.1 AA; the hub's own menu")).toEqual([]);
    expect(findInternalReferences("src/x.ts", "// the ERPlora/ui issue ui#81 explains the key")).toEqual([]);
  });

  it("lists the versioned code files, which include this one and leave the Markdown documents out", () => {
    const files = versionedCodeFiles();
    expect(files).toContain("package.json");
    expect(files).toContain("src/no-planning-references.test.ts");
    expect(files.filter((path) => path.endsWith(".md"))).toEqual([]);
  });

  // Both read every file of the repository, which takes seconds on a busy machine.
  it("no versioned code file refers to a planning document", { timeout: 60_000 }, () => {
    const offending = readableFiles().flatMap(({ path, text }) =>
      findPlanningReferences(text).map((line) => `${path}:${line}`),
    );
    expect(offending).toEqual([]);
  });

  it("no comment or test name refers to internal bookkeeping", { timeout: 60_000 }, () => {
    const offending = readableFiles().flatMap(({ path, text }) =>
      findInternalReferences(path, text).map((line) => `${path}:${line}`),
    );
    expect(offending).toEqual([]);
  });
});
