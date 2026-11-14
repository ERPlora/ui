// @vitest-environment node
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "./eslint.config.js";

const RESTRICTED = ["fetch", "EventSource", "WebSocket", "XMLHttpRequest"];

const REPO_ROOT = fileURLToPath(new URL(".", import.meta.url));

/** The rules ESLint applies to `file` once every entry of the flat config is merged; 2 is "error". */
async function effectiveRules(file: string): Promise<Record<string, unknown[]>> {
  const resolved = await new ESLint({ cwd: REPO_ROOT }).calculateConfigForFile(file);
  return resolved.rules;
}

function functionLimits(rules: Record<string, unknown[]>) {
  return {
    complexity: rules["complexity"],
    "max-depth": rules["max-depth"],
    "max-params": rules["max-params"],
    "max-lines-per-function": rules["max-lines-per-function"],
  };
}

function restrictedNames(file: string): string[] {
  const names: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const entry of config as any[]) {
    const rule = entry.rules?.["no-restricted-globals"];
    if (!rule) continue;
    const ignored: string[] = entry.ignores ?? [];
    if (ignored.some((g) => g === "src/sdk/**") && file.startsWith("src/sdk/")) continue;
    const files: string[] | undefined = entry.files;
    if (files && !files.some((g) => g === "src/sdk/**" ? file.startsWith("src/sdk/") : true)) continue;
    for (const item of rule.slice(1)) names.push(typeof item === "string" ? item : item.name);
  }
  return names;
}

describe("eslint config", () => {
  it("restricts network globals outside the sdk", () => {
    expect(restrictedNames("src/shell/foo.ts")).toEqual(expect.arrayContaining(RESTRICTED));
  });
  it("does not restrict them inside src/sdk", () => {
    expect(restrictedNames("src/sdk/client.ts")).toEqual([]);
  });
  it("allows the Web Components slot= on Ionic elements and on HubIcon, which renders ion-icon (not Vue 2 slot syntax)", () => {
    // Flat config: the LAST entry that sets a rule wins (eslint-plugin-vue's presets set it first).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (config as any[]).filter((e) => e.rules?.["vue/no-deprecated-slot-attribute"]).at(-1);
    expect(entry?.files).toEqual(["**/*.vue"]);
    expect(entry.rules["vue/no-deprecated-slot-attribute"]).toEqual(["error", { ignore: ["/^ion-/", "HubIcon"] }]);
  });

  it.each(["src/sdk/client.ts", "src/components/DataTable/DataTable.vue", "src/testing/index.ts", "eslint.config.js"])(
    "fails %s on a function over the complexity, nesting, parameter or length limit",
    async (file) => {
      expect(functionLimits(await effectiveRules(file))).toEqual({
        complexity: [2, 15],
        "max-depth": [2, 4],
        "max-params": [2, 3],
        "max-lines-per-function": [2, { max: 50, skipBlankLines: true, skipComments: true }],
      });
    },
  );

  it.each([
    "src/components/FormModal/FormModal.test.ts",
    "src/shell/router.spec.ts",
    "src/components/DataTable/__tests__/harness.ts",
    "e2e/login.ts",
  ])("keeps complexity and nesting in the test file %s, but not the parameter or length limits", async (file) => {
    const limits = functionLimits(await effectiveRules(file));
    expect(limits.complexity).toEqual([2, 15]);
    expect(limits["max-depth"]).toEqual([2, 4]);
    // A rule turned off keeps the options merged from earlier entries; 0 is what switches it off.
    expect(limits["max-params"]?.[0]).toBe(0);
    expect(limits["max-lines-per-function"]?.[0]).toBe(0);
  });

  it.each([".githooks/pre-push.test.sh", "scripts/release.spec.sh", "src/theme.test.css"])(
    "does not try to parse %s as JavaScript because its name looks like a test",
    async (file) => {
      expect(await new ESLint({ cwd: REPO_ROOT }).isPathIgnored(file)).toBe(true);
    },
  );
});
