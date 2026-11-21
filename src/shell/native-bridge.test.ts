import { afterEach, describe, expect, it, vi } from 'vitest';

import { afterTheLoad, isOlderAppRefusal, nativeBridge, NOT_THE_LINKED_HUB, whileTheHubLands } from './native-bridge';
import { NO_SUCH_COMMAND } from './__tests__/device-notices';

describe('whileTheHubLands — asking the app again while the hub lands', () => {
  it('the app saying it in an Error counts too: asked again, and its answer comes back', async () => {
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error(NOT_THE_LINKED_HUB))
      .mockResolvedValueOnce('printed');

    await expect(whileTheHubLands(attempt, async () => {})).resolves.toBe('printed');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('waits a little longer each time, about eight seconds in all, then the last refusal comes back', async () => {
    const attempt = vi.fn(async () => {
      throw 'not_the_linked_hub';
    });
    const wait = vi.fn<(ms: number) => Promise<void>>(async () => {});

    await expect(whileTheHubLands(attempt, wait)).rejects.toBe('not_the_linked_hub');
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([250, 500, 1000, 2000, 4000]);
    expect(attempt).toHaveBeenCalledTimes(6);
  });
});

describe('afterTheLoad — the wait starts once the page has loaded', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('on a page still loading, nothing is counted until its load', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    let done = false;
    void afterTheLoad(250).then(() => (done = true));

    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(250);
    expect(done).toBe(true);
  });

  it('on a page already loaded, it is the time asked and no less', async () => {
    vi.useFakeTimers();
    let done = false;
    void afterTheLoad(250).then(() => (done = true));

    await vi.advanceTimersByTimeAsync(249);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});

describe('isOlderAppRefusal — Tauri refusing a command the installed app does not have', () => {
  it('is the ACL that knows no such permission, or no such command, said as text or as an Error', () => {
    expect(isOlderAppRefusal(NO_SUCH_COMMAND)).toBe(true);
    expect(isOlderAppRefusal('Command keep_listening not found')).toBe(true);
    expect(isOlderAppRefusal(new Error('plugin:erplora-android|keep_listening not allowed'))).toBe(true);
  });

  it('is not the app saying no for a reason of its own, nor anything that is not a refusal', () => {
    expect(isOlderAppRefusal(NOT_THE_LINKED_HUB)).toBe(false);
    expect(isOlderAppRefusal('downloads_unreachable')).toBe(false);
    expect(isOlderAppRefusal(new Error('boom'))).toBe(false);
    expect(isOlderAppRefusal(undefined)).toBe(false);
    expect(isOlderAppRefusal({ message: 'not found' })).toBe(false);
  });
});

describe('nativeBridge — the installed app, through the global Tauri leaves', () => {
  it('is the app’s invoke, plugin listener and event listener; null in a browser', () => {
    const invoke = vi.fn();
    const addPluginListener = vi.fn();
    const listen = vi.fn();
    const bridge = nativeBridge({ __TAURI__: { core: { invoke, addPluginListener }, event: { listen } } });

    expect(bridge?.invoke).toBe(invoke);
    expect(bridge?.addPluginListener).toBe(addPluginListener);
    expect(bridge?.listen).toBe(listen);
    expect(nativeBridge({})).toBeNull();
    expect(nativeBridge({ __TAURI__: {} })).toBeNull();
  });
});
