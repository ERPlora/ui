/**
 * Test harness shared by the SDK's Vue-level tests: a fake clock, a fake network that serves the
 * live stream (`/api/live?s=…`) and the API, SSE frame builders and a ready-made live client.
 */
import type { SpaConfig } from "../config";
import { type BrowserDeps, createLiveClient } from "../live-client";
import type { OperationRoutes } from "../operations";

export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

export class FakeClock {
  private t = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; cb: () => void }>();
  now = (): number => this.t;
  setTimeout = (cb: () => void, ms: number): number => {
    this.timers.set(++this.seq, { at: this.t + ms, cb });
    return this.seq;
  };
  clearTimeout = (id: unknown): void => void this.timers.delete(id as number);
  pending = (): number => this.timers.size;
  async advance(ms: number): Promise<void> {
    const end = this.t + ms;
    await flush();
    for (;;) {
      let next: [number, { at: number; cb: () => void }] | undefined;
      for (const entry of this.timers) {
        if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].cb();
      await flush();
    }
    this.t = end;
  }
}

export interface WireSub {
  id: string;
  op: string;
  params: unknown;
}

export interface StreamCall {
  url: string;
  init: RequestInit;
  subs: WireSub[];
  push(text: string): void;
  aborted(): boolean;
}

export interface ApiCall {
  url: string;
  init: RequestInit;
}

export type ApiHandler = (call: ApiCall) => Response | Promise<Response>;

function decodeSubs(url: string): WireSub[] {
  const s = new URL(url, "http://a.localhost").searchParams.get("s") ?? "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))) as WireSub[];
}

export function createFakeNetwork(liveUrl = "/api/live") {
  const enc = new TextEncoder();
  const streams: StreamCall[] = [];
  const api: ApiCall[] = [];
  const state: { handler: ApiHandler } = { handler: () => Response.json({}) };
  const fetchImpl = (url: string, init: RequestInit): Promise<Response> => {
    if (!url.startsWith(`${liveUrl}?`)) {
      const call = { url, init };
      api.push(call);
      return Promise.resolve(state.handler(call));
    }
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
    const signal = init.signal as AbortSignal;
    signal.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
    streams.push({
      url,
      init,
      subs: decodeSubs(url),
      push: (text) => controller.enqueue(enc.encode(text)),
      aborted: () => signal.aborted,
    });
    return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
  };
  return {
    fetchImpl,
    streams,
    api,
    lastStream: (): StreamCall => streams.at(-1) as StreamCall,
    onApi(handler: ApiHandler): void {
      state.handler = handler;
    },
  };
}

export const HELLO = 'event: hello\ndata: {"stream":"s-1"}\n\n';
export const BYE = "event: bye\ndata: {}\n\n";
export const resultFrame = (id: string, data: unknown, rev: number): string =>
  `event: result\ndata: ${JSON.stringify({ id, data, rev })}\n\n`;
export const errorFrame = (id: string, code: string): string =>
  `event: error\ndata: ${JSON.stringify({ id, error: { code, message: `msg ${code}` } })}\n\n`;

export const TEST_ROUTES: OperationRoutes = {
  "test.item.list": { method: "get", path: "/api/test/items" },
  "test.item.detail": { method: "get", path: "/api/test/items/{id}" },
  "test.item.add_line": { method: "post", path: "/api/test/items/{id}/lines" },
  "test.item.delete": { method: "delete", path: "/api/test/items/{id}" },
  "test.session.me": { method: "get", path: "/api/session/me" },
};

export const TEST_CONFIG: SpaConfig = {
  csrfCookieName: "hub_csrftoken",
  csrfHeader: "X-CSRFToken",
  liveUrl: "/api/live",
  apiBase: "/api",
  lang: "en",
  deviceIdStorageKey: "erplora.device_id",
};

export function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) };
}

let uuidSeq = 0;
export const fakeUUID = (): string => `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, "0")}`;

/** A live client on fake timers and network, with the test routes. */
export function createTestClient(overrides: Partial<BrowserDeps> = {}, cfg: SpaConfig = TEST_CONFIG) {
  const clock = new FakeClock();
  const net = createFakeNetwork(cfg.liveUrl);
  const logger = { warn: (): void => {}, error: (): void => {} };
  const client = createLiveClient(cfg, {
    fetchImpl: net.fetchImpl,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
    visibility: () => "visible",
    onVisibilityChange: () => () => {},
    storage: memoryStorage(),
    cookies: () => "hub_csrftoken=tok",
    randomUUID: fakeUUID,
    random: () => 0,
    logger,
    routes: TEST_ROUTES,
    ...overrides,
  });
  /** Opens the stream (150 ms debounce) and says hello; returns the stream call. */
  async function goLive(): Promise<StreamCall> {
    await clock.advance(150);
    const call = net.lastStream();
    call.push(HELLO);
    await flush();
    return call;
  }
  return { client, clock, net, logger, goLive };
}
