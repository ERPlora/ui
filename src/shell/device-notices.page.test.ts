import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type Ref, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const alerts = vi.hoisted(() => ({
  role: 'confirm',
  created: [] as Array<Record<string, unknown>>,
  /** When set, our sentence stays on screen until the test dismisses it. */
  dismiss: undefined as (() => void) | undefined,
  held: false,
}));
vi.mock('@ionic/vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ionic/vue')>()),
  alertController: {
    create: async (options: Record<string, unknown>) => {
      alerts.created.push(options);
      const dismissed = alerts.held
        ? new Promise<{ role: string }>((resolve) => (alerts.dismiss = () => resolve({ role: alerts.role })))
        : Promise.resolve({ role: alerts.role });
      return { present: async () => {}, onDidDismiss: () => dismissed };
    },
  },
}));

import { type DeviceNotice, stopNoticeListening, useDeviceNotices } from './device-notices';
import { KEEP_LISTENING_COMMAND } from './notice-listening';
import { ANDROID_NOTIFICATIONS } from './notice-permission';
import { createShellI18n } from './i18n';
import es from './locales/es.json';
import { ALLOWED, BOOKED, listened, memory, notified } from './__tests__/device-notices';

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

  /** The installed app on the page (`window.__TAURI__`), answering each command with `answer`. */
  function installApp(answer: (command: string, args?: Record<string, unknown>) => unknown) {
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => answer(command, args));
    win.__TAURI__ = { core: { invoke } };
    return invoke;
  }

  /** Android lets the app notify. */
  const allowing = (command: string) => (command === 'plugin:erplora-android|check_permissions' ? ALLOWED : null);

  /**
   * Android does not let the app notify until the page asks it to (`request_permissions`), then it does; `granted()`
   * says whether it was asked.
   */
  function grantingOnRequest() {
    let granted = false;
    const answer = (command: string) => {
      if (command === 'plugin:erplora-android|request_permissions') granted = true;
      return command === 'plugin:erplora-android|check_permissions' ? { [ANDROID_NOTIFICATIONS]: granted } : null;
    };
    return Object.assign(answer, { granted: () => granted });
  }

  async function host(rows: ReturnType<typeof ref<DeviceNotice[] | undefined>>, ask: Ref<boolean | undefined> = ref(false)) {
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

  it('while our sentence is on screen, the live results that keep coming never stack a second one', async () => {
    alerts.created.length = 0;
    alerts.role = 'cancel';
    alerts.held = true;
    const invoke = vi.fn(async (command: string) =>
      command === 'plugin:erplora-android|check_permissions' ? { [ANDROID_NOTIFICATIONS]: false } : null,
    );
    win.__TAURI__ = { core: { invoke } };
    const ask = ref(true);
    const { wrapper } = await host(ref<DeviceNotice[] | undefined>([]), ask);
    await vi.waitFor(() => expect(alerts.created).toHaveLength(1));

    ask.value = false;
    await nextTick();
    ask.value = true;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(alerts.created).toHaveLength(1);
    alerts.dismiss?.();
    alerts.held = false;
    wrapper.unmount();
  });

  /** The page in the installed app answering with `answer`, while the project says `ask`: what it asked about listening. */
  async function listeningPage(
    answer: Parameters<typeof installApp>[0] = allowing,
    ask: Ref<boolean | undefined> = ref(true),
  ) {
    const invoke = installApp(answer);
    const { wrapper } = await host(ref<DeviceNotice[] | undefined>([]), ask);
    return { wrapper, asked: () => listened({ invoke }) };
  }

  it('with something to tell and the notices allowed, the device keeps listening in the person\'s language until the page lets go', async () => {
    const page = await listeningPage();

    await vi.waitFor(() =>
      expect(page.asked()).toEqual([
        {
          on: true,
          title: es.notices.listeningTitle,
          body: es.notices.listeningBody,
          channel: es.notices.listeningChannel,
        },
      ]),
    );
    page.wrapper.unmount();

    await vi.waitFor(() => expect(page.asked().at(-1)).toEqual({ on: false }));
  });

  it.each([
    ['«Turn on notices», and Android lets it: it listens', 'confirm', true],
    ['«Not now»: the device stays asleep', 'cancel', false],
  ])('decides after our sentence, so its answer counts — %s', async (_, role, on) => {
    alerts.created.length = 0;
    alerts.role = role;
    const page = await listeningPage(grantingOnRequest());

    await vi.waitFor(() => expect(page.asked()).toHaveLength(1));

    expect(alerts.created).toHaveLength(1);
    expect(page.asked()).toEqual([expect.objectContaining({ on })]);
    page.wrapper.unmount();
  });

  it('once nothing is left to tell (the app that told turned off) the device stops listening', async () => {
    const ask = ref<boolean | undefined>(true);
    const page = await listeningPage(allowing, ask);
    await vi.waitFor(() => expect(page.asked()).toEqual([expect.objectContaining({ on: true })]));

    ask.value = false;

    await vi.waitFor(() => expect(page.asked().map((args) => args?.on)).toEqual([true, false]));
    page.wrapper.unmount();
  });

  it.each([true, false])(
    'until the hub knows whether there is something to tell the app is asked nothing (a reload never stops and restarts it); then it follows the answer — %s',
    async (something) => {
      const ask = ref<boolean | undefined>(undefined);
      const page = await listeningPage(allowing, ask);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(page.asked()).toEqual([]);

      ask.value = something;

      await vi.waitFor(() => expect(page.asked()).toEqual([expect.objectContaining({ on: something })]));
      page.wrapper.unmount();
    },
  );

  it('stopNoticeListening (the sign-out) stops the page\'s listening and waits for the app to say so', async () => {
    let stopped: (() => void) | undefined;
    const page = await listeningPage((command, args) =>
      command === KEEP_LISTENING_COMMAND && args?.on === false
        ? new Promise<null>((resolve) => (stopped = () => resolve(null)))
        : allowing(command),
    );
    await vi.waitFor(() => expect(page.asked()).toHaveLength(1));

    let left = false;
    const leaving = stopNoticeListening(60_000).then(() => (left = true));
    await vi.waitFor(() => expect(stopped).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The app has not said it yet: the sign-out is still here.
    expect(left).toBe(false);

    stopped?.();
    await leaving;

    expect(left).toBe(true);
    expect(page.asked().map((args) => args?.on)).toEqual([true, false]);
    page.wrapper.unmount();
  });

  it('once the page let go, the sign-out has no listening left to stop: the app is asked nothing more', async () => {
    const page = await listeningPage();
    await vi.waitFor(() => expect(page.asked()).toHaveLength(1));
    page.wrapper.unmount();
    await vi.waitFor(() => expect(page.asked()).toHaveLength(2));

    await stopNoticeListening();

    expect(page.asked().map((args) => args?.on)).toEqual([true, false]);
  });

  it('a page let go while our sentence waits for its answer stays asleep: nothing starts after it', async () => {
    alerts.created.length = 0;
    alerts.role = 'confirm';
    alerts.held = true;
    const android = grantingOnRequest();
    const page = await listeningPage(android);
    await vi.waitFor(() => expect(alerts.created).toHaveLength(1));

    page.wrapper.unmount();
    await vi.waitFor(() => expect(page.asked()).toEqual([{ on: false }]));
    alerts.dismiss?.();
    alerts.held = false;
    await vi.waitFor(() => expect(android.granted()).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(page.asked().map((args) => args?.on)).toEqual([false, false]);
  });

  it('stopNoticeListening never keeps the sign-out waiting: an app that does not answer is let go', async () => {
    const page = await listeningPage((command, args) =>
      command === KEEP_LISTENING_COMMAND && args?.on === false ? new Promise(() => {}) : allowing(command),
    );
    await vi.waitFor(() => expect(page.asked()).toHaveLength(1));

    await expect(stopNoticeListening(10)).resolves.toBeUndefined();

    expect(page.asked().map((args) => args?.on)).toEqual([true, false]);
    page.wrapper.unmount();
  });
});

describe('stopNoticeListening — the sign-out never waits for long', () => {
  it('is a no-op without a page listening (a browser, before the shell mounted)', async () => {
    await expect(stopNoticeListening()).resolves.toBeUndefined();
  });
});
