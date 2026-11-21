import { vi } from 'vitest';

import type { AssistantCard } from '../card';
import { createAssistant } from '../state';
import type { PendingCall, TurnBody, TurnFrame, TurnOptions } from '../stream';
import { memoryStorage } from './mount-assistant';

export const CREATE: PendingCall = { call_id: 'c1', name: 'demo__item__create', arguments: '{"name":"Mesa 4"}' };
export const LIST: PendingCall = { call_id: 'r1', name: 'demo__item__list', arguments: '{}' };
export const CARD: AssistantCard = {
  operation: 'demo.item.create', app: 'demo', app_name: 'Demo', action: 'create', risk: 'normal',
  fields: [{ name: 'name', label: 'Name', kind: 'text', value: 'Mesa 4' }], count: null, confirm_word: '', blocked: false,
};

export function asked(...calls: PendingCall[]) {
  return {
    role: 'assistant' as const,
    content: '',
    tool_calls: calls.map((c) => ({ id: c.call_id, type: 'function' as const, function: { name: c.name, arguments: c.arguments } })),
  };
}
export const done = (fields: Partial<Extract<TurnFrame, { type: 'done' }>> = {}): TurnFrame => ({
  type: 'done', append: [], pending: [], continuation: null, ...fields,
});

/** The round that stops on the card of `CREATE`, the only write the model asked for. */
export const onCard = (): TurnFrame[] => [{ type: 'confirm', card: CARD, call: CREATE }, done({ append: [asked(CREATE)], pending: [CREATE] })];

/** A Hub that answers each POST with the frames of `script`, in order; it records each body. */
export function hub(...script: (TurnFrame[] | Error)[]) {
  const bodies: TurnBody[] = [];
  const post = vi.fn(async (body: TurnBody, options: TurnOptions) => {
    bodies.push(JSON.parse(JSON.stringify(body)) as TurnBody);
    const next = script.shift();
    if (!next) throw new Error('nothing scripted');
    if (next instanceof Error) throw next;
    for (const frame of next) options.onFrame(frame);
  });
  return { post, bodies };
}

export function assistantWith(post: ReturnType<typeof hub>['post'], storage = memoryStorage(), openStorage = memoryStorage()) {
  const assistant = createAssistant({ post, storage, openStorage, id: (() => { let n = 0; return () => `b${++n}`; })() });
  assistant.forUser('u1');
  assistant.setScreenCheck((path) => path === '/settings');
  return assistant;
}
