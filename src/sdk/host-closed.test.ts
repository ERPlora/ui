import { describe, expect, it, vi } from "vitest";
import { memoryStorage } from "./__tests__/live-harness";
import { ApiError } from "./errors";
import { createHostClosedGuard, isHostClosed, isSignedOut, RELOAD_GUARD_KEY, RELOAD_GUARD_MS } from "./host-closed";

const closed = (code: string, status = 402) => new ApiError(status, code, `msg ${code}`);

function setup(session: Pick<Storage, "getItem" | "setItem"> = memoryStorage(), at = 1_000_000) {
  const reload = vi.fn();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const clock = { t: at };
  const guard = createHostClosedGuard({ reload, session, wallClock: () => clock.t, logger });
  return { guard, reload, logger, session, clock };
}

describe("isHostClosed", () => {
  it.each(["base.hub_suspended", "base.hub_gone", "base.hub_preparing", "base.hub_maintenance"])(
    "is the host gate's %s",
    (code) => {
      expect(isHostClosed(closed(code))).toBe(true);
      // From the live stream too, where an error carries status 0.
      expect(isHostClosed(closed(code, 0))).toBe(true);
    },
  );

  it.each([
    // The same status as the gate's, another code: an app the business has no right to (402) and one being
    // prepared (503) are the page's to show, not a host that no longer serves the app.
    ["app_entitlement_blocked", 402],
    ["app_activating", 503],
    ["app_inactive", 404],
    ["base.app_required", 409],
    ["not_found", 404],
    ["unauthorized", 401],
    ["network_error", 0],
  ])("is not any other refusal (%s, %i)", (code, status) => {
    expect(isHostClosed(closed(code, status))).toBe(false);
  });
});

describe("isSignedOut", () => {
  it("is the host's 401, whatever its code (no session, or the one the page had ended)", () => {
    expect(isSignedOut(closed("unauthorized", 401))).toBe(true);
    expect(isSignedOut(closed("base.session_ended", 401))).toBe(true);
  });

  it.each([
    ["permission_denied", 403],
    ["base.hub_suspended", 402],
    ["unauthorized", 0],
    ["network_error", 0],
  ])("is not any other answer (%s, %i)", (code, status) => {
    expect(isSignedOut(closed(code, status))).toBe(false);
  });

  it.each([
    // The SaaS: a sensitive command wants a recent sign-in (allauth's reauthentication); the panel asks for it.
    "reauthentication_required",
    // The Hub: the manager's name and PIN that were to approve an action do not approve it.
    "base.approval_refused",
    // The Hub: a wrong PIN at its PIN pad.
    "base.pin_incorrect",
    // The Hub: a badge that opens nothing at its PIN pad.
    "base.badge_unknown",
  ])("is not a 401 that asks the live session for something (%s): the caller shows it", (code) => {
    expect(isSignedOut(closed(code, 401))).toBe(false);
  });
});

describe("createHostClosedGuard", () => {
  it("reloads once for a session that ended, with the same guard as a closed host", () => {
    const h = setup();
    expect(h.guard.noticeSignedOut(closed("unauthorized", 401))).toBe(true);
    expect(h.guard.noticeSignedOut(closed("unauthorized", 401))).toBe(true);
    expect(h.guard.notice(closed("base.hub_gone", 410))).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.guard.noticeSignedOut(closed("permission_denied", 403))).toBe(false);
  });

  it("keeps the page for a 401 that asks the live session for something", () => {
    const h = setup();
    expect(h.guard.noticeSignedOut(closed("reauthentication_required", 401))).toBe(false);
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.session.getItem(RELOAD_GUARD_KEY)).toBeNull();
  });

  it("does not reload for a session that ended right after a reload", () => {
    const session = memoryStorage();
    session.setItem(RELOAD_GUARD_KEY, String(1_000_000 - 1000));
    const h = setup(session);
    expect(h.guard.noticeSignedOut(closed("unauthorized", 401))).toBe(false);
    expect(h.reload).not.toHaveBeenCalled();
  });

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

  it("leaves any other error alone, also one with the gate's own status", () => {
    const h = setup();
    expect(h.guard.notice(closed("app_inactive", 404))).toBe(false);
    expect(h.guard.notice(closed("app_entitlement_blocked", 402))).toBe(false);
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
