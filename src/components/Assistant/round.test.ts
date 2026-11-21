import { describe, expect, it, vi } from 'vitest';

import { asked, CARD, CREATE, done, LIST } from './__tests__/assistant-state';
import { emptyThread } from './history';
import { bodyOf, cancelOf, frameReader, markWeb, newRound, settle, type Turn } from './round';

function aTurn(text = ''): Turn {
  const bubble = { id: 'b1', role: 'assistant' as const, text, files: [], notices: [], done: false };
  return { bubble, question: 'q', pending: [], continuation: null, executed: [], results: [], web: false };
}

describe('the frames of a round, written into its turn', () => {
  it('the first text of a round starts its own paragraph, and its pieces are joined as they come', () => {
    const turn = aTurn('Before.');
    const round = newRound();
    const read = frameReader(turn, round, vi.fn());
    read({ type: 'text', text: '' });
    expect(round.spoke).toBe(false);
    read({ type: 'text', text: 'Now ' });
    read({ type: 'text', text: 'this.' });
    expect(turn.bubble.text).toBe('Before.\n\nNow this.');
    expect(round.spoke).toBe(true);
  });

  it('keeps what ran, the card, the failure and the `done` of the round; the usage goes to its listener', () => {
    const turn = aTurn();
    const round = newRound();
    const onUsage = vi.fn();
    const read = frameReader(turn, round, onUsage);
    const closed = done({ pending: [LIST] });
    read({ type: 'executed', call_id: 'r1', name: 'demo__item__list', app: 'demo', app_name: 'Demo', screen: 'items', kind: 'query', outcome: 'ok', code: '' });
    read({ type: 'usage', used: 3, limit: 30, resets_at: null, demo: true });
    read({ type: 'confirm', card: CARD, call: CREATE });
    read({ type: 'error', code: 'assistant.unavailable', retriable: true });
    read(closed);
    expect(turn.executed).toEqual([{ name: 'demo__item__list', kind: 'query', outcome: 'ok', app: 'demo', app_name: 'Demo', screen: 'items' }]);
    expect(onUsage.mock.calls).toEqual([[{ used: 3, limit: 30, resets_at: null, demo: true }]]);
    expect(round.confirm).toEqual({ card: CARD, call: CREATE });
    expect(round.failure).toEqual({ code: 'assistant.unavailable', details: { retriable: true } });
    expect(round.done).toBe(closed);
  });

  it('a spent allowance hands its own numbers to the usage, so that the foot never contradicts the refusal', () => {
    const onUsage = vi.fn();
    const read = frameReader(aTurn(), newRound(), onUsage);
    read({ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: 30, resets_at: '2026-12-01', demo: true });
    read({ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: 30, resets_at: 1, demo: 'yes' });
    read({ type: 'error', code: 'assistant.quota_exceeded', used: '30', limit: 30 });
    read({ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: null });
    read({ type: 'error', code: 'assistant.unavailable', used: 30, limit: 30 });
    expect(onUsage.mock.calls).toEqual([
      [{ used: 30, limit: 30, resets_at: '2026-12-01', demo: true }],
      [{ used: 30, limit: 30, resets_at: null, demo: false }],
    ]);
  });
});

describe('where the answer came from, after a round', () => {
  it('the `done` says it; without one, a round that wrote leaves it unknown and a silent one changes nothing', () => {
    const cases: [boolean | undefined, Partial<ReturnType<typeof newRound>>, boolean | undefined][] = [
      [false, { done: done({ web: true }) as never }, true],
      [true, { done: done({ web: false }) as never }, true],
      [false, { done: done() as never }, undefined],
      [false, { spoke: true }, undefined],
      [false, {}, false],
      [undefined, {}, undefined],
    ];
    for (const [sofar, round, after] of cases) {
      const turn = { ...aTurn(), web: sofar };
      markWeb(turn, { ...newRound(), ...round });
      expect([turn.web, turn.bubble.web]).toEqual([after, after]);
    }
  });
});

describe('the request of a round', () => {
  it('carries the whole conversation and the setup, and only what the turn still owes', () => {
    const thread = { ...emptyThread('u1'), setup: true };
    thread.conversation.push({ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA' }, filename: 'a.png' }] });
    expect(bodyOf(aTurn(), thread, undefined)).toEqual({
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } }] }],
      setup: true,
    });
    const owing = { ...aTurn(), continuation: 'k1', pending: [CREATE] };
    const decision = { call_id: 'c1', accepted: true };
    expect(bodyOf(owing, thread, decision)).toMatchObject({ continuation: 'k1', pending: [CREATE], decision });
  });

  it('a call that is not done is heard by the model as a «Cancel»', () => {
    expect(cancelOf('c1')).toEqual({ call_id: 'c1', accepted: false, typed: '', stop: false });
  });
});

describe('what the `done` of a round leaves', () => {
  it('the messages it appended, the results of the tools, and what the next round owes', () => {
    const turn = aTurn();
    const conversation = emptyThread('u1').conversation;
    const append = [asked(LIST), { role: 'tool' as const, tool_call_id: 'r1', content: '[]' }, { role: 'assistant' as const, content: 'None.' }];
    settle(turn, conversation, done({ append, pending: [CREATE], continuation: 'k2' }) as Parameters<typeof settle>[2]);
    expect(conversation).toEqual(append);
    expect(turn.results).toEqual(['[]']);
    expect([turn.pending, turn.continuation]).toEqual([[CREATE], 'k2']);
  });
});
