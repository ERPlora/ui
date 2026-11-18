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

  it("fails a Vue block past its limit, blank lines included: template 250, script 300 and style 150", async () => {
    const path = "src/components/Long/Long.vue";
    expect(await longBlocks(vueComponent({ template: 250, script: 300, style: 150 }), path)).toEqual([]);
    expect(await longBlocks(vueComponent({ template: 251, script: 301, style: 151 }), path)).toEqual([
      "template",
      "script",
      "style",
    ]);
  });

  it.each([".githooks/pre-push.test.sh", "scripts/release.spec.sh", "src/theme.test.css"])(
    "does not try to parse %s as JavaScript because its name looks like a test",
    async (file) => {
      expect(await new ESLint({ cwd: REPO_ROOT }).isPathIgnored(file)).toBe(true);
    },
  );
});

/** The blocks of a Vue component the lint fails as too long, in the order they appear. */
async function longBlocks(code: string, filePath: string): Promise<string[]> {
  const [result] = await new ESLint({ cwd: REPO_ROOT }).lintText(code, { filePath });
  const blocks = result.messages.filter((message) => message.ruleId === "vue/max-lines-per-block");
  expect(blocks.every((message) => message.severity === 2), JSON.stringify(blocks)).toBe(true);
  return blocks.map((message) => code.split("\n")[message.line - 1].replace(/^<(\w+).*$/, "$1"));
}

/** `count` lines, every other one blank. */
function lines(count: number, text: (n: number) => string): string {
  return Array.from({ length: count }, (_, n) => (n % 2 ? "" : text(n))).join("\n");
}

/** A Vue component whose blocks hold the given number of lines between their opening and closing tags. */
function vueComponent(blocks: { template: number; script: number; style: number }): string {
  return [
    `<template>\n${lines(blocks.template, (n) => `  <p>${n}</p>`)}\n</template>`,
    `<script setup lang="ts">\n${lines(blocks.script, (n) => `const line${n} = ${n};`)}\n</script>`,
    `<style scoped>\n${lines(blocks.style, (n) => `.line${n} { order: ${n}; }`)}\n</style>`,
    "",
  ].join("\n");
}
