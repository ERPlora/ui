// What the repository's own checks read: the files git versions, and the main branch a change starts from.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const SUPPRESSIONS = "eslint-suppressions.json";

export type Suppressions = Record<string, Record<string, { count: number }>>;

export function git(args: string[], root = REPO_ROOT): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** `git` that answers undefined when git refuses, for a revision or a path that may not exist. */
export function gitIfAny(args: string[], root = REPO_ROOT): string | undefined {
  try {
    return git(args, root);
  } catch {
    return undefined;
  }
}

function originMain(): string | undefined {
  return gitIfAny(["rev-parse", "--verify", "--quiet", "origin/main^{commit}"])?.trim();
}

// The lists are compared with the main branch the work starts from: the merge base of HEAD and
// origin/main, or origin/main itself in a shallow clone, where no merge base can be found. A GitHub
// Actions checkout fetches only the commit under test, so there the test fetches main first; anywhere
// else a missing origin/main fails the test instead of skipping the comparison.
export function baseRevision(): string {
  if (!originMain() && process.env.GITHUB_ACTIONS === "true") {
    git(["fetch", "--quiet", "--no-tags", "--depth=1", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
  }
  const main = originMain();
  if (!main) throw new Error("origin/main is missing, so the exception lists cannot be compared: run `git fetch origin main`");
  return gitIfAny(["merge-base", "HEAD", main])?.trim() || main;
}

export function readRepoFile(path: string, root = REPO_ROOT): string | undefined {
  const absolute = join(root, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
}

/** The files git versions, or would once added, that exist on disk. */
export function versionedFiles(root = REPO_ROOT): string[] {
  const listed = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], root).split("\0");
  return [...new Set(listed)].filter((path) => {
    const absolute = join(root, path);
    return path !== "" && existsSync(absolute) && statSync(absolute).isFile();
  });
}

export function readSuppressions(root = REPO_ROOT): Suppressions {
  return JSON.parse(readRepoFile(SUPPRESSIONS, root) ?? "{}");
}
