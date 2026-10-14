import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import config from "./vitest.config";

function plugins(): Plugin[] {
  return ((config.plugins ?? []) as unknown[]).flat(Infinity).filter(Boolean) as Plugin[];
}

describe("vitest config", () => {
  it("uses the happy-dom environment", () => {
    expect(config.test?.environment).toBe("happy-dom");
  });
  it("runs every test file in a happy-dom with the browser behaviour Ionic relies on (src/testing/happyDom.ts)", () => {
    expect(config.test?.setupFiles).toEqual(["./vitest.setup.ts"]);
  });
  it("includes src tests", () => {
    expect(config.test?.include).toContain("src/**/*.test.ts");
  });
  it("compiles .vue files and bakes icons with the plugins every project builds with (erploraVite)", () => {
    const names = plugins().map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["vite:vue", "unplugin-icons"]));
  });
  it("compiles every tag as a Vue component: no custom-element escape hatch (PLAN §16.11)", () => {
    const vue = plugins().find((p) => p.name === "vite:vue") as
      | { api?: { options?: { template?: { compilerOptions?: { isCustomElement?: unknown } } } } }
      | undefined;
    expect(vue?.api?.options?.template?.compilerOptions?.isCustomElement).toBeUndefined();
  });
});
