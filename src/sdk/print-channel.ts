// The device's end of the Hub's `/ws/print` (PRINTING-F18; the old hub's `print-drain.ts`, hub#343): the loop that takes
// the paper out of the hub's queue on the device next to the printers. It connects, says hello with its device and the
// printers of its registration, claims each function the hub says it prints, hands each job to `print` (the part that
// touches hardware, injected: the shell's `device-printer.ts` in the installed app), confirms it (`done`) or reports the device's
// error (`failed`), beats as often as the hub says, claims again when woken (`wake`) and reconnects after a drop with a
// growing wait. The protocol is the server's (`base/ws_print.py`): its frames, fields and close codes as they are.
//
// What is pinned:
// - one claim per function at a time: a `wake` while a claim or a print of that function is in flight claims nothing,
//   the claim after the job picks it up. The hub answers every frame once and in order, and every answer but `error`
//   names what it answers (`job`/`idle` its function, `ack` a confirmation, `beat`, `ready`); an `error` may also be
//   nobody's (a wake the hub failed), so it frees nothing by itself: the next named answer shows which frames before it
//   errors answered, and a claim among them frees its function (claiming again if it was woken meanwhile). An error
//   while a claim is in flight asks a `beat`, whose answer comes right after the claim's;
// - a failed print stops pulling that function until the next wake or reconnect: a printer out of paper would otherwise
//   spin claim→fail→claim and burn the job's five hand-outs in a moment (the server does not wake a device for the job
//   it sent back itself);
// - a printed job whose `done` was not acknowledged is confirmed again after the next `ready`, before any claim: losing
//   the confirmation of a socket blip would cost a duplicate ticket (`done` is idempotent by `jobId` on the hub);
// - it never reconnects into a refusal: a close in 4400–4499 (session ended, device not set up, hub gone, suspended,
//   printing off…) or a beat that says the device prints for nothing stops it for good; anything else (a network drop,
//   a redeploy, 4503 «still being prepared», 1011) reconnects, from 1 s doubling up to 30 s.
import { backoffDelay } from './backoff';

/** A job as the hub hands it (`job` frame: the old fields and printing's hand-out, camelCased). */
export interface PrintJob {
  jobId: string;
  role: string;
  /** `document` (a ticket, an order…), `test_page` or `drawer`. */
  kind: string;
  documentType: string;
  /** The first copy. */
  document: Record<string, unknown>;
  /** Every copy after the first (a receipt or an invoice marked duplicate); none with one copy. */
  copyDocument: Record<string, unknown> | null;
  /** `receipt` (a thermal printer) or `a4` (the system printer, with its page in `html`). */
  format: string;
  html: string;
  copies: number;
  openDrawer: boolean;
  /** The printer's id in the hub. */
  printerId: string;
  /** The printer as the installed app's commands take it (`network:<ip>:<port>`, `bluetooth:<mac>`, `usb:<queue>`). */
  target: string;
  paperWidth: number;
  attempts: number;
}

/** The part of a WebSocket the channel uses; the browser's `WebSocket` fits it. */
export interface PrintSocket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

/** What happened, as facts: the host decides what a person reads and what goes to the log. */
export type PrintChannelEvent =
  | { kind: 'connected'; roles: string[] }
  | { kind: 'refused'; code: string; message: string }
  | { kind: 'print_failed'; jobId: string; role: string; message: string }
  | { kind: 'stopped'; code: string };

export interface PrintChannelOptions {
  /** `ws(s)://<hub>/ws/print`. */
  url: string;
  /** The device's own id: the `X-Device-Id` its registration was made with. */
  deviceId: string;
  /** The printers of its registration (their ids in the hub), said at hello. */
  printers: readonly string[];
  /** Turns a job into paper: resolves once it came out, rejects with the device's error when it did not. */
  print(job: PrintJob): Promise<void>;
  /** Opens the socket; the browser's `WebSocket` by default. */
  openSocket?(url: string): PrintSocket;
  onEvent?(event: PrintChannelEvent): void;
  /** The reconnection wait's jitter (tests pass `() => 0`). */
  random?: () => number;
}

export interface PrintChannel {
  start(): void;
  stop(): void;
  /** `true` while it means to be connected (it may be between reconnects). */
  running(): boolean;
}

/** The longest error the hub keeps (`printing`'s `DeviceError`): a longer one would be refused as a bad frame. */
export const MAX_ERROR_LENGTH = 500;
/** The first wait before reconnecting; it doubles up to `backoff.ts`'s cap (30 s). */
export const RECONNECT_BASE_MS = 1_000;
/** The beat until the hub says otherwise (it does, in `ready`). */
const DEFAULT_HEARTBEAT_SECONDS = 30;
/** The device prints for nothing any more: retired, or its printers switched off. */
const NOTHING_TO_PRINT = 'print.host_not_registered';

/** Closes no retry fixes (4000 + the refusal's HTTP status): a 4xx is a fact about this device, session or hub. */
const isFatalClose = (code: number) => code >= 4400 && code < 4500;

/** A frame the channel sent that the hub answers, in order. */
type Asked = { type: 'hello' } | { type: 'claim'; role: string } | { type: 'done' } | { type: 'failed' } | { type: 'beat' };

/** The device's error as the hub keeps it: text, never empty, at most {@link MAX_ERROR_LENGTH} characters. */
export function errorText(error: unknown): string {
  let text: string;
  if (typeof error === 'string') text = error;
  else if (error instanceof Error) text = error.message;
  else {
    try {
      text = JSON.stringify(error) ?? String(error);
    } catch {
      text = String(error);
    }
  }
  text = text.trim() || 'the device could not print';
  return text.slice(0, MAX_ERROR_LENGTH);
}

function jobOf(frame: Record<string, unknown>): PrintJob {
  const text = (key: string) => (typeof frame[key] === 'string' ? (frame[key] as string) : '');
  const record = (value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  return {
    jobId: text('jobId'),
    role: text('role'),
    kind: text('kind') || 'document',
    documentType: text('documentType'),
    // Passed on as it came: a document that is not an object is not repaired into an empty one, the printer refuses it
    // and the hub is told (a corrupt row shows instead of cutting blank paper).
    document: (frame.document ?? {}) as Record<string, unknown>,
    copyDocument: record(frame.copyDocument),
    format: text('format') || 'receipt',
    html: text('html'),
    copies: Number.isInteger(frame.copies) && (frame.copies as number) > 0 ? (frame.copies as number) : 1,
    openDrawer: frame.openDrawer === true,
    printerId: text('printerId'),
    target: text('target'),
    paperWidth: Number(frame.paperWidth) || 0,
    attempts: Number(frame.attempts) || 0,
  };
}

export function createPrintChannel(options: PrintChannelOptions): PrintChannel {
  const random = options.random ?? Math.random;
  const openSocket = options.openSocket ?? ((url: string) => new WebSocket(url) as unknown as PrintSocket);
  const tell = (event: PrintChannelEvent) => options.onEvent?.(event);

  let socket: PrintSocket | null = null;
  let wanted = false;
  let attempt = 0;
  let beat: ReturnType<typeof setTimeout> | null = null;
  let reconnect: ReturnType<typeof setTimeout> | null = null;
  /** The frames sent and not answered yet, oldest first (the hub answers in order; `wake` answers nothing). */
  let asked: Asked[] = [];
  /** Functions with a claim or a print in flight. */
  const busy = new Set<string>();
  /** Functions woken while busy: claimed again if their claim turns out to have been refused. */
  const woken = new Set<string>();
  /** Printed, and the hub has not acknowledged it yet. */
  const unconfirmed = new Set<string>();

  function send(frame: Record<string, unknown>, ask?: Asked): void {
    if (!socket) return;
    try {
      socket.send(JSON.stringify(frame));
    } catch {
      // A socket that just died: its close reconnects, and an unconfirmed job is already remembered.
      return;
    }
    if (ask) asked.push(ask);
  }

  function claim(role: string): void {
    if (busy.has(role)) return;
    busy.add(role);
    woken.delete(role);
    send({ type: 'claim', role }, { type: 'claim', role });
  }

  /**
   * A named answer: drops the frame it answers and every one before it, which errors answered (the hub answers in
   * order). A claim among those was refused: its function is free, and claimed again if it was woken meanwhile.
   */
  function answer(answers: (ask: Asked) => boolean): void {
    const at = asked.findIndex(answers);
    if (at < 0) return;
    const refused = asked.splice(0, at + 1).slice(0, at);
    for (const ask of refused) {
      if (ask.type !== 'claim') continue;
      busy.delete(ask.role);
      if (woken.has(ask.role)) claim(ask.role);
    }
  }

  function stopBeat(): void {
    if (beat !== null) clearTimeout(beat);
    beat = null;
  }

  function scheduleBeat(seconds: number): void {
    stopBeat();
    beat = setTimeout(() => {
      beat = null;
      send({ type: 'beat' }, { type: 'beat' });
      scheduleBeat(seconds);
    }, Math.max(1, seconds) * 1000);
  }

  function teardown(): void {
    stopBeat();
    const dying = socket;
    socket = null;
    asked = [];
    busy.clear();
    woken.clear();
    try {
      dying?.close();
    } catch {
      // already gone
    }
  }

  function stopForGood(code: string): void {
    wanted = false;
    if (reconnect !== null) clearTimeout(reconnect);
    reconnect = null;
    teardown();
    tell({ kind: 'stopped', code });
  }

  function scheduleReconnect(): void {
    if (!wanted || reconnect !== null) return;
    const wait = backoffDelay(attempt, RECONNECT_BASE_MS, random);
    attempt += 1;
    reconnect = setTimeout(() => {
      reconnect = null;
      connect();
    }, wait);
  }

  async function handle(job: PrintJob, on: PrintSocket): Promise<void> {
    busy.add(job.role);
    try {
      await options.print(job);
    } catch (error) {
      const message = errorText(error);
      tell({ kind: 'print_failed', jobId: job.jobId, role: job.role, message });
      if (socket !== on) return;
      busy.delete(job.role);
      send({ type: 'failed', jobId: job.jobId, error: message }, { type: 'failed' });
      return;
    }
    // The paper is out: from here what matters is that the hub hears it, or the lease runs out and it prints again.
    unconfirmed.add(job.jobId);
    if (socket !== on) return;
    send({ type: 'done', jobId: job.jobId }, { type: 'done' });
    busy.delete(job.role);
    // There may be more behind it: keep pulling until the hub answers idle.
    claim(job.role);
  }

  function onFrame(raw: unknown, on: PrintSocket): void {
    let frame: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(String(raw));
      if (parsed === null || typeof parsed !== 'object') return;
      frame = parsed as Record<string, unknown>;
    } catch {
      return; // not our protocol: a working socket is not torn down for it
    }
    const type = String(frame.type ?? '');
    const role = String(frame.role ?? '');
    switch (type) {
      case 'wake':
        if (busy.has(role)) woken.add(role);
        else claim(role);
        break;
      case 'ready': {
        answer((ask) => ask.type === 'hello');
        attempt = 0;
        const roles = Array.isArray(frame.roles) ? frame.roles.map(String) : [];
        scheduleBeat(Number(frame.heartbeatSeconds) || DEFAULT_HEARTBEAT_SECONDS);
        tell({ kind: 'connected', roles });
        // The debt first: a reconnect that claimed first could be handed the very ticket it is about to confirm.
        for (const jobId of unconfirmed) send({ type: 'done', jobId }, { type: 'done' });
        for (const role of roles) claim(role);
        break;
      }
      case 'job':
        answer((ask) => ask.type === 'claim' && ask.role === role);
        woken.delete(role);
        void handle(jobOf(frame), on);
        break;
      case 'idle':
        answer((ask) => ask.type === 'claim' && ask.role === role);
        busy.delete(role);
        woken.delete(role);
        break;
      case 'ack':
        answer((ask) => ask.type === 'done' || ask.type === 'failed');
        unconfirmed.delete(String(frame.jobId ?? ''));
        break;
      case 'beat':
        answer((ask) => ask.type === 'beat');
        if (Number(frame.refreshed) === 0) stopForGood(NOTHING_TO_PRINT);
        break;
      case 'error':
        tell({ kind: 'refused', code: String(frame.code ?? ''), message: String(frame.message ?? '') });
        // A fatal refusal closes the socket right after this frame; the close decides. Whether it answered a claim
        // shows at the next named answer: with a claim in flight, a beat brings one.
        if (asked.some((ask) => ask.type === 'claim') && asked.at(-1)?.type !== 'beat') send({ type: 'beat' }, { type: 'beat' });
        break;
    }
  }

  function connect(): void {
    if (!wanted || socket) return;
    const ws = openSocket(options.url);
    socket = ws;
    ws.onopen = () => send({ type: 'hello', deviceId: options.deviceId, printers: [...options.printers] }, { type: 'hello' });
    ws.onmessage = (event) => {
      if (socket === ws) onFrame(event.data, ws);
    };
    ws.onclose = (event) => {
      if (socket !== ws) return;
      teardown();
      if (isFatalClose(event.code)) {
        stopForGood(String(event.code));
        return;
      }
      scheduleReconnect();
    };
    // A close always follows an error: one path reconnects.
    ws.onerror = () => {};
  }

  return {
    start() {
      if (wanted) return;
      wanted = true;
      attempt = 0;
      connect();
    },
    stop() {
      wanted = false;
      if (reconnect !== null) clearTimeout(reconnect);
      reconnect = null;
      teardown();
    },
    running: () => wanted,
  };
}
