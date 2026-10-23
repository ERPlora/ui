// The device's notices (APPOINTMENT-F28; the old hub's HUB_SHELL-F66, HUB_APP-F24 and F25): a new row of what
// the modules tell goes out once as a system notice of the installed app (`erplora_notify`), never again on
// this device — not on the next live result, nor after a reload —; nothing without the app or with the
// Android permission refused; and a tap opens the screen it is about (hub#2305, hub#2360, hub#2658).
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const alerts = vi.hoisted(() => ({ role: 'confirm', created: [] as Array<Record<string, unknown>> }));
vi.mock('@ionic/vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ionic/vue')>()),
  alertController: {
    create: async (options: Record<string, unknown>) => {
      alerts.created.push(options);
      return { present: async () => {}, onDidDismiss: async () => ({ role: alerts.role }) };
    },
  },
}));

import {
  ANDROID_NOTIFICATIONS,
  askToNotify,
  bootNoticeTaps,
  createNoticeDoor,
  type DeviceNotice,
  NOT_THE_LINKED_HUB,
  type NativeBridge,
  nativeBridge,
  PRIMER_ANSWERED_KEY,
  TOLD_KEY,
  useDeviceNotices,
} from './device-notices';
import { createShellI18n } from './i18n';

const BOOKED: DeviceNotice = {
  key: 'appointment.booked',
  id: '0192f0aa-0000-7000-8000-000000000001',
  at: '2026-10-23T09:40:00Z',
  title: 'New appointment · Ana Pérez',
  body: 'Haircut · Saturday 24 October at 10:00 · Marta',
  route: '/appointment/agenda?date=2026-10-24',
};
const CANCELLED: DeviceNotice = {
  key: 'appointment.cancelled',
  id: '0192f0aa-0000-7000-8000-000000000002',
  at: '2026-10-23T09:45:00Z',
  title: 'Appointment cancelled · Luis Gil',
  body: 'Colour · Monday 26 October at 17:30 · Marta',
  route: '/appointment/agenda?date=2026-10-26',
};

/** A memory of the device, as `localStorage` keeps it. */
function memory(initial?: string[]) {
  const items = new Map<string, string>();
  if (initial) items.set(TOLD_KEY, JSON.stringify(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

/** The installed app: every command it is asked, and what it answers. */
function app(answers: Record<string, (args?: Record<string, unknown>) => unknown> = {}) {
  const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
    const answer = answers[command];
    return answer ? answer(args) : null;
  });
  return { invoke } satisfies NativeBridge;
}

const notified = (bridge: { invoke: ReturnType<typeof vi.fn> }) =>
  bridge.invoke.mock.calls.filter(([command]) => command === 'erplora_notify').map(([, args]) => args);

const screen = (path: string) => path.startsWith('/') && !path.startsWith('//');

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
        throw new Error(NOT_THE_LINKED_HUB);
      },
    });
    const door = createNoticeDoor({ bridge, storage: memory([]), navigate: vi.fn(), isScreen: screen });

    await expect(door.tell([BOOKED])).resolves.toBeUndefined();
    await door.tell([BOOKED]);

    expect(notified(bridge)).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
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

  it('asks again while the app says the hub is still landing (hub#2658), and gives up quietly elsewhere', async () => {
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

describe('askToNotify — asking Android once, with our sentence first (HUB_APP-F07, hub#1732, hub#2046)', () => {
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

  it('waits while the app says the hub is still landing (hub#2658), then asks', async () => {
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

describe('useDeviceNotices — the live rows of the page, told on the device', () => {
  const win = window as unknown as { __TAURI__?: unknown };

  // Node ≥ 25 defines its own `localStorage` (undefined without --localstorage-file): the device's, here.
  beforeEach(() => {
    vi.stubGlobal('localStorage', memory([]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete win.__TAURI__;
  });

  async function host(rows: ReturnType<typeof ref<DeviceNotice[] | undefined>>, ask = ref(false)) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => null } },
        { path: '/appointment/agenda', component: { render: () => null } },
        { path: '/:pathMatch(.*)*', name: 'not-found', component: { render: () => null } },
      ],
    });
    await router.push('/');
    const Host = defineComponent({
      setup() {
        useDeviceNotices(rows, { ask });
        return () => h('div');
      },
    });
    return { wrapper: mount(Host, { global: { plugins: [router, createShellI18n({ locale: 'es' })] } }), router };
  }

  it('tells each new row of the live result and opens its screen on a tap', async () => {
    const invoke = vi.fn(async () => null);
    let tapped: ((payload: unknown) => void) | undefined;
    win.__TAURI__ = {
      core: {
        invoke,
        addPluginListener: async (_plugin: string, _event: string, cb: (payload: unknown) => void) => {
          tapped = cb;
          return { unregister: async () => {} };
        },
      },
    };
    const rows = ref<DeviceNotice[] | undefined>(undefined);
    const { wrapper, router } = await host(rows);

    rows.value = [BOOKED];
    await vi.waitFor(() => expect(notified({ invoke })).toHaveLength(1));
    rows.value = [BOOKED];
    await nextTick();
    const [{ id }] = notified({ invoke }) as Array<{ id: number }>;
    await vi.waitFor(() => expect(tapped).toBeTypeOf('function'));
    tapped?.({ notification: { id } });
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/appointment/agenda?date=2026-10-24'));

    expect(notified({ invoke })).toHaveLength(1);
    wrapper.unmount();
  });

  it('a tap toward a screen this hub does not have goes nowhere', async () => {
    let tapped: ((payload: unknown) => void) | undefined;
    win.__TAURI__ = {
      core: {
        invoke: vi.fn(async () => null),
        addPluginListener: async (_plugin: string, _event: string, cb: (payload: unknown) => void) => {
          tapped = cb;
          return { unregister: async () => {} };
        },
      },
    };
    const { wrapper, router } = await host(ref<DeviceNotice[] | undefined>([]));
    await vi.waitFor(() => expect(tapped).toBeTypeOf('function'));

    tapped?.({ notification: { id: 1, extra: { path: '/kitchen' } } });
    await nextTick();

    expect(router.currentRoute.value.fullPath).toBe('/');
    wrapper.unmount();
  });

  it('asks Android once, with our sentence in the person\'s language, when there is something to tell them', async () => {
    alerts.created.length = 0;
    alerts.role = 'confirm';
    const invoke = vi.fn(async (command: string) =>
      command === 'plugin:erplora-android|check_permissions' ? { [ANDROID_NOTIFICATIONS]: false } : null,
    );
    win.__TAURI__ = { core: { invoke } };
    const ask = ref(false);
    const { wrapper } = await host(ref<DeviceNotice[] | undefined>([]), ask);
    await nextTick();
    expect(alerts.created).toEqual([]);

    ask.value = true;
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('plugin:erplora-android|request_permissions', {
        permissions: [ANDROID_NOTIFICATIONS],
      }),
    );

    expect(alerts.created).toEqual([
      {
        header: 'Deja que te avisemos',
        message:
          'Cuando algo necesite tu atención podemos avisarte, aunque nadie esté mirando esta pantalla. Tu dispositivo te lo preguntará a continuación.',
        buttons: [
          { text: 'Ahora no', role: 'cancel' },
          { text: 'Activar los avisos', role: 'confirm' },
        ],
      },
    ]);
    wrapper.unmount();
  });
});
