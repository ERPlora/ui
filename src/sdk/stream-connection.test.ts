import { describe, expect, it } from "vitest";
import { BYE, HELLO, fakeOptions, recorder, result, settle } from "./__tests__/stream-manager-harness";
import { connect } from "./stream-connection";
import { createStreamState, type StreamManagerOptions } from "./stream-state";

const DENIED = '{"error":{"code":"base.denied","message":"Denied"}}';

function opened(overrides: Partial<StreamManagerOptions> = {}) {
  const fakes = fakeOptions(overrides);
  const s = createStreamState(fakes.options);
  const rec = recorder();
  const { id } = s.registry.add("demo.item.list", {}, rec.fn);
  connect(s);
  return { ...fakes, s, rec, id };
}

/** A network whose every answer is an HTTP error with a body that arrives only when the test says so. */
function slowDenials() {
  const answers: Array<() => void> = [];
  const signals: AbortSignal[] = [];
  const fetchImpl = (_url: string, init: RequestInit): Promise<Response> => {
    signals.push(init.signal as AbortSignal);
    const body = new ReadableStream<Uint8Array>({
      start: (c) =>
        void answers.push(() => {
          c.enqueue(new TextEncoder().encode(DENIED));
          c.close();
        }),
    });
    return Promise.resolve(new Response(body, { status: 403 }));
  };
  return { answers, signals, fetchImpl };
}

describe("connect", () => {
  it("drops what follows a bye in the same chunk and waits to reconnect", async () => {
    const h = opened();
    h.net.calls[0].push(HELLO + BYE + result(h.id, ["late"], 1));
    await settle();
    expect(h.rec.results()).toEqual([]);
    expect(h.net.calls[0].aborted()).toBe(true);
    expect(h.s.status).toBe("reconnecting");
  });

  it("ignores the HTTP error of a connection replaced while its body was still arriving", async () => {
    const net = slowDenials();
    const h = opened({ fetchImpl: net.fetchImpl });
    await settle();
    connect(h.s);
    await settle();
    net.answers[0]();
    await settle();
    expect(h.rec.errors()).toEqual([]);
    expect(net.signals[1].aborted).toBe(false);
    expect(h.s.status).toBe("connecting");
    net.answers[1]();
    await settle();
    expect(h.rec.errors().map((e) => [e.status, e.code])).toEqual([[403, "base.denied"]]);
    expect(h.s.status).toBe("reconnecting");
  });

  it("schedules no new attempt for a connection that ends while the stream is paused", async () => {
    const h = opened();
    await settle();
    h.s.paused = true;
    h.net.calls[0].end();
    await settle();
    expect(h.s.current).toBeUndefined();
    expect(h.s.status).toBe("connecting");
    expect(h.clock.pending()).toBe(0);
  });

  it("opens nothing once the page has left", () => {
    const fakes = fakeOptions();
    const s = createStreamState(fakes.options);
    s.registry.add("demo.item.list", {}, () => {});
    s.left = true;
    connect(s);
    expect(fakes.net.calls).toHaveLength(0);
    expect(s.status).toBe("idle");
  });
});
