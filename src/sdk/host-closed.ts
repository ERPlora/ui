/**
 * A host that no longer serves the app: the Hub's registry gate answers every API call and the live stream with
 * its envelope once the business is suspended for an unpaid invoice (`base.hub_suspended`, 402), the hub ended
 * (`base.hub_gone`, 410) or it is still being prepared (`base.hub_preparing`, 503). An app already open would only
 * show loose errors, so the SDK reloads the page once and the browser gets the gate's own page (the way back to
 * ERPlora), as an app shows the store's pause page.
 *
 * A session that ended while the page was open (the Hub's `/internal/sessions/revoke` after a role change or a removal,
 * a sign-out elsewhere) leaves the same way: once the page had a session, a 401 of the host (`unauthorized`, the
 * stream's reopening or a call) reloads it, and the reload without a session ends at the way in: the Hub sends it to
 * the SaaS's sign-in (which comes back with the new role, or says the person has no access any more), the SaaS's
 * router to its own sign-in. A page that never had one keeps its 401s: they are the page's to show. Neither does a
 * 401 with which the host asks the live session for something (`SESSION_CHALLENGE_CODES`: a recent sign-in, the
 * manager's approval, the PIN): the session is still there, and the error goes back to whoever called, which asks
 * for it in a dialog without leaving the page (the panel's «Confirm it's you», as GitHub's sudo mode or Google's and
 * Stripe's reauthentication do).
 *
 * Once per page and, across the reloads of a tab (`sessionStorage`), not again within `RELOAD_GUARD_MS`: a page
 * the browser serves without asking the host (a cached shell) would reload forever. The SDK only calls its own
 * origin, so the envelope is the host's.
 */
import type { ApiError } from "./errors";

/** The codes with which the host gate says it does not serve the app. */
export const HOST_CLOSED_CODES: ReadonlySet<string> = new Set([
  "base.hub_suspended",
  "base.hub_gone",
  "base.hub_preparing",
]);
/** The codes of a 401 that asks the live session for something instead of saying it ended. */
export const SESSION_CHALLENGE_CODES: ReadonlySet<string> = new Set([
  // The SaaS: a sensitive command wants a recent sign-in (allauth's reauthentication, with its `flows`).
  "reauthentication_required",
  // The Hub: the manager's name and PIN that were to approve an action do not approve it.
  "base.approval_refused",
  // The Hub: a wrong PIN at its PIN pad.
  "base.pin_incorrect",
  // The Hub: a badge that opens nothing at its PIN pad.
  "base.badge_unknown",
]);
/** A tab reloaded for it less than this long ago does not reload again. */
export const RELOAD_GUARD_MS = 30000;
/** Where the tab keeps when it last reloaded for it (epoch ms). */
export const RELOAD_GUARD_KEY = "erplora.live.host-closed-reload";

export function isHostClosed(error: ApiError): boolean {
  return HOST_CLOSED_CODES.has(error.code);
}

/** Whether `error` says the page's session is gone: the host's 401, whatever its code, but one that asks the live
 *  session for something (`SESSION_CHALLENGE_CODES`). */
export function isSignedOut(error: ApiError): boolean {
  return error.status === 401 && !SESSION_CHALLENGE_CODES.has(error.code);
}

export interface HostClosedGuardDeps {
  reload: () => void;
  /** The tab's storage: it outlives the reload. */
  session: Pick<Storage, "getItem" | "setItem">;
  /** Epoch milliseconds (the page's monotonic clock restarts with the reload). */
  wallClock: () => number;
  logger: Pick<Console, "error">;
}

export interface HostClosedGuard {
  /** Whether the page is leaving because of `error`: the host no longer serves the app and the page reloads. */
  notice(error: ApiError): boolean;
  /** Whether the page is leaving because `error` says its session ended (`isSignedOut`): it reloads the same way. */
  noticeSignedOut(error: ApiError): boolean;
}

export function createHostClosedGuard(deps: HostClosedGuardDeps): HostClosedGuard {
  let reloading = false;
  let refused = false;

  function lastReload(): number | undefined {
    try {
      const value = Number(deps.session.getItem(RELOAD_GUARD_KEY));
      return Number.isFinite(value) && value > 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }

  function remember(at: number): void {
    try {
      deps.session.setItem(RELOAD_GUARD_KEY, String(at));
    } catch {
      // Blocked storage: the page still reloads once; only the guard across reloads is lost.
    }
  }

  function leave(error: ApiError): boolean {
    if (reloading) return true;
    if (refused) return false;
    const now = deps.wallClock();
    const last = lastReload();
    if (last !== undefined && now - last < RELOAD_GUARD_MS) {
      refused = true;
      deps.logger.error(`live: the host still answers ${error.code} right after reloading; not reloading again`);
      return false;
    }
    reloading = true;
    remember(now);
    deps.reload();
    return true;
  }

  return {
    notice: (error) => isHostClosed(error) && leave(error),
    noticeSignedOut: (error) => isSignedOut(error) && leave(error),
  };
}
