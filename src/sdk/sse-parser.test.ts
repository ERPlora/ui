import { describe, expect, it } from "vitest";
import { createSseParser, type SseFrame } from "./sse-parser";

function collect(): { frames: SseFrame[]; parser: ReturnType<typeof createSseParser> } {
  const frames: SseFrame[] = [];
  return { frames, parser: createSseParser((f) => frames.push(f)) };
}

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("createSseParser", () => {
  it("emits an event with its name and data", () => {
    const { frames, parser } = collect();
    parser.push('event: hello\ndata: {"stream":"abc"}\n\n');
    expect(frames).toEqual([{ type: "event", event: "hello", data: '{"stream":"abc"}' }]);
  });

  it("joins multi-line data with a newline", () => {
    const { frames, parser } = collect();
    parser.push("event: result\ndata: line one\ndata: line two\n\n");
    expect(frames).toEqual([{ type: "event", event: "result", data: "line one\nline two" }]);
  });

  it("defaults the event name to message", () => {
    const { frames, parser } = collect();
    parser.push("data: plain\n\n");
    expect(frames).toEqual([{ type: "event", event: "message", data: "plain" }]);
  });

  it("emits a named event without data lines", () => {
    const { frames, parser } = collect();
    parser.push("event: bye\n\n");
    expect(frames).toEqual([{ type: "event", event: "bye", data: "" }]);
  });

  it("does not emit anything for a blank line alone", () => {
    const { frames, parser } = collect();
    parser.push("\n\n\n");
    expect(frames).toEqual([]);
  });

  it("ignores id lines and comments", () => {
    const { frames, parser } = collect();
    parser.push(": keep-alive comment\nid: 42\nevent: heartbeat\ndata: {}\n\n");
    expect(frames).toEqual([{ type: "event", event: "heartbeat", data: "{}" }]);
  });

  it("reports retry as its own frame in milliseconds", () => {
    const { frames, parser } = collect();
    parser.push("retry: 3000\n\n");
    expect(frames).toEqual([{ type: "retry", ms: 3000 }]);
  });

  it("ignores a retry value that is not an integer", () => {
    const { frames, parser } = collect();
    parser.push("retry: soon\nretry: 1.5\n\n");
    expect(frames).toEqual([]);
  });

  it("strips only one leading space from the value", () => {
    const { frames, parser } = collect();
    parser.push("data:  two spaces\ndata:none\n\n");
    expect(frames).toEqual([{ type: "event", event: "message", data: " two spaces\nnone" }]);
  });

  it("treats a line without a colon as a field with an empty value", () => {
    const { frames, parser } = collect();
    parser.push("data\ndata\n\n");
    expect(frames).toEqual([{ type: "event", event: "message", data: "\n" }]);
  });

  it("accepts CRLF and lone CR line endings", () => {
    const { frames, parser } = collect();
    parser.push("event: a\r\ndata: 1\r\n\r\nevent: b\rdata: 2\r\r");
    expect(frames).toEqual([
      { type: "event", event: "a", data: "1" },
      { type: "event", event: "b", data: "2" },
    ]);
  });

  it("does not see an extra blank line when CRLF is split across chunks", () => {
    const { frames, parser } = collect();
    parser.push("data: 1\r");
    parser.push("\ndata: 2\r");
    parser.push("\n\r");
    parser.push("\n");
    expect(frames).toEqual([{ type: "event", event: "message", data: "1\n2" }]);
  });

  it("reassembles frames split across chunks at any point", () => {
    const text = 'event: result\ndata: {"id":"a1","data":[1,2],"rev":3}\n\nevent: heartbeat\ndata: {}\n\n';
    for (let cut = 1; cut < text.length; cut++) {
      const { frames, parser } = collect();
      parser.push(text.slice(0, cut));
      parser.push(text.slice(cut));
      expect(frames).toEqual([
        { type: "event", event: "result", data: '{"id":"a1","data":[1,2],"rev":3}' },
        { type: "event", event: "heartbeat", data: "{}" },
      ]);
    }
  });

  it("decodes UTF-8 bytes even when a character is split between chunks", () => {
    const { frames, parser } = collect();
    const all = bytes("data: café ☕\n\n");
    const split = all.indexOf(0xe2) + 1; // inside the 3-byte coffee cup
    parser.push(all.slice(0, split));
    parser.push(all.slice(split));
    expect(frames).toEqual([{ type: "event", event: "message", data: "café ☕" }]);
  });

  it("ignores a byte order mark at the start of the stream", () => {
    const { frames, parser } = collect();
    parser.push(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("data: x\n\n")]));
    expect(frames).toEqual([{ type: "event", event: "message", data: "x" }]);
  });

  it("ignores unknown fields", () => {
    const { frames, parser } = collect();
    parser.push("foo: bar\ndata: x\n\n");
    expect(frames).toEqual([{ type: "event", event: "message", data: "x" }]);
  });

  it("discards an incomplete event on flush, as the SSE spec requires", () => {
    const { frames, parser } = collect();
    parser.push("event: result\ndata: partial");
    parser.flush();
    expect(frames).toEqual([]);
  });

  it("starts clean after flush", () => {
    const { frames, parser } = collect();
    parser.push("event: result\ndata: partial\r");
    parser.flush();
    parser.push("\ndata: fresh\n\n");
    expect(frames).toEqual([{ type: "event", event: "message", data: "fresh" }]);
  });
});
