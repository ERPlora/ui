// The device that prints for the hub (PRINTING-F18; the old hub's `bootPrintHost`, hub#343 and hub#501): inside the
// installed app, on a device set up to print, it keeps the hub's `/ws/print` open (the SDK's `print-channel.ts`) and turns every
// job into paper with the app's commands (`device-printer.ts`). The project says which printers the device's
// registration has — `null` while it is not set up here, or once it was retired — and the host follows it: it says
// hello again when they change and closes the channel when there are none. A browser opens nothing: there is no
// printer it could reach, and a device that took jobs it cannot print would burn their five hand-outs.
// Refusals and failed prints go to the log (`console.warn`): this runs unattended, and the queue shows the rest.
import { onBeforeUnmount, type Ref, watch } from 'vue';

import { useLiveClient } from '../sdk/live-client';
import { type NativeBridge, nativeBridge } from './device-notices';
import { createDevicePrinter } from './device-printer';
import {
  createPrintChannel,
  type PrintChannel,
  type PrintChannelEvent,
  type PrintJob,
  type PrintSocket,
} from '../sdk/print-channel';

/** Enough of `window.location` to name the channel. */
export interface PageLocation {
  protocol: string;
  host: string;
}

/** `/ws/print` on the page's own host and scheme: a hub on https refuses a `ws://` socket as mixed content. */
export function printChannelUrl(location: PageLocation): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/print`;
}

export interface PrintHostDeps {
  bridge: Pick<NativeBridge, 'invoke'>;
  /** The device's own id (`X-Device-Id`). */
  deviceId: string;
  url: string;
  openSocket?: (url: string) => PrintSocket;
  onDrawerFailed?: (job: PrintJob, error: unknown) => void;
}

export interface PrintHost {
  /** The printers of the device's registration; `null`, `undefined` or none = it prints nothing here. */
  update(printers: readonly string[] | null | undefined): void;
  stop(): void;
}

function log(event: PrintChannelEvent): void {
  if (event.kind === 'refused') console.warn('[print-host]', 'refused', event.code, event.message);
  else if (event.kind === 'print_failed') console.warn('[print-host]', 'print failed', event.jobId, event.message);
  else if (event.kind === 'stopped') console.warn('[print-host]', 'stopped', event.code);
}

export function createPrintHost(deps: PrintHostDeps): PrintHost {
  const print = createDevicePrinter({ invoke: deps.bridge.invoke, onDrawerFailed: deps.onDrawerFailed });
  let channel: PrintChannel | null = null;
  let current = '';

  function stop(): void {
    channel?.stop();
    channel = null;
    current = '';
  }

  return {
    update(printers) {
      const ids = [...new Set(printers ?? [])].sort();
      const key = ids.join(',');
      if (key === current && channel) return;
      stop();
      if (ids.length === 0) return;
      current = key;
      channel = createPrintChannel({
        url: deps.url,
        deviceId: deps.deviceId,
        printers: ids,
        print,
        openSocket: deps.openSocket,
        onEvent: log,
      });
      channel.start();
    },
    stop,
  };
}

export interface UsePrintHostOptions {
  /** The drawer did not open (the person at the till expects it to): the project tells them. */
  onDrawerFailed?: (job: PrintJob, error: unknown) => void;
}

/**
 * Keeps this device printing for the hub while the component lives, following `printers` (the printers of its
 * registration, `null` when it is not set up here). Only inside the installed app.
 */
export function usePrintHost(printers: Ref<readonly string[] | null | undefined>, options: UsePrintHostOptions = {}): void {
  const bridge = nativeBridge();
  if (!bridge) return;
  const host = createPrintHost({
    bridge,
    deviceId: useLiveClient().deviceId,
    url: printChannelUrl(window.location),
    onDrawerFailed: options.onDrawerFailed,
  });
  watch(printers, (next) => host.update(next), { immediate: true });
  onBeforeUnmount(() => host.stop());
}
