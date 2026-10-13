import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

describe("@ionic/vue patch (hub#2242)", () => {
  it("is applied to the installed dist/index.js", () => {
    const require = createRequire(import.meta.url);
    const pkgDir = dirname(require.resolve("@ionic/vue/package.json"));
    const source = readFileSync(join(pkgDir, "dist/index.js"), "utf8");
    expect(source).toContain("ERPlora hub#2242");
    expect(source).toContain("pageTransitionTail");
  });
});
