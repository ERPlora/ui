// The assistant's panel as its tests mount it. `setUpPanel` (a `beforeEach`) installs a fresh chat, on a screen 768 px
// wide, whose turns answer what the running test scripted (`script`) and keep what each one sent (`posted`);
// `tearDownPanel` (an `afterEach`) takes away what the test left. `assistant`, `posted` and `script` are the running
// test's.
import { vi } from 'vitest';

import type { LiveClient } from '../../../sdk/live-client';
import AssistantPanel from '../AssistantPanel.vue';
import { type AssistantConfig, type AssistantUsage, configureAssistant } from '../config';
import { type Assistant, createAssistant, installAssistant } from '../state';
import type { TurnBody, TurnFrame, TurnOptions } from '../stream';
import { configure, flush, memoryStorage, mountAssistant, OWNER } from './mount-assistant';

export let assistant: Assistant;
export let posted: TurnBody[];
export let script: TurnFrame[][];

export const answer = (text: string): TurnFrame[] => [
  { type: 'text', text },
  { type: 'done', append: [{ role: 'assistant', content: text }], pending: [], continuation: null },
];

export function setUpPanel(): void {
  posted = [];
  script = [];
  assistant = createAssistant({
    storage: memoryStorage(),
    openStorage: memoryStorage(),
    post: async (body: TurnBody, options: TurnOptions) => {
      posted.push(JSON.parse(JSON.stringify(body)) as TurnBody);
      for (const frame of script.shift() ?? answer('ok')) options.onFrame(frame);
    },
  });
  installAssistant(assistant);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 768px)', addEventListener() {}, removeEventListener() {} }));
}

export function tearDownPanel(): void {
  installAssistant(undefined);
  configureAssistant(undefined);
  document.body.innerHTML = '';
  document.documentElement.className = '';
  vi.unstubAllGlobals();
}

export const USAGE: AssistantUsage = { used: 3, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false };

interface PanelOptions {
  /** What the host's reading of the allowance gives; an `Error`, it cannot be read. */
  usage?: AssistantUsage | Error;
  session?: typeof OWNER;
  open?: boolean;
  config?: Partial<AssistantConfig>;
  slots?: Record<string, unknown>;
}

export async function panel(options: PanelOptions = {}) {
  const usage = vi.fn<(client: LiveClient) => Promise<AssistantUsage>>(async () => {
    const given = options.usage ?? USAGE;
    if (given instanceof Error) throw given;
    return given;
  });
  const report = vi.fn(async () => ({ sent: true }));
  configure({ usage, report, ...options.config });
  const m = await mountAssistant(AssistantPanel, {
    locale: 'es',
    session: options.session ?? OWNER,
    routes: ['/settings', '/customer/customers'],
    slots: options.slots,
  });
  if (options.open ?? true) {
    assistant.setOpen(true);
    for (let i = 0; i < 3; i += 1) await flush();
  }
  return { ...m, usage };
}
