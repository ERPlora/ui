/**
 * Harness of the stream manager's tests: a fake clock and a fake network injected through its options
 * (nothing global to restore), SSE frame builders and a ready-made manager.
 */
import { vi } from "vitest";
import {
  createStreamManager,
  type StreamManagerOptions,
  type StreamStatus,
  type SubEvent,
} from "../stream-manager";
import { decodeSubs, FakeClock, type WireSub } from "./live-harness";

const enc = new TextEncoder();
export const LIVE_HEADERS = { Accept: "text/event-stream", "X-Device-Id": "dev-1", "X-Client-Instance": "tab-1" };

export async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

type Behaviour =
  | { kind: "stream"; ignoreAbort?: boolean }
  | { kind: "reject"; error: Error }
  | { kind: "status"; status: number; body: string };

interface Call {
  url: string;
  init: RequestInit;
  subs: WireSub[];
  push(text: string): void;
  end(): void;
  aborted(): boolean;
}

function createFakeFetch() {
  const calls: Call[] = [];
  const queue: Behaviour[] = [];
  const fetchImpl = (url: string, init: RequestInit): Promise<Response> => {
    const behaviour = queue.shift() ?? { kind: "stream" };
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
    const signal = init.signal as AbortSignal;
    if (!(behaviour.kind === "stream" && behaviour.ignoreAbort)) {
      signal.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
    }
    calls.push({
      url,
      init,
      subs: decodeSubs(url),
      push: (text) => controller.enqueue(enc.encode(text)),
      end: () => controller.close(),
      aborted: () => signal.aborted,
    });
    if (behaviour.kind === "reject") return Promise.reject(behaviour.error);
    if (behaviour.kind === "status") return Promise.resolve(new Response(behaviour.body, { status: behaviour.status }));
    return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
  };
  return { calls, queue, fetchImpl };
}

export function setup(overrides: Partial<StreamManagerOptions> = {}) {
  const clock = new FakeClock();
  const net = createFakeFetch();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const manager = createStreamManager({
    fetchImpl: net.fetchImpl,
    headers: { liveHeaders: () => ({ ...LIVE_HEADERS }) },
    liveUrl: "/api/live",
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    logger,
    random: () => 0,
    ...overrides,
  });
  const statuses: StreamStatus[] = [];
  manager.onStatus((s) => statuses.push(s));
  return { clock, net, logger, manager, statuses };
}

export function recorder() {
  const events: SubEvent[] = [];
  return {
    events,
    fn: (e: SubEvent) => void events.push(e),
    results: () => events.filter((e) => e.type === "result"),
    errors: () => events.flatMap((e) => (e.type === "error" ? [e.error] : [])),
  };
}

export const HELLO = 'event: hello\ndata: {"stream":"0192-stream"}\n\n';
export const BYE = "event: bye\ndata: {}\n\n";
export const HEARTBEAT = "event: heartbeat\ndata: {}\n\n";
export const result = (id: string, data: unknown, rev: number) =>
  `event: result\ndata: ${JSON.stringify({ id, data, rev })}\n\n`;
export const errorFrame = (id: string | undefined, code: string) =>
  `event: error\ndata: ${JSON.stringify({ ...(id ? { id } : {}), error: { code, message: `msg ${code}` } })}\n\n`;
export const idOf = (call: Call, op: string) => call.subs.find((s) => s.op === op)?.id ?? "missing";

/** Advances the clock in 15 s steps, sending a heartbeat after each one, as the server does. */
export async function keepAlive(h: ReturnType<typeof setup>, call: Call, steps: number): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await h.clock.advance(15000);
    call.push(HEARTBEAT);
  }
}

export async function goLive(h: ReturnType<typeof setup>): Promise<Call> {
  await h.clock.advance(150);
  const call = h.net.calls.at(-1) as Call;
  call.push(HELLO);
  await settle();
  return call;
}
