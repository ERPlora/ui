import { afterEach, describe, expect, it, vi } from 'vitest';

import { type NativeBridge, NOT_THE_LINKED_HUB } from './native-bridge';
import { createNoticeListening, KEEP_LISTENING_COMMAND, NOTICE_LISTENING_COPY_KEYS } from './notice-listening';
import { ANDROID_NOTIFICATIONS } from './notice-permission';
import en from './locales/en.json';
import es from './locales/es.json';
import { ALLOWED, app, listened, NO_SUCH_COMMAND } from './__tests__/device-notices';

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

describe('createNoticeListening — the installed app stays listening with the screen off', () => {
  const words = (key: string) => `«${key}»`;
  const now = async () => {};

  /** An app that lets the notices go out and refuses `keep_listening` with `refusal`. */
  const refusing = (refusal: string) =>
    app({
      'plugin:erplora-android|check_permissions': () => ALLOWED,
      [KEEP_LISTENING_COMMAND]: () => {
        throw refusal;
      },
    });

  /**
   * `sync` asked with each of `wanted` in turn while Android has not answered yet, then Android allowing the notices:
   * what the page finally asked the app.
   */
  async function raced(wanted: boolean[]) {
    let answer: (status: unknown) => void = () => {};
    const bridge = app({
      'plugin:erplora-android|check_permissions': () => new Promise((resolve) => (answer = resolve)),
    });
    const listening = createNoticeListening({ bridge, t: words, wait: now });
    const asked = wanted.map((one) => listening.sync(one));
    answer(ALLOWED);
    await Promise.all(asked);
    return listened(bridge);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('with something to tell and the notices allowed it listens, in the words of the app', async () => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': () => ALLOWED });

    await createNoticeListening({ bridge, t: words, wait: now }).sync(true);

    expect(listened(bridge)).toEqual([
      {
        on: true,
        title: '«notices.listeningTitle»',
        body: '«notices.listeningBody»',
        channel: '«notices.listeningChannel»',
      },
    ]);
  });

  it('a device with no such permission to give (an Android below 13, a computer) listens too', async () => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': () => ({}) });

    await createNoticeListening({ bridge, t: words, wait: now }).sync(true);

    expect(listened(bridge)).toEqual([expect.objectContaining({ on: true })]);
  });

  it('with the notices refused there is nothing to listen for: it stops', async () => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': () => ({ [ANDROID_NOTIFICATIONS]: false }) });

    await createNoticeListening({ bridge, t: words, wait: now }).sync(true);

    expect(listened(bridge)).toEqual([{ on: false }]);
  });

  it('nothing to tell, or nobody signed in: it stops without asking Android anything', async () => {
    const bridge = app({ 'plugin:erplora-android|check_permissions': () => ALLOWED });

    await createNoticeListening({ bridge, t: words, wait: now }).sync(false);

    expect(bridge.invoke.mock.calls).toEqual([[KEEP_LISTENING_COMMAND, { on: false }]]);
  });

  it('not knowing whether the notices are allowed is no reason to keep the device awake', async () => {
    const unreadable = app({
      'plugin:erplora-android|check_permissions': () => {
        throw new Error('boom');
      },
    });
    const silent = app();

    await createNoticeListening({ bridge: unreadable, t: words, wait: now }).sync(true);
    await createNoticeListening({ bridge: silent, t: words, wait: now }).sync(true);

    expect(listened(unreadable)).toEqual([{ on: false }]);
    expect(listened(silent)).toEqual([{ on: false }]);
  });

  it('an app without the command (the 1.1.34) never breaks the page: it is noticed, written down once and not asked again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bridge = refusing(NO_SUCH_COMMAND);
    const listening = createNoticeListening({ bridge, t: words, wait: now });

    await expect(listening.sync(true)).resolves.toBeUndefined();
    await expect(listening.sync(false)).resolves.toBeUndefined();
    await expect(listening.sync(true)).resolves.toBeUndefined();

    expect(listened(bridge)).toHaveLength(1);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('a start Android refuses for any other reason is written down, and the next sign-in asks again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bridge = refusing('ForegroundServiceStartNotAllowedException');
    const listening = createNoticeListening({ bridge, t: words, wait: now });

    await expect(listening.sync(true)).resolves.toBeUndefined();
    await expect(listening.sync(true)).resolves.toBeUndefined();

    expect(listened(bridge)).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('asks again while the app says the hub is still landing, then it listens', async () => {
    let landing = true;
    const wait = vi.fn(async () => {
      landing = false;
    });
    const bridge = app({
      'plugin:erplora-android|check_permissions': () => ALLOWED,
      [KEEP_LISTENING_COMMAND]: () => {
        if (landing) throw NOT_THE_LINKED_HUB;
        return null;
      },
    });

    await createNoticeListening({ bridge, t: words, wait }).sync(true);

    expect(wait).toHaveBeenCalled();
    expect(listened(bridge).map((args) => args?.on)).toEqual([true, true]);
  });

  it('a session closed while the decision was on its way stays closed: nothing starts after it', async () => {
    expect(await raced([true, false])).toEqual([{ on: false }]);
  });

  it('and the other way round: the session that opened last is the one that listens', async () => {
    expect((await raced([false, true])).map((args) => args?.on)).toEqual([false, true]);
  });

  it('in a browser there is no app to keep listening', async () => {
    await expect(createNoticeListening({ bridge: null, t: words, wait: now }).sync(true)).resolves.toBeUndefined();
  });

  it('every word of the ongoing notification is in English and in Spanish', () => {
    const at = (catalogue: unknown, key: string) =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogue);
    for (const key of NOTICE_LISTENING_COPY_KEYS) {
      expect(typeof at(en, key), `${key} in en`).toBe('string');
      expect(typeof at(es, key), `${key} in es`).toBe('string');
      expect(at(es, key), key).not.toBe(at(en, key));
    }
  });
});
