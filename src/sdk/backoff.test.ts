import { describe, expect, it } from "vitest";
import { backoffDelay, MAX_BACKOFF_MS } from "./backoff";

const noJitter = (): number => 0;

describe("backoffDelay", () => {
  it("starts at the base delay and doubles on each attempt", () => {
    expect(backoffDelay(0, 3000, noJitter)).toBe(3000);
    expect(backoffDelay(1, 3000, noJitter)).toBe(6000);
    expect(backoffDelay(2, 3000, noJitter)).toBe(12000);
    expect(backoffDelay(3, 3000, noJitter)).toBe(24000);
  });

  it("is capped at 30 seconds", () => {
    expect(MAX_BACKOFF_MS).toBe(30000);
    expect(backoffDelay(4, 3000, noJitter)).toBe(30000);
    expect(backoffDelay(60, 3000, noJitter)).toBe(30000);
    expect(backoffDelay(0, 90000, noJitter)).toBe(30000);
  });

  it("removes up to 20% as jitter, never exceeding the cap", () => {
    expect(backoffDelay(0, 3000, () => 0.5)).toBe(2700);
    expect(backoffDelay(10, 3000, () => 0.999)).toBeGreaterThanOrEqual(24000);
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const d = backoffDelay(10, 3000, () => r);
      expect(d).toBeLessThanOrEqual(30000);
      expect(d).toBeGreaterThan(24000 - 1);
    }
  });

  it("uses a sane base when the server sends zero or a negative retry", () => {
    expect(backoffDelay(0, 0, noJitter)).toBe(3000);
    expect(backoffDelay(0, -5, noJitter)).toBe(3000);
  });
});
