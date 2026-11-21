import { describe, expect, it } from 'vitest';

import { errorText, jobOf, MAX_ERROR_LENGTH } from './print-job';

const JOB = {
  jobId: 'j1',
  role: 'kitchen',
  kind: 'test_page',
  documentType: 'order',
  document: { lines: [] },
  copyDocument: { duplicate: true },
  format: 'a4',
  html: '<p>Hi</p>',
  copies: 2,
  openDrawer: true,
  printerId: 'p1',
  target: 'network:10.0.0.9:9100',
  paperWidth: 80,
  attempts: 3,
};

describe('errorText', () => {
  it('keeps a string, an Error by its message, and anything else as JSON', () => {
    expect([errorText('No paper'), errorText(new Error('Printer offline')), errorText({ code: 7 })]).toEqual([
      'No paper',
      'Printer offline',
      '{"code":7}',
    ]);
  });

  it('writes with String() what JSON cannot', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect([errorText(undefined), errorText(loop), errorText(10n)]).toEqual(['undefined', '[object Object]', '10']);
  });

  it('trims, is never empty, and is cut at the length the hub keeps once trimmed', () => {
    expect([errorText('  jam  '), errorText('   '), errorText(new Error(''))]).toEqual([
      'jam',
      'the device could not print',
      'the device could not print',
    ]);
    expect(errorText(` ${'x'.repeat(MAX_ERROR_LENGTH + 1)}`)).toBe('x'.repeat(MAX_ERROR_LENGTH));
    expect(MAX_ERROR_LENGTH).toBe(500);
  });
});

describe('jobOf', () => {
  it('reads every field of a job frame', () => {
    expect(jobOf({ type: 'job', ...JOB })).toEqual(JOB);
  });

  it('fills what the frame leaves out: a document on a receipt, one copy, no drawer', () => {
    expect(jobOf({ type: 'job' })).toEqual({
      jobId: '',
      role: '',
      kind: 'document',
      documentType: '',
      document: {},
      copyDocument: null,
      format: 'receipt',
      html: '',
      copies: 1,
      openDrawer: false,
      printerId: '',
      target: '',
      paperWidth: 0,
      attempts: 0,
    });
  });

  it('takes text only from strings, a copy only from an object, and copies only as a positive whole number', () => {
    const odd = jobOf({ jobId: 7, role: null, copyDocument: ['a'], copies: 1.5, openDrawer: 'yes', paperWidth: 'wide', attempts: '2' });
    expect([odd.jobId, odd.role, odd.copyDocument, odd.copies, odd.openDrawer, odd.paperWidth, odd.attempts]).toEqual([
      '',
      '',
      null,
      1,
      false,
      0,
      2,
    ]);
    expect([jobOf({ copies: 0 }).copies, jobOf({ copies: -2 }).copies, jobOf({ copies: 3 }).copies]).toEqual([1, 1, 3]);
    expect([jobOf({ copyDocument: null }).copyDocument, jobOf({ copyDocument: 'x' }).copyDocument]).toEqual([null, null]);
  });

  it('passes a document on as it came, even one that is not an object', () => {
    expect([jobOf({ document: 'broken' }).document, jobOf({ document: null }).document]).toEqual(['broken', {}]);
  });
});
