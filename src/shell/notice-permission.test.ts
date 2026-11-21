import { describe, expect, it, vi } from 'vitest';

import { type NativeBridge, NOT_THE_LINKED_HUB } from './native-bridge';
import { ANDROID_NOTIFICATIONS, askToNotify, noticesAllowed, PRIMER_ANSWERED_KEY } from './notice-permission';
import { app, memory } from './__tests__/device-notices';

/** The installed app, answering Android's `check_permissions` with `status()`. */
const android = (status: () => unknown) =>
  ({
    invoke: vi.fn(async (command: string) => (command === 'plugin:erplora-android|check_permissions' ? status() : null)),
  }) satisfies NativeBridge;

/** Android's status, after one answer saying the hub is still landing. */
const landingOnce = (status: unknown) => {
  let landing = true;
  return () => {
    if (!landing) return status;
    landing = false;
    throw 'not_the_linked_hub';
  };
};

/** The device's memory, already holding `held`. */
const device = (held: Record<string, string> = {}) => {
  const items = new Map(Object.entries(held));
  return { getItem: (key: string) => items.get(key) ?? null, setItem: items.set.bind(items) };
};

const REFUSED = { 'android.permission.POST_NOTIFICATIONS': false };
const now = async () => {};

describe('noticesAllowed — what Android says about the notices', () => {
  it.each([
    ['refused', REFUSED, false],
    ['granted', { 'android.permission.POST_NOTIFICATIONS': true }, true],
    ['not a permission to give (below Android 13, a computer)', {}, true],
    ['not said (the plugin answered nothing)', null, null],
  ])('%s', async (_case, status, said) => {
    await expect(noticesAllowed(android(() => status), now)).resolves.toBe(said);
  });

  it('unknown when the read fails', async () => {
    const unreadable = android(() => {
      throw new Error('plugin erplora-android not found');
    });

    await expect(noticesAllowed(unreadable, now)).resolves.toBeNull();
  });

  it('asks again, after the wait it is given, while the app says the hub is still landing', async () => {
    const wait = vi.fn<(ms: number) => Promise<void>>(async () => {});

    await expect(noticesAllowed(android(landingOnce(REFUSED)), wait)).resolves.toBe(false);
    expect(wait).toHaveBeenCalledWith(250);
  });
});

describe('askToNotify — what the device does with the answer to our sentence', () => {
  const requested = (bridge: ReturnType<typeof android>) =>
    bridge.invoke.mock.calls.filter(([command]) => command === 'plugin:erplora-android|request_permissions');

  it('a device that answered before, under the name devices already hold, is not asked again', async () => {
    const bridge = android(() => REFUSED);
    const confirm = vi.fn(async () => true);

    await askToNotify({ bridge, storage: device({ 'erplora.notifications.primerAnswered': '1' }), confirm, wait: now });

    expect(confirm).not.toHaveBeenCalled();
    expect(bridge.invoke).not.toHaveBeenCalled();
  });

  it('a sentence that could not be shown counts as «Not now»: Android is not asked, and it is remembered', async () => {
    const bridge = android(() => REFUSED);
    const storage = device();

    await askToNotify({ bridge, storage, confirm: () => Promise.reject(new Error('no alert')), wait: now });

    expect(requested(bridge)).toEqual([]);
    expect(storage.getItem('erplora.notifications.primerAnswered')).toBe('1');
  });

  it('while the app says the hub is still landing, it waits as it is told before asking again', async () => {
    const wait = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const confirm = vi.fn(async () => false);

    await askToNotify({ bridge: android(landingOnce(REFUSED)), storage: device(), confirm, wait });

    expect(wait).toHaveBeenCalledWith(250);
    expect(confirm).toHaveBeenCalledOnce();
  });
});

describe('askToNotify — asking Android once, with our sentence first', () => {
  const asked = (bridge: { invoke: ReturnType<typeof vi.fn> }) =>
    bridge.invoke.mock.calls.filter(([command]) => command === 'plugin:erplora-android|request_permissions');

  it('on an Android that has not let the app notify: our sentence, then the system dialog for notices only', async () => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': () => ({ [ANDROID_NOTIFICATIONS]: false }) });
    const storage = memory([]);
    const confirm = vi.fn(async () => true);

    await askToNotify({ bridge, storage, confirm });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(asked(bridge).map(([, args]) => args)).toEqual([{ permissions: [ANDROID_NOTIFICATIONS] }]);
    expect(storage.getItem(PRIMER_ANSWERED_KEY)).toBe('1');
  });

  it('«Not now» asks Android nothing, and the sentence never comes back by itself', async () => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': () => ({ [ANDROID_NOTIFICATIONS]: false }) });
    const storage = memory([]);
    const confirm = vi.fn(async () => false);

    await askToNotify({ bridge, storage, confirm });
    await askToNotify({ bridge, storage, confirm });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(asked(bridge)).toEqual([]);
  });

  it.each([
    ['granted', () => ({ [ANDROID_NOTIFICATIONS]: true })],
    ['without such a permission (below Android 13)', () => ({})],
    [
      'on a computer',
      () => {
        throw new Error('plugin erplora-android not found');
      },
    ],
  ])('says nothing where the permission is %s', async (_case, answer) => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': answer });
    const confirm = vi.fn(async () => true);

    await askToNotify({ bridge, storage: memory([]), confirm, wait: async () => {} });

    expect(confirm).not.toHaveBeenCalled();
    expect(asked(bridge)).toEqual([]);
  });

  it('says nothing in a browser', async () => {
    const confirm = vi.fn(async () => true);

    await expect(askToNotify({ bridge: null, storage: memory([]), confirm })).resolves.toBeUndefined();

    expect(confirm).not.toHaveBeenCalled();
  });

  it('waits while the app says the hub is still landing, then asks', async () => {
    let landing = 2;
    const bridge = app({
      'plugin:erplora-android|check_permissions': () => {
        if (landing-- > 0) throw NOT_THE_LINKED_HUB;
        return { [ANDROID_NOTIFICATIONS]: false };
      },
    });
    const confirm = vi.fn(async () => true);

    await askToNotify({ bridge, storage: memory([]), confirm, wait: async () => {} });

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('a request Android answers with a failure breaks nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bridge = app({
      'plugin:erplora-android|check_permissions': () => ({ [ANDROID_NOTIFICATIONS]: false }),
      'plugin:erplora-android|request_permissions': () => {
        throw new Error('activity gone');
      },
    });

    await expect(askToNotify({ bridge, storage: memory([]), confirm: async () => true })).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
