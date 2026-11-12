// The `print` that `print-channel.ts` takes: each kind of job goes to the installed app's command for it, with the
// printer as the app names it (`target`). Every copy after the first prints the duplicate the hub sent, if it sent one
// (RD 1619/2012 art. 14.4). There is no fallback: this runs unattended, so every refusal of the app fails the job and
// the hub keeps it in the queue. A drawer that does not open after the paper came out does not fail the job, since
// the hub would print the ticket again; it is reported through `onDrawerFailed`, like a drawer-only job that fails.
import type { PrintJob } from '../sdk/print-channel';
import { afterTheLoad, type NativeBridge, whileTheHubLands } from './device-notices';

export interface DevicePrinterDeps {
  invoke: NativeBridge['invoke'];
  /** The drawer did not open: the job, and the app's error. Never breaks the printing. */
  onDrawerFailed?: (job: PrintJob, error: unknown) => void;
  /** Between the attempts while the app says the hub is still landing (tests). */
  wait?: (ms: number) => Promise<void>;
}

export function createDevicePrinter(deps: DevicePrinterDeps): (job: PrintJob) => Promise<void> {
  const wait = deps.wait ?? afterTheLoad;
  // The first job of a reopened page can arrive before the app lets it drive, so it is asked again while it lands.
  const run = (command: string, args: Record<string, unknown>) => whileTheHubLands(() => deps.invoke(command, args), wait);

  function drawerFailed(job: PrintJob, error: unknown): void {
    console.warn('[print-host] the drawer did not open', job.jobId, error);
    try {
      deps.onDrawerFailed?.(job, error);
    } catch (hook) {
      console.warn('[print-host] the drawer notice failed', hook);
    }
  }

  async function openDrawer(job: PrintJob): Promise<void> {
    await run('erplora_open_drawer', { printerId: job.target });
  }

  async function paper(job: PrintJob): Promise<void> {
    if (job.format === 'a4') {
      await run('print_document', { html: job.html });
      return;
    }
    for (let copy = 0; copy < Math.max(1, job.copies); copy += 1) {
      const data = copy === 0 ? job.document : (job.copyDocument ?? job.document);
      await run('erplora_print', { printerId: job.target, documentType: job.documentType, data, jobId: job.jobId });
    }
  }

  return async function print(job: PrintJob): Promise<void> {
    switch (job.kind) {
      case 'document':
        await paper(job);
        break;
      case 'test_page':
        if (job.format === 'a4') await run('print_document', { html: job.html });
        else await run('erplora_test_print', { printerId: job.target, data: job.document });
        break;
      case 'drawer':
        try {
          await openDrawer(job);
        } catch (error) {
          drawerFailed(job, error);
          throw error;
        }
        return;
      default:
        throw new Error(`this app does not print jobs of kind «${job.kind}»`);
    }
    if (!job.openDrawer) return;
    try {
      await openDrawer(job);
    } catch (error) {
      drawerFailed(job, error);
    }
  };
}
