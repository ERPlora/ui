// gh:hub#438: before the shell leaves a screen for a fresh document, it asks whether the server answers at all. A
// flaky network can leave the browser «online» (hub#2489), and a fresh document there is the browser's error page.
import { afterEach, describe, expect, it, vi } from "vitest";

import { serverAnswers } from "./reachability";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("serverAnswers", () => {
  it("is true when the server answers, whatever the status (a 404 is the server saying the file is gone)", async () => {
    const check = vi.fn(async () => ({ status: 404 }) as Response);
    vi.stubGlobal("fetch", check);
    await expect(serverAnswers("/static/spa/assets/A-1.js", 5000)).resolves.toBe(true);
    expect(check).toHaveBeenCalledWith("/static/spa/assets/A-1.js", { method: "HEAD", cache: "no-store" });
  });

  it("is false when the network does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(serverAnswers("/static/spa/assets/A-1.js", 5000)).resolves.toBe(false);
  });

  it("is false once the wait is over: a request that hangs never holds the person for ever", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    let result: boolean | undefined;
    void serverAnswers("/static/spa/assets/A-1.js", 3000).then((answer) => (result = answer));
    await vi.advanceTimersByTimeAsync(2999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe(false);
  });
});
