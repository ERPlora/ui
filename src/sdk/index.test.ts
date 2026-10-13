import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as sdk from "./index";
import type { OpName } from "./operations";

vi.mock("@ionic/vue", () => ({ onIonViewDidLeave: () => {}, onIonViewWillEnter: () => {} }));

describe("sdk entry point", () => {
  it("exposes the transport building blocks", () => {
    for (const name of [
      "createSseParser",
      "readSpaConfig",
      "SpaConfigError",
      "createHeaderProvider",
      "readCookie",
      "ApiError",
      "parseErrorEnvelope",
      "fieldErrors",
      "isConflict",
      "isUnauthorized",
      "createStreamManager",
      "backoffDelay",
      "stableJson",
      "encodeSubscriptions",
    ]) {
      expect(typeof (sdk as Record<string, unknown>)[name], name).toBe("function");
    }
  });

  it("exposes the Vue SDK: client, live queries, commands and overlays", () => {
    for (const name of [
      "createApiClient",
      "createOptimisticStore",
      "createLiveClient",
      "provideLiveClient",
      "useLiveClient",
      "useLive",
      "useCommand",
      "isQueryRoute",
      "parseOperationRoutes",
    ]) {
      expect(typeof (sdk as Record<string, unknown>)[name], name).toBe("function");
    }
    expect(typeof sdk.LIVE_CLIENT_KEY).toBe("symbol");
    expect(sdk.SETTLE_TIMEOUT_MS).toBe(3000);
    expect(sdk.RELEASE_GRACE_MS).toBe(2000);
    expectTypeOf<sdk.OpName>().toEqualTypeOf<OpName>();
  });

  it("exposes the client of allauth.headless for the SaaS's account pages", () => {
    expect(typeof sdk.createAllauthClient).toBe("function");
    expect(sdk.ALLAUTH_BROWSER_BASE).toBe("/_allauth/browser/v1");
  });

  it("exposes the contract limits", () => {
    expect(sdk.MAX_SUBSCRIPTIONS).toBe(50);
    expect(sdk.MAX_QUERY_BYTES).toBe(12 * 1024);
    expect(sdk.WATCHDOG_MS).toBe(45000);
    expect(sdk.HIDDEN_CLOSE_MS).toBe(60000);
    expect(sdk.RESUBSCRIBE_DEBOUNCE_MS).toBe(150);
  });
});
