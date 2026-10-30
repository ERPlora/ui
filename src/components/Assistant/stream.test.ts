// The turn's transport (BASE-G06: the old hub's SSE client): one POST that answers as a stream of frames, read as
// they come with `fetch` + `ReadableStream` (no EventSource, no second stream), from the same origin and with the
// SDK's headers, to the route the host gives (`AssistantConfig.turnUrl`). Cases of the old hub's `assistant.test.ts` and
// `assistant-auth.test.ts`.
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../sdk/errors';
import { postTurn, type TurnFrame } from './stream';

/** The host's route of a turn. */
const URL = '/api/chat/turn';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function page(): Document {
  const doc = document.implementation.createHTMLDocument('hub');
  const config = doc.createElement('script');
  config.id = 'spa-config';
  config.type = 'application/json';
  config.textContent = JSON.stringify({ csrfCookieName: 'csrftoken', csrfHeader: 'X-CSRFToken', liveUrl: '/api/live', apiBase: '/api', lang: 'es', deviceIdStorageKey: 'erplora.device' });
  doc.body.append(config);
  Object.defineProperty(doc, 'cookie', { value: 'csrftoken=tok123' });
  return doc;
}

describe('postTurn', () => {
  it('posts the turn to the host\'s route with the CSRF header, and reads each frame as it comes', async () => {
    const fetcher = vi.fn(async () =>
      new Response(streamOf(['data: {"type":"text","text":"Ho', 'la"}\n\ndata: {"type":"done","append":[],"pending":[],"continuation":null}\n\n']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const frames: TurnFrame[] = [];
    await postTurn({ messages: [{ role: 'user', content: 'hola' }] }, { url: URL, onFrame: (frame) => frames.push(frame), fetcher, doc: page() });
    expect(frames.map((frame) => frame.type)).toEqual(['text', 'done']);
    expect(frames[0]).toEqual({ type: 'text', text: 'Hola' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect((init.headers as Record<string, string>)['X-CSRFToken']).toBe('tok123');
    expect(JSON.parse(init.body as string)).toEqual({ messages: [{ role: 'user', content: 'hola' }] });
  });

  it('a refusal of the Hub (a session gone, too heavy) is its error, with its code', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'x' } }), { status: 401 }));
    const failure = postTurn({ messages: [] }, { url: URL, onFrame: () => undefined, fetcher, doc: page() });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });

  it('a network that is not there rejects as it is (the panel says it cannot reach the assistant)', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(postTurn({ messages: [] }, { url: URL, onFrame: () => undefined, fetcher, doc: page() })).rejects.toBeInstanceOf(TypeError);
  });

  it('a frame that cannot be read is skipped, the next ones still arrive', async () => {
    const fetcher = vi.fn(async () => new Response(streamOf(['data: {broken\n\ndata: {"type":"text","text":"ok"}\n\n']), { status: 200 }));
    const frames: TurnFrame[] = [];
    await postTurn({ messages: [] }, { url: URL, onFrame: (frame) => frames.push(frame), fetcher, doc: page() });
    expect(frames).toEqual([{ type: 'text', text: 'ok' }]);
  });
});

describe('a turn repeated after an approval (the Hub\'s manager approval, BASE-G118)', () => {
  const done = () =>
    new Response('data: {"type":"done","append":[],"pending":[],"continuation":null}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });

  it("carries the host's pass in X-Elevation-Token while it has one, and none once it has not", async () => {
    const sent: (string | null)[] = [];
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('X-Elevation-Token'));
      return done();
    });
    let pass: string | undefined = 'elev_pass';
    const elevationToken = () => pass;
    await postTurn({ messages: [] }, { url: URL, elevationToken, onFrame: () => undefined, fetcher, doc: page() });
    pass = undefined;
    await postTurn({ messages: [] }, { url: URL, elevationToken, onFrame: () => undefined, fetcher, doc: page() });
    expect(sent).toEqual(['elev_pass', null]);
  });

  it('a host without approvals sends no pass', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).has('X-Elevation-Token')).toBe(false);
      return done();
    });
    await postTurn({ messages: [] }, { url: URL, onFrame: () => undefined, fetcher, doc: page() });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
