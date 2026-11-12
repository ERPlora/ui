// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Code is read by people who have never seen the planning documents, so a comment, a test name or a
// log line must not send them to one: no section signs, no dated decision rounds, no work slices.
const PLANNING_REFERENCE =
  /§ ?[0-9]|(Plan|PLAN)(-[A-Z]+)?(\.md)? ?§|[Rr](onda|ound) [0-9]{4}-[0-9]{2}|[Tt]ajada S?[0-9]/;

// A section of an external standard is a citation the reader can look up, not internal planning.
const EXTERNAL_STANDARD_SECTION = /\bRFC \d+ §\d+/g;

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

function findPlanningReferences(text: string): number[] {
  return text.split("\n").flatMap((line, index) =>
    PLANNING_REFERENCE.test(line.replace(EXTERNAL_STANDARD_SECTION, "")) ? [index + 1] : [],
  );
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

  it("lists the versioned code files, which include this one and leave the Markdown documents out", () => {
    const files = versionedCodeFiles();
    expect(files).toContain("package.json");
    expect(files).toContain("src/no-planning-references.test.ts");
    expect(files.filter((path) => path.endsWith(".md"))).toEqual([]);
  });

  it("no versioned code file refers to a planning document", () => {
    const offending = versionedCodeFiles().flatMap((path) => {
      const content = readFileSync(join(REPO_ROOT, path));
      if (content.includes(0)) return [];
      return findPlanningReferences(content.toString("utf8")).map((line) => `${path}:${line}`);
    });
    expect(offending).toEqual([]);
  });
});
