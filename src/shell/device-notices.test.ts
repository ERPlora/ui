import { describe, expect, it, vi } from 'vitest';

import { bootNoticeTaps, createNoticeDoor, TOLD_KEY } from './device-notices';
import { type NativeBridge, NOT_THE_LINKED_HUB } from './native-bridge';
import { ANDROID_NOTIFICATIONS } from './notice-permission';
import { app, BOOKED, CANCELLED, memory, notified, screen } from './__tests__/device-notices';

describe('createNoticeDoor — telling the device', () => {
  it('sends a new notice once, with its title, body, a number and the screen a tap opens', async () => {
    const bridge = app();
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen, firstId: 7000 });

    await door.tell([BOOKED]);

    expect(notified(bridge)).toEqual([
      {
        title: 'New appointment · Ana Pérez',
        body: 'Haircut · Saturday 24 October at 10:00 · Marta',
        id: 7000,
        path: '/appointment/agenda?date=2026-10-24',
      },
    ]);
  });

  it('never tells the same notice twice: not on the next live result, nor after a reload of the page', async () => {
    const bridge = app();
    const storage = memory([]);
    const door = createNoticeDoor({ bridge, storage, navigate: vi.fn(), isScreen: screen });

    await door.tell([BOOKED]);
    await door.tell([BOOKED]);
    // The reconnection (or a reload) brings the last 24 hours back: one new row, one already told.
    const reloaded = createNoticeDoor({ bridge, storage, navigate: vi.fn(), isScreen: screen });
    await reloaded.tell([CANCELLED, BOOKED]);

    expect(notified(bridge).map((args) => args?.title)).toEqual([BOOKED.title, CANCELLED.title]);
  });

  it('tells the same row again once it happened again (another instant): a booking cancelled twice', async () => {
    const bridge = app();
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await door.tell([CANCELLED]);
    await door.tell([{ ...CANCELLED, at: '2026-10-23T11:00:00Z' }, CANCELLED]);

    expect(notified(bridge)).toHaveLength(2);
  });

  it('two results arriving at once still tell a notice once', async () => {
    const bridge = app();
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await Promise.all([door.tell([BOOKED]), door.tell([BOOKED])]);

    expect(notified(bridge)).toHaveLength(1);
  });

  it('tells the oldest first, so the newest ends on top of the tray', async () => {
    const bridge = app();
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen, firstId: 1 });

    await door.tell([CANCELLED, BOOKED]);

    expect(notified(bridge).map((args) => [args?.id, args?.title])).toEqual([
      [1, BOOKED.title],
      [2, CANCELLED.title],
    ]);
  });

  it('on its first day the device only learns what is there: no burst of the last 24 hours', async () => {
    const bridge = app();
    const storage = memory();
    const door = createNoticeDoor({ bridge, storage, navigate: vi.fn(), isScreen: screen });

    await door.tell([BOOKED]);
    expect(notified(bridge)).toEqual([]);

    await door.tell([CANCELLED, BOOKED]);
    expect(notified(bridge).map((args) => args?.title)).toEqual([CANCELLED.title]);
  });

  it('a memory that does not read is a first day, never a burst', async () => {
    const bridge = app();
    const storage = memory();
    storage.setItem(TOLD_KEY, '{not json');
    const door = createNoticeDoor({ bridge, storage, navigate: vi.fn(), isScreen: screen });

    await door.tell([BOOKED]);

    expect(notified(bridge)).toEqual([]);
  });

  it('remembers a bounded number of notices', async () => {
    const storage = memory([]);
    const door = createNoticeDoor({ bridge: app(), storage, navigate: vi.fn(), isScreen: screen });

    await door.tell(Array.from({ length: 250 }, (_, n) => ({ ...BOOKED, id: `id-${n}` })));

    expect(JSON.parse(storage.getItem(TOLD_KEY) ?? '[]')).toHaveLength(200);
  });

  it('without the installed app (a browser) nothing is sent and nothing is remembered', async () => {
    const storage = memory([]);
    const door = createNoticeDoor({ bridge: null, storage, navigate: vi.fn(), isScreen: screen });

    await expect(door.tell([BOOKED])).resolves.toBeUndefined();

    expect(storage.getItem(TOLD_KEY)).toBe('[]');
  });

  it('with the Android permission refused nothing is sent (no bare dialog of Android in the middle of the day)', async () => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': () => ({ [ANDROID_NOTIFICATIONS]: false }) });
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await door.tell([BOOKED]);

    expect(notified(bridge)).toEqual([]);
  });

  it.each([
    ['granted', () => ({ [ANDROID_NOTIFICATIONS]: true })],
    ['not asked for on this Android (below 13)', () => ({ 'android.permission.BLUETOOTH_CONNECT': true })],
    [
      'a computer, which has no such plugin',
      () => {
        throw new Error('plugin erplora-android not found');
      },
    ],
  ])('sends with the permission %s', async (_case, answer) => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': answer });
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await door.tell([BOOKED]);

    expect(notified(bridge)).toHaveLength(1);
  });

  it('a notice the app cannot show is lost without breaking anything, and is not sent again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bridge = app({
      erplora_notify: () => {
        throw new Error('the platform could not show it');
      },
    });
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await expect(door.tell([BOOKED])).resolves.toBeUndefined();
    await door.tell([BOOKED]);

    expect(notified(bridge)).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // The first live result of a reopened page often lands before the app has let it drive (page `load` and some
  // seconds after): the bookings of the night must still ring, not be marked told and lost.
  it('a notice that arrives while the hub is still landing waits for it, then goes out once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const landing = { check: 2, notify: 2 };
    const shown: unknown[] = [];
    const stillLanding = (step: keyof typeof landing) => (args?: Record<string, unknown>) => {
      if (landing[step] > 0) {
        landing[step] -= 1;
        throw NOT_THE_LINKED_HUB;
      }
      if (step === 'notify') shown.push(args);
      return null;
    };
    const bridge = app({
      'plugin:erplora-android|check_permissions': stillLanding('check'),
      erplora_notify: stillLanding('notify'),
    });
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen, wait: async () => {} });

    await door.tell([BOOKED]);
    await door.tell([BOOKED]);

    expect(shown.map((args) => (args as { title: string }).title)).toEqual([BOOKED.title]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a route that is not a screen of the hub goes out without a destination', async () => {
    const bridge = app();
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await door.tell([{ ...BOOKED, route: '//evil.example/agenda' }]);

    expect(notified(bridge)[0]?.path).toBeNull();
  });
});

describe('createNoticeDoor — a tap opens the screen it is about', () => {
  it('opens the screen of the notice it remembers by its number', async () => {
    const navigate = vi.fn();
    const door = createNoticeDoor({ bridge: app(), storage: memory([]), navigate, isScreen: screen, firstId: 41 });
    await door.tell([BOOKED]);

    door.tapped({ notification: { id: 41 } });

    expect(navigate).toHaveBeenCalledWith('/appointment/agenda?date=2026-10-24');
  });

  it('a tap this page did not see go out opens the screen it brings back, once it is a screen of the hub', () => {
    const navigate = vi.fn();
    const door = createNoticeDoor({ bridge: app(), storage: memory([]), navigate, isScreen: screen });

    door.tapped({ notification: { id: 9, extra: { path: '/appointment/agenda?date=2026-10-26' } } });
    door.tapped({ notification: { id: 10, extra: { path: '//evil.example/x' } } });
    door.tapped({ notification: { id: 11, extra: { path: 'https://evil.example/x' } } });
    door.tapped({ notification: { id: 'x' } });
    door.tapped(null);

    expect(navigate.mock.calls).toEqual([['/appointment/agenda?date=2026-10-26']]);
  });
});

describe('bootNoticeTaps — hearing the taps', () => {
  function tauri() {
    const listeners: Record<string, (payload: unknown) => void> = {};
    let poke: (() => void) | undefined;
    let kept: unknown = null;
    const bridge: NativeBridge & { keep: (tap: unknown) => void; fire: (payload: unknown) => void; poke: () => void } = {
      invoke: vi.fn(async (command: string) => {
        if (command !== 'erplora_take_notice_tap') return null;
        const tap = kept;
        kept = null;
        return tap;
      }),
      addPluginListener: vi.fn(async (plugin: string, event: string, cb: (payload: unknown) => void) => {
        listeners[`${plugin}|${event}`] = cb;
        return { unregister: async () => {} };
      }),
      listen: vi.fn(async (_event: string, cb: () => void) => {
        poke = cb;
        return () => {};
      }),
      keep: (tap) => (kept = tap),
      fire: (payload) => listeners['notification|actionPerformed']?.(payload),
      poke: () => poke?.(),
    };
    return bridge;
  }

  it('claims at boot the tap that started the app, hears the plugin, and claims again when the app says one waits', async () => {
    const navigate = vi.fn();
    const bridge = tauri();
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate, isScreen: screen });
    bridge.keep({ notification: { id: 3, extra: { path: '/appointment/agenda?date=2026-10-24' } } });

    await bootNoticeTaps(door, bridge);
    bridge.fire({ notification: { id: 4, extra: { path: '/appointment/agenda?date=2026-10-25' } } });
    bridge.keep({ notification: { id: 5, extra: { path: '/appointment/agenda?date=2026-10-26' } } });
    bridge.poke();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(3));

    expect(bridge.addPluginListener).toHaveBeenCalledWith('notification', 'actionPerformed', expect.any(Function));
    expect(bridge.listen).toHaveBeenCalledWith('erplora://notice-tapped', expect.any(Function));
    expect(navigate.mock.calls.map(([path]) => path)).toEqual([
      '/appointment/agenda?date=2026-10-24',
      '/appointment/agenda?date=2026-10-25',
      '/appointment/agenda?date=2026-10-26',
    ]);
  });

  it('asks again while the app says the hub is still landing, and gives up quietly elsewhere', async () => {
    const bridge = tauri();
    let refusals = 2;
    bridge.addPluginListener = vi.fn(async () => {
      if (refusals-- > 0) throw NOT_THE_LINKED_HUB;
      return { unregister: async () => {} };
    });
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await bootNoticeTaps(door, bridge, async () => {});

    expect(bridge.addPluginListener).toHaveBeenCalledTimes(3);
  });

  it('never rejects: a browser has no app, an older app no such command', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const door = createNoticeDoor({ bridge: null, storage: memory([]), navigate: vi.fn(), isScreen: screen });
    const broken: NativeBridge = {
      invoke: async () => {
        throw new Error('unknown command');
      },
      addPluginListener: async () => {
        throw new Error('not allowed');
      },
    };

    await expect(bootNoticeTaps(door, null)).resolves.toBeTypeOf('function');
    await expect(bootNoticeTaps(door, broken, async () => {})).resolves.toBeTypeOf('function');
    warn.mockRestore();
  });
});
