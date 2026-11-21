import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NativeBridge } from './native-bridge';
import { createNoticeListening, KEEP_LISTENING_COMMAND } from './notice-listening';

/** An app that refuses every `keep_listening` with `refusal`. */
const refusingEvery = (refusal: string) =>
  ({
    invoke: vi.fn<NativeBridge['invoke']>(async (command) => {
      if (command === KEEP_LISTENING_COMMAND) throw refusal;
      return null;
    }),
  }) satisfies NativeBridge;

const asked = (bridge: ReturnType<typeof refusingEvery>) =>
  bridge.invoke.mock.calls.filter(([command]) => command === KEEP_LISTENING_COMMAND).map(([, args]) => args);

describe('createNoticeListening — a stop the app refuses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('for a reason of its own is written down, and the next stop or start is asked again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bridge = refusingEvery('ForegroundServiceNotRunning');
    const listening = createNoticeListening({ bridge, t: (key) => key, wait: async () => {} });

    await expect(listening.sync(false)).resolves.toBeUndefined();
    await expect(listening.sync(false)).resolves.toBeUndefined();

    expect(asked(bridge)).toEqual([{ on: false }, { on: false }]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('from an app older than the command ends the asking on this page, a later start included', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bridge = refusingEvery('Command keep_listening not found');
    const listening = createNoticeListening({ bridge, t: (key) => key, wait: async () => {} });

    await listening.sync(false);
    await listening.sync(true);

    expect(asked(bridge)).toEqual([{ on: false }]);
  });
});
