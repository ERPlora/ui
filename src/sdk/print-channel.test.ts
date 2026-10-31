// The device's end of the Hub's `/ws/print` (PRINTING-F18; the old hub's `print-drain.ts`, hub#343): it says hello with
// its device and printers, claims each function once, prints what it is handed, confirms or reports the device's error,
// beats as the hub says, is woken by `wake`, reconnects after a drop with a growing wait and never into a refusal.
// A fake socket and fake timers stand in for the server here; the e2e drives the real one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPrintChannel, MAX_ERROR_LENGTH, type PrintChannelEvent, type PrintJob, type PrintSocket } from './print-channel';

class FakeSocket implements PrintSocket {
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(): void {
    this.closed = true;
  }
  open(): void {
    this.onopen?.();
  }
  receive(frame: Record<string, unknown> | string): void {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
  }
  drop(code = 1006): void {
    this.onclose?.({ code });
  }
  types(): unknown[] {
    return this.sent.map((frame) => frame.type);
  }
}

const URL = 'wss://bar.erplora.com/ws/print';
const DEVICE = '0192f0a4-1b2c-7d3e-8f40-123456789abc';

function job(overrides: Partial<PrintJob> = {}): Record<string, unknown> {
  return {
    type: 'job',
    jobId: 'job-1',
    role: 'receipt',
    kind: 'document',
    documentType: 'receipt',
    document: { total: '12.00' },
    copyDocument: null,
    format: 'receipt',
    html: '',
    copies: 1,
    openDrawer: false,
    printerId: 'printer-1',
    target: 'network:192.168.1.50:9100',
    paperWidth: 80,
    attempts: 1,
    ...overrides,
  };
}

/** Lets the print promise and its follow-ups settle. */
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

let sockets: FakeSocket[];
let events: PrintChannelEvent[];
let print: ReturnType<typeof vi.fn<(job: PrintJob) => Promise<void>>>;

function channel(printers: string[] = ['printer-1']) {
  return createPrintChannel({
    url: URL,
    deviceId: DEVICE,
    printers,
    print,
    openSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    onEvent: (event) => events.push(event),
    random: () => 0,
  });
}

/** Starts a channel and brings it to `ready` with these roles. */
function connected(roles = ['receipt'], heartbeatSeconds = 30) {
  const drain = channel();
  drain.start();
  const socket = sockets.at(-1)!;
  socket.open();
  socket.receive({ type: 'ready', deviceId: DEVICE, roles, heartbeatSeconds });
  return { drain, socket };
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  events = [];
  print = vi.fn(async () => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('print channel: connecting', () => {
  it('says hello with its device and the printers of its registration once the socket opens, and nothing before', () => {
    const drain = channel(['printer-1', 'printer-2']);
    drain.start();
    expect(sockets.map((socket) => socket.url)).toEqual([URL]);
    expect(sockets[0].sent).toEqual([]);
    sockets[0].open();
    expect(sockets[0].sent).toEqual([{ type: 'hello', deviceId: DEVICE, printers: ['printer-1', 'printer-2'] }]);
    expect(drain.running()).toBe(true);
  });

  it('start is idempotent: one socket however many times it is called', () => {
    const drain = channel();
    drain.start();
    drain.start();
    expect(sockets).toHaveLength(1);
  });

  it('claims each function the hub says it prints, once, and says it is connected', () => {
    const { socket } = connected(['kitchen', 'receipt']);
    expect(socket.sent.slice(1)).toEqual([
      { type: 'claim', role: 'kitchen' },
      { type: 'claim', role: 'receipt' },
    ]);
    expect(events).toContainEqual({ kind: 'connected', roles: ['kitchen', 'receipt'] });
  });

  it('ignores a frame that is not JSON, or not of the protocol, and keeps the socket', () => {
    const { socket } = connected();
    socket.receive('not json');
    socket.receive({ type: 'surprise' });
    expect(socket.closed).toBe(false);
    expect(sockets).toHaveLength(1);
  });
});

describe('print channel: one claim per function', () => {
  it('a wake while a claim of that function is in flight claims nothing more', () => {
    const { socket } = connected();
    socket.receive({ type: 'wake', role: 'receipt' });
    socket.receive({ type: 'wake', role: 'receipt' });
    expect(socket.sent.filter((frame) => frame.type === 'claim')).toHaveLength(1);
  });

  it('idle frees the function: the next wake claims it again', () => {
    const { socket } = connected();
    socket.receive({ type: 'idle', role: 'receipt' });
    socket.receive({ type: 'wake', role: 'receipt' });
    expect(socket.sent.filter((frame) => frame.type === 'claim')).toEqual([
      { type: 'claim', role: 'receipt' },
      { type: 'claim', role: 'receipt' },
    ]);
  });

  it('a wake while it prints that function waits: the claim after the job picks it up', async () => {
    let finish!: () => void;
    print.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const { socket } = connected();
    socket.receive(job());
    socket.receive({ type: 'wake', role: 'receipt' });
    expect(socket.sent.filter((frame) => frame.type === 'claim')).toHaveLength(1);
    finish();
    await settle();
    expect(socket.sent.slice(-2)).toEqual([
      { type: 'done', jobId: 'job-1' },
      { type: 'claim', role: 'receipt' },
    ]);
  });

  it('a wake of one function claims it even while another one prints', async () => {
    print.mockImplementation(() => new Promise<void>(() => {}));
    const { socket } = connected(['kitchen', 'receipt']);
    socket.receive(job({ role: 'kitchen' }));
    socket.receive({ type: 'idle', role: 'receipt' });
    socket.receive({ type: 'wake', role: 'receipt' });
    expect(socket.sent.at(-1)).toEqual({ type: 'claim', role: 'receipt' });
  });

  it('an error that answers a claim frees that function, so the next wake claims it again', () => {
    const { socket } = connected(['kitchen', 'receipt']);
    socket.receive({ type: 'idle', role: 'kitchen' });
    // The second claim (receipt) is answered with an error: the hub failed.
    socket.receive({ type: 'error', code: 'internal_error', message: 'boom' });
    expect(socket.closed).toBe(false);
    socket.receive({ type: 'wake', role: 'receipt' });
    // Counted, not «the last frame»: the ready's own claim of receipt was already the last one sent.
    expect(socket.sent.filter((frame) => frame.type === 'claim' && frame.role === 'receipt')).toHaveLength(2);
    expect(events).toContainEqual({ kind: 'refused', code: 'internal_error', message: 'boom' });
  });
});

describe('print channel: printing', () => {
  it('hands the job to the device as it came, confirms it, and claims the same function until idle', async () => {
    const { socket } = connected();
    socket.receive(job({ copies: 2, copyDocument: { total: '12.00', duplicate: true }, openDrawer: true }));
    await settle();
    expect(print).toHaveBeenCalledOnce();
    expect(print.mock.calls[0][0]).toMatchObject({
      jobId: 'job-1',
      role: 'receipt',
      kind: 'document',
      documentType: 'receipt',
      document: { total: '12.00' },
      copyDocument: { total: '12.00', duplicate: true },
      copies: 2,
      openDrawer: true,
      target: 'network:192.168.1.50:9100',
      printerId: 'printer-1',
    });
    expect(socket.sent.slice(-2)).toEqual([
      { type: 'done', jobId: 'job-1' },
      { type: 'claim', role: 'receipt' },
    ]);
    socket.receive({ type: 'ack', jobId: 'job-1', confirmed: true });
    socket.receive({ type: 'idle', role: 'receipt' });
    expect(socket.sent.filter((frame) => frame.type === 'claim')).toHaveLength(2);
  });

  it("a print that fails says failed with the device's own error, and stops pulling that function until a wake", async () => {
    print.mockRejectedValue('printer_unreachable: 192.168.1.50:9100 did not answer');
    const { socket } = connected();
    socket.receive(job());
    await settle();
    expect(socket.sent.at(-1)).toEqual({
      type: 'failed',
      jobId: 'job-1',
      error: 'printer_unreachable: 192.168.1.50:9100 did not answer',
    });
    expect(socket.sent.filter((frame) => frame.type === 'claim')).toHaveLength(1);
    expect(events).toContainEqual({
      kind: 'print_failed',
      jobId: 'job-1',
      role: 'receipt',
      message: 'printer_unreachable: 192.168.1.50:9100 did not answer',
    });
    socket.receive({ type: 'ack', jobId: 'job-1', requeued: true });
    socket.receive({ type: 'wake', role: 'receipt' });
    expect(socket.sent.at(-1)).toEqual({ type: 'claim', role: 'receipt' });
  });

  it('tells an Error by its message, anything else as text, and never more than the hub keeps', async () => {
    const { socket } = connected(['bar', 'kitchen', 'receipt']);
    print
      .mockRejectedValueOnce(new Error('out of paper'))
      .mockRejectedValueOnce({ code: 'printer_busy' })
      .mockRejectedValueOnce('x'.repeat(MAX_ERROR_LENGTH + 40));
    socket.receive(job({ jobId: 'a', role: 'bar' }));
    socket.receive(job({ jobId: 'b', role: 'kitchen' }));
    socket.receive(job({ jobId: 'c', role: 'receipt' }));
    await settle();
    const failed = socket.sent.filter((frame) => frame.type === 'failed');
    expect(failed.map((frame) => [frame.jobId, frame.error])).toEqual([
      ['a', 'out of paper'],
      ['b', '{"code":"printer_busy"}'],
      ['c', 'x'.repeat(MAX_ERROR_LENGTH)],
    ]);
    expect(MAX_ERROR_LENGTH).toBe(500);
  });

  it('a failure with no words is still told: the hub needs a reason', async () => {
    print.mockRejectedValue('');
    const { socket } = connected();
    socket.receive(job());
    await settle();
    expect((socket.sent.at(-1)?.error as string).length).toBeGreaterThan(0);
  });
});

describe('print channel: heartbeat', () => {
  it('beats every heartbeatSeconds the hub says', () => {
    const { socket } = connected(['receipt'], 10);
    vi.advanceTimersByTime(9_999);
    expect(socket.types()).not.toContain('beat');
    vi.advanceTimersByTime(1);
    socket.receive({ type: 'beat', refreshed: 1, heartbeatSeconds: 10 });
    vi.advanceTimersByTime(10_000);
    expect(socket.types().filter((type) => type === 'beat')).toHaveLength(2);
  });

  it('a beat answered refreshed 0 (retired, or its printers switched off) stops for good', () => {
    const { drain, socket } = connected();
    vi.advanceTimersByTime(30_000);
    socket.receive({ type: 'beat', refreshed: 0, heartbeatSeconds: 30 });
    expect(socket.closed).toBe(true);
    expect(drain.running()).toBe(false);
    socket.drop(1000);
    vi.advanceTimersByTime(120_000);
    expect(sockets).toHaveLength(1);
    expect(events).toContainEqual({ kind: 'stopped', code: 'print.host_not_registered' });
  });
});

describe('print channel: closing and reconnecting', () => {
  it.each([4400, 4401, 4402, 4403, 4404, 4410, 4413, 4429])('a fatal close (%i) never reconnects', (code) => {
    const { drain, socket } = connected();
    socket.receive({ type: 'error', code: 'unauthenticated', message: 'the session ended' });
    socket.drop(code);
    vi.advanceTimersByTime(600_000);
    expect(sockets).toHaveLength(1);
    expect(drain.running()).toBe(false);
    expect(events).toContainEqual({ kind: 'stopped', code: String(code) });
  });

  it('a dropped connection reconnects with a growing wait, up to its cap', () => {
    const drain = channel();
    drain.start();
    const waits: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const before = sockets.length;
      sockets.at(-1)!.drop(1006);
      let waited = 0;
      while (sockets.length === before) {
        vi.advanceTimersByTime(100);
        waited += 100;
      }
      waits.push(waited);
    }
    expect(waits).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
    expect(drain.running()).toBe(true);
  });

  it.each([1000, 1001, 1006, 1011, 4503])('a close the hub comes back from (%i) reconnects', (code) => {
    const { socket } = connected();
    socket.drop(code);
    vi.advanceTimersByTime(1_000);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(sockets[1].sent[0]).toEqual({ type: 'hello', deviceId: DEVICE, printers: ['printer-1'] });
  });

  it('ready resets the wait: the next drop waits the shortest time again', () => {
    const drain = channel();
    drain.start();
    sockets[0].drop();
    vi.advanceTimersByTime(1_000);
    sockets[1].drop();
    vi.advanceTimersByTime(2_000);
    sockets[2].open();
    sockets[2].receive({ type: 'ready', deviceId: DEVICE, roles: ['receipt'], heartbeatSeconds: 30 });
    sockets[2].drop();
    vi.advanceTimersByTime(1_000);
    expect(sockets).toHaveLength(4);
  });

  it('stops beating once the socket is gone', () => {
    const { socket } = connected();
    socket.drop();
    vi.advanceTimersByTime(30_000);
    expect(socket.types()).not.toContain('beat');
  });

  it('a confirmation the hub had not acknowledged is sent again after the next ready, before any claim', async () => {
    const { socket } = connected();
    socket.receive(job({ jobId: 'job-9' }));
    await settle();
    socket.drop();
    vi.advanceTimersByTime(1_000);
    const next = sockets[1];
    next.open();
    next.receive({ type: 'ready', deviceId: DEVICE, roles: ['receipt'], heartbeatSeconds: 30 });
    expect(next.sent).toEqual([
      { type: 'hello', deviceId: DEVICE, printers: ['printer-1'] },
      { type: 'done', jobId: 'job-9' },
      { type: 'claim', role: 'receipt' },
    ]);
    next.receive({ type: 'ack', jobId: 'job-9', confirmed: true });
    next.drop();
    vi.advanceTimersByTime(1_000);
    sockets[2].open();
    sockets[2].receive({ type: 'ready', deviceId: DEVICE, roles: ['receipt'], heartbeatSeconds: 30 });
    expect(sockets[2].types()).toEqual(['hello', 'claim']);
  });

  it('stop closes the socket, and nothing reconnects or beats after it', () => {
    const { drain, socket } = connected();
    drain.stop();
    expect(socket.closed).toBe(true);
    socket.drop(1006);
    vi.advanceTimersByTime(600_000);
    expect(sockets).toHaveLength(1);
    expect(socket.types()).not.toContain('beat');
    expect(drain.running()).toBe(false);
  });

  it('a job that finishes printing after stop is not confirmed on a dead socket, nor claimed again', async () => {
    let finish!: () => void;
    print.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const { drain, socket } = connected();
    socket.receive(job());
    drain.stop();
    const before = socket.sent.length;
    finish();
    await settle();
    expect(socket.sent).toHaveLength(before);
  });
});
