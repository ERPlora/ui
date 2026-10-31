// The device that prints for the hub (PRINTING-F18): inside the installed app and only for a device set up to print
// (the printers of its registration), it keeps the hub's `/ws/print` open on the page's own host, with the device id the
// SDK sends, and its jobs go to the app's commands; a browser, or a device not set up, opens nothing.
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LIVE_CLIENT_KEY, type LiveClient } from '../sdk/live-client';
import type { PrintSocket } from '../sdk/print-channel';
import { createPrintHost, printChannelUrl, usePrintHost } from './print-host';

const DEVICE = '0192f0a4-1b2c-7d3e-8f40-123456789abc';

class FakeSocket implements PrintSocket {
  static made: FakeSocket[] = [];
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.made.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(): void {
    this.closed = true;
  }
  receive(frame: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

const settle = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

beforeEach(() => {
  FakeSocket.made = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { __TAURI__?: unknown }).__TAURI__;
});

describe('printChannelUrl', () => {
  it("is the page's own host, wss on https and ws on http (a hard-coded ws:// would be mixed content)", () => {
    expect(printChannelUrl({ protocol: 'https:', host: 'bar.erplora.com' })).toBe('wss://bar.erplora.com/ws/print');
    expect(printChannelUrl({ protocol: 'http:', host: 'a.localhost:8000' })).toBe('ws://a.localhost:8000/ws/print');
  });
});

describe('createPrintHost', () => {
  function host() {
    const invoke = vi.fn(async () => null);
    return {
      invoke,
      host: createPrintHost({
        bridge: { invoke },
        deviceId: DEVICE,
        url: 'wss://bar.erplora.com/ws/print',
        openSocket: (url) => new FakeSocket(url),
      }),
    };
  }

  it('opens nothing for a device not set up to print here', () => {
    const { host: printing } = host();
    printing.update(null);
    printing.update(undefined);
    printing.update([]);
    expect(FakeSocket.made).toEqual([]);
  });

  it('a device set up says hello with its own id and the printers of its registration', () => {
    const { host: printing } = host();
    printing.update(['printer-2', 'printer-1']);
    expect(FakeSocket.made.map((socket) => socket.url)).toEqual(['wss://bar.erplora.com/ws/print']);
    FakeSocket.made[0].onopen?.();
    expect(FakeSocket.made[0].sent).toEqual([{ type: 'hello', deviceId: DEVICE, printers: ['printer-1', 'printer-2'] }]);
  });

  it('the same printers in another order keep the channel; other printers say hello again', () => {
    const { host: printing } = host();
    printing.update(['printer-1', 'printer-2']);
    printing.update(['printer-2', 'printer-1']);
    expect(FakeSocket.made).toHaveLength(1);
    printing.update(['printer-1']);
    expect(FakeSocket.made).toHaveLength(2);
    expect(FakeSocket.made[0].closed).toBe(true);
  });

  it('a channel the hub refused for good (4402, 4403, 4404) opens again at the next update, the same printers too', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { host: printing } = host();
    printing.update(['p1']);
    FakeSocket.made[0].onclose?.({ code: 4404 });
    expect(FakeSocket.made).toHaveLength(1);
    // Printing switched on again (or the invoice paid): the registration is read again and the channel opens again.
    printing.update(['p1']);
    expect(FakeSocket.made).toHaveLength(2);
    FakeSocket.made[1].onopen?.();
    expect(FakeSocket.made[1].sent).toEqual([{ type: 'hello', deviceId: DEVICE, printers: ['p1'] }]);
    // Never on its own: a refusal is not retried until something asks for it.
    FakeSocket.made[1].onclose?.({ code: 4402 });
    expect(FakeSocket.made).toHaveLength(2);
  });

  it('a device retired stops printing, and stop closes the channel', () => {
    const { host: printing } = host();
    printing.update(['printer-1']);
    printing.update(null);
    expect(FakeSocket.made[0].closed).toBe(true);
    printing.update(['printer-1']);
    printing.stop();
    expect(FakeSocket.made[1].closed).toBe(true);
  });

  it("hands each job to the app's commands and confirms it", async () => {
    const { host: printing, invoke } = host();
    printing.update(['printer-1']);
    const socket = FakeSocket.made[0];
    socket.onopen?.();
    socket.receive({ type: 'ready', deviceId: DEVICE, roles: ['receipt'], heartbeatSeconds: 30 });
    socket.receive({
      type: 'job',
      jobId: 'job-1',
      role: 'receipt',
      kind: 'document',
      documentType: 'receipt',
      document: { total: '1.00' },
      copyDocument: null,
      format: 'receipt',
      html: '',
      copies: 1,
      openDrawer: false,
      printerId: 'printer-1',
      target: 'network:10.0.0.9:9100',
      paperWidth: 80,
      attempts: 1,
    });
    await settle();
    expect(invoke).toHaveBeenCalledWith('erplora_print', {
      printerId: 'network:10.0.0.9:9100',
      documentType: 'receipt',
      data: { total: '1.00' },
      jobId: 'job-1',
    });
    expect(socket.sent.at(-2)).toEqual({ type: 'done', jobId: 'job-1' });
  });

  it('writes refusals and failed prints to the log: an unattended device has nobody to tell', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { host: printing } = host();
    printing.update(['printer-1']);
    const socket = FakeSocket.made[0];
    socket.onopen?.();
    socket.receive({ type: 'error', code: 'print.host_not_registered', message: 'not set up' });
    expect(warn).toHaveBeenCalledWith('[print-host]', 'refused', 'print.host_not_registered', 'not set up');
    warn.mockRestore();
  });
});

describe('usePrintHost', () => {
  function mountHost(printers: Ref<readonly string[] | null | undefined>, onDrawerFailed = vi.fn()) {
    const client = { deviceId: DEVICE } as unknown as LiveClient;
    const Host = defineComponent({
      setup() {
        usePrintHost(printers, { onDrawerFailed });
        return () => h('span');
      },
    });
    return mount(Host, { global: { provide: { [LIVE_CLIENT_KEY as symbol]: client } } });
  }

  it('in a browser (no app bridge) opens nothing, set up or not', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    mountHost(ref(['printer-1']));
    await nextTick();
    expect(FakeSocket.made).toEqual([]);
  });

  it("inside the app, follows the device's registration on the page's host, and stops when unmounted", async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    (window as { __TAURI__?: unknown }).__TAURI__ = { core: { invoke: vi.fn(async () => null) } };
    const printers = ref<readonly string[] | null>(null);
    const wrapper = mountHost(printers);
    await nextTick();
    expect(FakeSocket.made).toEqual([]);
    printers.value = ['printer-1'];
    await nextTick();
    expect(FakeSocket.made.map((socket) => socket.url)).toEqual([printChannelUrl(window.location)]);
    FakeSocket.made[0].onopen?.();
    expect(FakeSocket.made[0].sent[0]).toEqual({ type: 'hello', deviceId: DEVICE, printers: ['printer-1'] });
    wrapper.unmount();
    expect(FakeSocket.made[0].closed).toBe(true);
  });

  it('tells the page when the drawer did not open', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invoke = vi.fn(async (command: string) => {
      if (command === 'erplora_open_drawer') throw 'printer_unreachable';
      return null;
    });
    (window as { __TAURI__?: unknown }).__TAURI__ = { core: { invoke } };
    const onDrawerFailed = vi.fn();
    mountHost(ref(['printer-1']), onDrawerFailed);
    await nextTick();
    const socket = FakeSocket.made[0];
    socket.onopen?.();
    socket.receive({ type: 'ready', deviceId: DEVICE, roles: ['receipt'], heartbeatSeconds: 30 });
    socket.receive({ type: 'job', jobId: 'j', role: 'receipt', kind: 'drawer', target: 'network:10.0.0.9:9100' });
    await settle();
    expect(onDrawerFailed).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'j' }), 'printer_unreachable');
    expect(socket.sent.at(-1)).toEqual({ type: 'failed', jobId: 'j', error: 'printer_unreachable' });
  });
});
