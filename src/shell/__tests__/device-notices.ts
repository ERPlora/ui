import { vi } from 'vitest';

import { type DeviceNotice, TOLD_KEY } from '../device-notices';
import type { NativeBridge } from '../native-bridge';
import { KEEP_LISTENING_COMMAND } from '../notice-listening';
import { ANDROID_NOTIFICATIONS } from '../notice-permission';

export const BOOKED: DeviceNotice = {
  key: 'appointment.booked',
  id: '0192f0aa-0000-7000-8000-000000000001',
  at: '2026-10-23T09:40:00Z',
  title: 'New appointment · Ana Pérez',
  body: 'Haircut · Saturday 24 October at 10:00 · Marta',
  route: '/appointment/agenda?date=2026-10-24',
};
export const CANCELLED: DeviceNotice = {
  key: 'appointment.cancelled',
  id: '0192f0aa-0000-7000-8000-000000000002',
  at: '2026-10-23T09:45:00Z',
  title: 'Appointment cancelled · Luis Gil',
  body: 'Colour · Monday 26 October at 17:30 · Marta',
  route: '/appointment/agenda?date=2026-10-26',
};

/** A memory of the device, as `localStorage` keeps it. */
export function memory(initial?: string[]) {
  const items = new Map<string, string>();
  if (initial) items.set(TOLD_KEY, JSON.stringify(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

/** The installed app: every command it is asked, and what it answers. */
export function app(answers: Record<string, (args?: Record<string, unknown>) => unknown> = {}) {
  const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
    const answer = answers[command];
    return answer ? answer(args) : null;
  });
  return { invoke } satisfies NativeBridge;
}

export const notified = (bridge: { invoke: ReturnType<typeof vi.fn> }) =>
  bridge.invoke.mock.calls.filter(([command]) => command === 'erplora_notify').map(([, args]) => args);

/** What the page asked the app about listening, in order: `{ on, … }` each time. */
export const listened = (bridge: { invoke: ReturnType<typeof vi.fn> }) =>
  bridge.invoke.mock.calls.filter(([command]) => command === KEEP_LISTENING_COMMAND).map(([, args]) => args);

/** Android's answer of a device that lets the app notify. */
export const ALLOWED = { [ANDROID_NOTIFICATIONS]: true };
/** Tauri's answer to a command the installed app does not have (the 1.1.34 knows no `keep_listening`). */
export const NO_SUCH_COMMAND = 'erplora-android.keep_listening not allowed. Command not found';

export const screen = (path: string) => path.startsWith('/') && !path.startsWith('//');
