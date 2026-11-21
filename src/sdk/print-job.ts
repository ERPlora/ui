// A print job as the hub hands it in a `job` frame, and the device's error as the hub keeps it in a `failed` one.

/** A job as the hub hands it in a `job` frame, camelCased. */
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

/** The longest error the hub keeps (`printing`'s `DeviceError`): a longer one would be refused as a bad frame. */
export const MAX_ERROR_LENGTH = 500;

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

export function jobOf(frame: Record<string, unknown>): PrintJob {
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
