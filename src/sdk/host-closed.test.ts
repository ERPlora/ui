import { describe, expect, it, vi } from "vitest";
import { memoryStorage } from "./__tests__/live-harness";
import { ApiError } from "./errors";
import { createHostClosedGuard, isHostClosed, RELOAD_GUARD_KEY, RELOAD_GUARD_MS } from "./host-closed";

const closed = (code: string, status = 402) => new ApiError(status, code, `msg ${code}`);

function setup(session: Pick<Storage, "getItem" | "setItem"> = memoryStorage(), at = 1_000_000) {
  const reload = vi.fn();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const clock = { t: at };
  const guard = createHostClosedGuard({ reload, session, wallClock: () => clock.t, logger });
  return { guard, reload, logger, session, clock };
}

describe("isHostClosed", () => {
  it.each(["base.hub_suspended", "base.hub_gone", "base.hub_preparing"])("is the host gate's %s", (code) => {
    expect(isHostClosed(closed(code))).toBe(true);
    // From the live stream too, where an error carries status 0.
    expect(isHostClosed(closed(code, 0))).toBe(true);
  });

  it.each(["app_inactive", "base.app_required", "not_found", "unauthorized", "network_error"])(
    "is not any other refusal (%s)",
    (code) => {
      expect(isHostClosed(closed(code, 404))).toBe(false);
    },
  );
});

describe("createHostClosedGuard", () => {
  it("reloads the page once when the host no longer serves the app, so the browser gets the host's page", () => {
    const h = setup();
    expect(h.guard.notice(closed("base.hub_suspended"))).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload again for the next answers of the same page", () => {
    const h = setup();
    h.guard.notice(closed("base.hub_suspended"));
    expect(h.guard.notice(closed("base.hub_gone", 410))).toBe(true);
    expect(h.guard.notice(closed("base.hub_suspended", 0))).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("leaves any other error alone", () => {
    const h = setup();
    expect(h.guard.notice(closed("app_inactive", 404))).toBe(false);
    expect(h.reload).not.toHaveBeenCalled();
  });

  it("does not loop: a page reloaded for it a moment ago does not reload again, and says why", () => {
    const session = memoryStorage();
    const first = setup(session);
    first.guard.notice(closed("base.hub_gone", 410));

    // The reloaded tab got the app again (a cached shell) and the host still refuses it.
    const again = setup(session, 1_000_000 + RELOAD_GUARD_MS - 1);
    expect(again.guard.notice(closed("base.hub_gone", 410))).toBe(false);
    expect(again.reload).not.toHaveBeenCalled();
    expect(again.logger.error).toHaveBeenCalledTimes(1);
    expect(again.guard.notice(closed("base.hub_gone", 410))).toBe(false);
    expect(again.logger.error).toHaveBeenCalledTimes(1);
  });

  it("reloads again once the last reload is older than the guard", () => {
    const session = memoryStorage();
    setup(session).guard.notice(closed("base.hub_suspended"));

    const later = setup(session, 1_000_000 + RELOAD_GUARD_MS);
    expect(later.guard.notice(closed("base.hub_suspended"))).toBe(true);
    expect(later.reload).toHaveBeenCalledTimes(1);
    expect(session.getItem(RELOAD_GUARD_KEY)).toBe(String(1_000_000 + RELOAD_GUARD_MS));
  });

  it("still reloads once per page when the tab's storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    const h = setup(blocked);
    expect(h.guard.notice(closed("base.hub_preparing", 503))).toBe(true);
    expect(h.guard.notice(closed("base.hub_preparing", 503))).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });
});
