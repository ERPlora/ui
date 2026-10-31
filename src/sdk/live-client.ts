/**
 * The SDK of one tab: the live stream, the API client and the optimistic overlays, wired to the
 * browser once and shared through Vue's provide/inject.
 *
 *   const client = createLiveClient(readSpaConfig(), { routes });   // generated op → route map
 *   provideLiveClient(client, app);
 *
 * Results feed the optimistic store once per frame, and a new stream (`hello` → `live`) restarts
 * its revisions, so overlays are released by the first fresh result after their command settles.
 * An answer of a host that no longer serves the app, to a call or on the stream, reloads the page once
 * (`host-closed.ts`) and stops the stream; so does a 401 once the stream has been live (the page had a session and
 * it ended).
 */
import { type App, getCurrentInstance, hasInjectionContext, inject, type InjectionKey, provide } from "vue";
import { type ApiClient, createApiClient } from "./api-client";
import type { SpaConfig } from "./config";
import type { ApiError } from "./errors";
import { createHeaderProvider } from "./headers";
import { createHostClosedGuard } from "./host-closed";
import type { OperationRoutes } from "./operations";
import { createOptimisticStore, type OptimisticStore } from "./optimistic";
import { createStreamManager, type StreamManager } from "./stream-manager";

export interface BrowserDeps {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
  visibility: () => DocumentVisibilityState;
  onVisibilityChange: (callback: () => void) => () => void;
  storage: Pick<Storage, "getItem" | "setItem">;
  cookies: () => string;
  randomUUID: () => string;
  /** Jitter source of the reconnection backoff. */
  random: () => number;
  logger: Pick<Console, "warn" | "error">;
  getElevationToken: () => string | undefined;
  /** Reloads the page (the host no longer serves the app: it answers the reload with its own page). */
  reload: () => void;
  /** The tab's storage, which outlives a reload (the reload guard). */
  session: Pick<Storage, "getItem" | "setItem">;
  /** Epoch milliseconds. */
  wallClock: () => number;
  /** Op → route map; wins over `SpaConfig.routes`. */
  routes: OperationRoutes;
}

export interface LiveClient {
  readonly config: SpaConfig;
  /** The device's id it sends as `X-Device-Id` on every call: the one a device that prints is set up with. */
  readonly deviceId: string;
  readonly stream: StreamManager;
  readonly api: ApiClient;
  readonly optimistic: OptimisticStore;
  /** Runs `callback` after `ms` on the client's timers; returns a function that cancels it. */
  schedule(callback: () => void, ms: number): () => void;
  close(): void;
}

export const LIVE_CLIENT_KEY: InjectionKey<LiveClient> = Symbol("erplora.live-client");

function browserDeps(): Omit<BrowserDeps, "routes"> {
  return {
    fetchImpl: (url, init) => globalThis.fetch(url, init),
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
    now: () => globalThis.performance.now(),
    visibility: () => document.visibilityState,
    onVisibilityChange(callback) {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },
    // Resolved on each call: reading `localStorage` itself can throw (blocked storage), and the
    // header provider already falls back to an in-memory id when it does.
    storage: {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
    cookies: () => document.cookie,
    randomUUID: () => globalThis.crypto.randomUUID(),
    random: Math.random,
    logger: console,
    getElevationToken: () => undefined,
    reload: () => window.location.reload(),
    // Resolved on each call, like `storage`: reading `sessionStorage` itself can throw (blocked storage).
    session: {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
    },
    wallClock: () => Date.now(),
  };
}

export function createLiveClient(cfg: SpaConfig, overrides: Partial<BrowserDeps> = {}): LiveClient {
  const defined = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
  const deps: Omit<BrowserDeps, "routes"> = { ...browserDeps(), ...defined };
  const routes = overrides.routes ?? cfg.routes ?? {};

  const headers = createHeaderProvider(cfg, {
    storage: deps.storage,
    cookies: deps.cookies,
    randomUUID: deps.randomUUID,
    getElevationToken: deps.getElevationToken,
  });
  const hostClosed = createHostClosedGuard({
    reload: deps.reload,
    session: deps.session,
    wallClock: deps.wallClock,
    logger: deps.logger,
  });
  // The stream only says hello to a page with a session: from then on a 401 means it ended.
  let hadSession = false;
  const leaving = (error: ApiError): boolean =>
    hostClosed.notice(error) || (hadSession && hostClosed.noticeSignedOut(error));
  const optimistic = createOptimisticStore({
    setTimeout: deps.setTimeout,
    clearTimeout: deps.clearTimeout,
    logger: deps.logger,
  });
  const stream = createStreamManager({
    fetchImpl: deps.fetchImpl,
    headers,
    liveUrl: cfg.liveUrl,
    now: deps.now,
    setTimeout: deps.setTimeout,
    clearTimeout: deps.clearTimeout,
    visibility: deps.visibility,
    onVisibilityChange: deps.onVisibilityChange,
    logger: deps.logger,
    random: deps.random,
    onResult: (id, rev) => optimistic.onResult(id, rev),
    onError: leaving,
  });
  const stopStatus = stream.onStatus((status) => {
    if (status !== "live") return;
    hadSession = true;
    optimistic.resetRevisions();
  });
  const api = createApiClient({
    fetchImpl: deps.fetchImpl,
    headers,
    apiBase: cfg.apiBase,
    routes,
    onError: (error) => void leaving(error),
  });

  return {
    config: cfg,
    deviceId: headers.deviceId,
    stream,
    api,
    optimistic,
    schedule(callback, ms) {
      const handle = deps.setTimeout(callback, ms);
      return () => deps.clearTimeout(handle);
    },
    close() {
      stopStatus();
      stream.close();
      optimistic.clear();
    },
  };
}

/** Provides the client to the whole `app`, or — without `app` — to the subtree of the current setup(). */
export function provideLiveClient(client: LiveClient, app?: App): void {
  if (app) {
    app.provide(LIVE_CLIENT_KEY, client);
    return;
  }
  if (!getCurrentInstance()) {
    throw new Error("live: provideLiveClient(client) without an app must be called inside setup()");
  }
  provide(LIVE_CLIENT_KEY, client);
}

export function useLiveClient(): LiveClient {
  const client = hasInjectionContext() ? inject(LIVE_CLIENT_KEY, null) : null;
  if (!client) {
    throw new Error(
      "live: no live client was provided; call provideLiveClient(createLiveClient(readSpaConfig()), app) before mounting",
    );
  }
  return client;
}
