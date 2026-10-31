// A job of the hub's queue becoming paper in the installed app (PRINTING-F18, F05 and F13; the old hub's
// `print-host.ts`, hub#501, and hub#2724): each kind goes to the app's command for it — `erplora_print` for a document
// (its first copy as the original, the rest as the hub says), `print_document` for an A4 page, `erplora_test_print`
// for the test sheet, `erplora_open_drawer` for the drawer —, every refusal comes back as the job's failure, and a
// drawer that does not open after the paper is told without failing the paper that came out.
import { describe, expect, it, vi } from 'vitest';

import type { PrintJob } from '../sdk/print-channel';
import { NOT_THE_LINKED_HUB } from './device-notices';
import { createDevicePrinter } from './device-printer';

function job(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
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

const noWait = async () => {};

function printer(answer: (command: string, args?: Record<string, unknown>) => Promise<unknown> = async () => null) {
  const invoke = vi.fn(answer);
  const onDrawerFailed = vi.fn();
  return { invoke, onDrawerFailed, print: createDevicePrinter({ invoke, onDrawerFailed, wait: noWait }) };
}

describe('device printer: documents', () => {
  it('prints a document with erplora_print on its printer, with its type, its data and its job', async () => {
    const { invoke, print } = printer();
    await print(job());
    expect(invoke.mock.calls).toEqual([
      [
        'erplora_print',
        { printerId: 'network:192.168.1.50:9100', documentType: 'receipt', data: { total: '12.00' }, jobId: 'job-1' },
      ],
    ]);
  });

  it('the first copy is the original and every other one the copy the hub sent (DUPLICADO)', async () => {
    const { invoke, print } = printer();
    await print(job({ copies: 3, copyDocument: { total: '12.00', duplicate: true } }));
    expect(invoke.mock.calls.map(([, args]) => args?.data)).toEqual([
      { total: '12.00' },
      { total: '12.00', duplicate: true },
      { total: '12.00', duplicate: true },
    ]);
  });

  it('with copies but no copy document, every copy prints the document', async () => {
    const { invoke, print } = printer();
    await print(job({ documentType: 'kitchen_order', copies: 2, copyDocument: null }));
    expect(invoke.mock.calls.map(([, args]) => args?.data)).toEqual([{ total: '12.00' }, { total: '12.00' }]);
  });

  it("an A4 job goes to the system's print with its page", async () => {
    const { invoke, print } = printer();
    await print(job({ format: 'a4', html: '<html><body>Invoice</body></html>', target: 'system:' }));
    expect(invoke.mock.calls).toEqual([['print_document', { html: '<html><body>Invoice</body></html>' }]]);
  });

  it("the printer's refusal is the job's failure, as the app says it, and no more copies are tried", async () => {
    const { invoke, print } = printer(async () => {
      throw 'printer_unreachable: 192.168.1.50:9100';
    });
    await expect(print(job({ copies: 2, copyDocument: { duplicate: true } }))).rejects.toBe(
      'printer_unreachable: 192.168.1.50:9100',
    );
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('a kind it does not know fails with its name: the queue shows why', async () => {
    const { invoke, print } = printer();
    await expect(print(job({ kind: 'hologram' }))).rejects.toThrow('hologram');
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('device printer: the test sheet (PRINTING-F05)', () => {
  it('prints the test sheet with erplora_test_print on its printer, with what the hub filled in', async () => {
    const { invoke, print } = printer();
    await print(job({ kind: 'test_page', documentType: '', document: { business_name: 'Bar Pepe', locale: 'es' } }));
    expect(invoke.mock.calls).toEqual([
      ['erplora_test_print', { printerId: 'network:192.168.1.50:9100', data: { business_name: 'Bar Pepe', locale: 'es' } }],
    ]);
  });

  it("a system printer's test sheet is its A4 page", async () => {
    const { invoke, print } = printer();
    await print(job({ kind: 'test_page', format: 'a4', html: '<p>Printer OK</p>' }));
    expect(invoke.mock.calls).toEqual([['print_document', { html: '<p>Printer OK</p>' }]]);
  });
});

describe('device printer: the drawer (PRINTING-F13, hub#2724)', () => {
  it('opens the drawer of the receipt printer after the paper, when the job says so', async () => {
    const { invoke, print, onDrawerFailed } = printer();
    await print(job({ openDrawer: true, copies: 2, copyDocument: { duplicate: true } }));
    expect(invoke.mock.calls.map(([command]) => command)).toEqual(['erplora_print', 'erplora_print', 'erplora_open_drawer']);
    expect(invoke.mock.calls[2][1]).toEqual({ printerId: 'network:192.168.1.50:9100' });
    expect(onDrawerFailed).not.toHaveBeenCalled();
  });

  it('a drawer that does not open is told, and the paper that came out is still printed (no second ticket)', async () => {
    const { print, onDrawerFailed } = printer(async (command) => {
      if (command === 'erplora_open_drawer') throw 'printer_unreachable: 192.168.1.50:9100';
      return null;
    });
    await expect(print(job({ openDrawer: true }))).resolves.toBeUndefined();
    expect(onDrawerFailed).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1' }), 'printer_unreachable: 192.168.1.50:9100');
  });

  it('a ticket that does not print opens no drawer: the drawer goes with the paper', async () => {
    const { invoke, print, onDrawerFailed } = printer(async () => {
      throw 'out of paper';
    });
    await expect(print(job({ openDrawer: true }))).rejects.toBe('out of paper');
    expect(invoke.mock.calls.map(([command]) => command)).toEqual(['erplora_print']);
    expect(onDrawerFailed).not.toHaveBeenCalled();
  });

  it("a drawer-only job opens the drawer, and its refusal is the job's failure and is told", async () => {
    const { invoke, print, onDrawerFailed } = printer(async () => {
      throw 'printer_unreachable';
    });
    await expect(print(job({ kind: 'drawer', documentType: '', document: {} }))).rejects.toBe('printer_unreachable');
    expect(invoke.mock.calls).toEqual([['erplora_open_drawer', { printerId: 'network:192.168.1.50:9100' }]]);
    expect(onDrawerFailed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'drawer' }), 'printer_unreachable');
  });

  it('a drawer hook that throws breaks nothing: the paper is still printed', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'erplora_open_drawer') throw 'no';
      return null;
    });
    const print = createDevicePrinter({
      invoke,
      onDrawerFailed: () => {
        throw new Error('the toast broke');
      },
      wait: noWait,
    });
    await expect(print(job({ openDrawer: true }))).resolves.toBeUndefined();
  });
});

describe('device printer: the app still landing on the hub', () => {
  it('asks again while the app says it is not the linked hub yet, then prints', async () => {
    let refusals = 2;
    const { invoke, print } = printer(async () => {
      if (refusals > 0) {
        refusals -= 1;
        throw NOT_THE_LINKED_HUB;
      }
      return null;
    });
    await print(job());
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('a hub the app never links to fails the job with that refusal', async () => {
    const { print } = printer(async () => {
      throw NOT_THE_LINKED_HUB;
    });
    await expect(print(job())).rejects.toBe(NOT_THE_LINKED_HUB);
  });
});
