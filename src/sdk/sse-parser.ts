/**
 * Incremental parser for `text/event-stream` (WHATWG HTML, "Server-sent events").
 *
 * The live stream is read with `fetch` + `ReadableStream` so the SDK can send its own
 * request headers; this parser turns the raw chunks into frames. `id:` lines are ignored
 * on purpose (the contract has no `Last-Event-ID`), comments are skipped and `retry:` is
 * reported as its own frame so the caller can tune its reconnection backoff.
 */

export type SseFrame =
  | { type: "event"; event: string; data: string }
  | { type: "retry"; ms: number };

export interface SseParser {
  /** Feeds a chunk of the stream (raw bytes or already decoded text). */
  push(chunk: Uint8Array | string): void;
  /** Ends the stream: flushes the decoder and discards any incomplete event. */
  flush(): void;
}

const LF = 10;
const CR = 13;
const BOM = "﻿";
const INTEGER = /^\d+$/;

export function createSseParser(onFrame: (frame: SseFrame) => void): SseParser {
  let decoder = new TextDecoder("utf-8");
  let buffer = "";
  let atStreamStart = true;
  let skipLeadingLf = false;
  let eventName = "";
  let dataLines: string[] = [];

  function dispatch(): void {
    if (eventName === "" && dataLines.length === 0) return;
    const frame: SseFrame = { type: "event", event: eventName || "message", data: dataLines.join("\n") };
    eventName = "";
    dataLines = [];
    onFrame(frame);
  }

  function processLine(line: string): void {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "event":
        eventName = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      case "retry":
        if (INTEGER.test(value)) onFrame({ type: "retry", ms: Number(value) });
        break;
      default:
        // `id` and unknown fields are ignored.
        break;
    }
  }

  function feed(text: string): void {
    if (text === "") return;
    if (atStreamStart) {
      atStreamStart = false;
      if (text.startsWith(BOM)) text = text.slice(1);
    }
    if (skipLeadingLf) {
      skipLeadingLf = false;
      if (text.charCodeAt(0) === LF) text = text.slice(1);
    }
    buffer += text;
    let lineStart = 0;
    for (let i = 0; i < buffer.length; i++) {
      const code = buffer.charCodeAt(i);
      if (code !== LF && code !== CR) continue;
      processLine(buffer.slice(lineStart, i));
      if (code === CR) {
        if (i + 1 < buffer.length) {
          if (buffer.charCodeAt(i + 1) === LF) i++;
        } else {
          skipLeadingLf = true;
        }
      }
      lineStart = i + 1;
    }
    buffer = buffer.slice(lineStart);
  }

  return {
    push(chunk) {
      feed(typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true }));
    },
    flush() {
      feed(decoder.decode());
      decoder = new TextDecoder("utf-8");
      buffer = "";
      atStreamStart = true;
      skipLeadingLf = false;
      eventName = "";
      dataLines = [];
    },
  };
}
