import { describe, expect, it } from "vitest";
import config from "./eslint.config.js";

const RESTRICTED = ["fetch", "EventSource", "WebSocket", "XMLHttpRequest"];

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
});
