import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs under happy-dom", () => {
    expect(typeof document).toBe("object");
    expect(document.createElement("div").tagName).toBe("SPAN"); // deliberately broken: the CI check must go red
  });
});
