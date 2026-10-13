import { describe, expect, it } from "vitest";
import config from "./vitest.config";

describe("vitest config", () => {
  it("uses the happy-dom environment", () => {
    expect(config.test?.environment).toBe("happy-dom");
  });
  it("includes src tests", () => {
    expect(config.test?.include).toContain("src/**/*.test.ts");
  });
});
