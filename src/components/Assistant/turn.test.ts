import { describe, expect, it } from 'vitest';

import { ApiError } from '../../sdk/errors';
import { asked, CARD, CREATE, done, hub, onCard } from './__tests__/assistant-state';
import { memoryStorage } from './__tests__/mount-assistant';
import { type Bubble, emptyThread, loadThread } from './history';
import type { Turn } from './round';
import type { TurnFrame } from './stream';
import { run, type TurnContext } from './turn';

const ID = '0195f2a4-7c1e-7d3a-9b2f-4e5d6c7b8a90';

function turnOf(question: string): Turn {
  const bubble: Bubble = { id: question, role: 'assistant', text: '', files: [], notices: [], done: false, question };
  return { bubble, question, pending: [], continuation: null, executed: [], results: [], web: false };
}

/** An assistant with a turn in flight for `question`: the person's message and the empty bubble are in the thread. */
function contextWith(post: TurnContext['post'], question = '¿Cuántos tengo?'): TurnContext {
  const turn = turnOf(question);
  const thread = emptyThread('u1');
  thread.conversation.push({ role: 'user', content: question });
  thread.bubbles.push(turn.bubble);
  return {
    state: { thread, busy: false, confirm: null, usage: null },
    post,
    storage: memoryStorage(),
    screenExists: () => true,
    turn,
    controller: null,
  };
}

describe('the end of a turn', () => {
  it('leaves the assistant idle: no turn, no request in flight and no card', async () => {
    const s = contextWith(hub([done()]).post);
    s.state.confirm = { card: CARD, call: CREATE, more: false };
    await run(s);
    expect([s.turn, s.controller, s.state.confirm, s.state.busy]).toEqual([null, null, null, false]);
  });

  it('keeps a write the frames tell without its app, with an empty app', async () => {
    const untold = { type: 'executed', call_id: 'c1', name: 'demo.item.create', kind: 'command', outcome: 'ok', code: '' };
    const s = contextWith(hub([untold as TurnFrame, { type: 'text', text: 'Creada.' }, done()]).post);
    const { bubble } = s.turn!;
    await run(s);
    expect(bubble.executed).toEqual([{ name: 'demo.item.create', app: '', outcome: 'ok' }]);
  });

  it('keeps why a write failed with its receipt, kept with the conversation', async () => {
    const reason = { es: 'Este elemento está cerrado: ábrelo para añadir líneas.' };
    const failed = { type: 'executed', call_id: 'c1', name: 'demo.item.add_line', app: 'demo', kind: 'command', outcome: 'error', code: 'demo.item_done', reason };
    const s = contextWith(hub([failed as TurnFrame, { type: 'text', text: 'No se pudo.' }, done()]).post);
    const { bubble } = s.turn!;
    await run(s);
    expect(bubble.executed).toEqual([{ name: 'demo.item.add_line', app: 'demo', outcome: 'error', reason }]);
  });

  it('an identifier the answer quotes from what a tool returned is no unread identifier', async () => {
    const read = { role: 'tool' as const, tool_call_id: 'r1', content: `{"id":"${ID}"}` };
    const s = contextWith(hub([{ type: 'text', text: `Es ${ID}.` }, done({ append: [read] })]).post);
    const { bubble } = s.turn!;
    await run(s);
    expect(bubble.notices).toEqual([]);
  });

  it('an identifier the answer quotes from the question is no unread identifier', async () => {
    const s = contextWith(hub([{ type: 'text', text: `Es ${ID}.` }, done()]).post, `¿Qué es ${ID}?`);
    const { bubble } = s.turn!;
    await run(s);
    expect(bubble.notices).toEqual([]);
  });

  it("checks a web address against what the host's own tools consulted in any round", async () => {
    const said = (sources: string[][]) => {
      const rounds = sources.map((names, at) =>
        at < sources.length - 1
          ? [done({ append: [asked(CREATE)], pending: [CREATE], sources: names })]
          : [{ type: 'text', text: 'Lo dice https://boe.es/doc.' } as TurnFrame, done({ sources: names })],
      );
      return contextWith(hub(...rounds).post);
    };
    const consulted = said([['https://boe.es/doc'], []]);
    await run(consulted);
    const invented = said([[], []]);
    await run(invented);
    expect([consulted.state.thread.bubbles.at(-1)!.notices, invented.state.thread.bubbles.at(-1)!.notices]).toEqual([[], ['unread_link']]);
  });
});

describe('a request that fails', () => {
  it("keeps the code and the details of the host's error", async () => {
    const s = contextWith(hub(new ApiError(429, 'assistant.busy', 'Busy', undefined, { retry_after: 5 })).post);
    const { bubble } = s.turn!;
    await run(s);
    expect([bubble.error, bubble.details]).toEqual(['assistant.busy', { retry_after: 5 }]);
  });

  it('is a «Stop» only when it was aborted: another failure of the browser leaves the host unreachable', async () => {
    const s = contextWith(hub(new DOMException('Offline', 'NetworkError')).post);
    const { bubble } = s.turn!;
    await run(s);
    expect([bubble.error, bubble.stopped]).toEqual(['assistant.unreachable', undefined]);
  });
});

describe('a round', () => {
  it('that stops on a card saves the thread with what the round brought', async () => {
    const s = contextWith(hub(onCard()).post);
    await run(s);
    expect(s.state.confirm?.call).toEqual(CREATE);
    expect(loadThread(s.storage, 'u1').conversation.at(-1)).toEqual(asked(CREATE));
  });

  it('whose answer ends without its done leaves the answer cut', async () => {
    const s = contextWith(hub([{ type: 'text', text: 'Tienes' }]).post);
    const { bubble } = s.turn!;
    await run(s);
    expect([bubble.text, bubble.error]).toEqual(['Tienes', 'assistant.cut']);
  });
});

describe('a turn that another one replaced while its request was out', () => {
  it('leaves the new turn as it is when the request fails', async () => {
    const next = turnOf('¿Y mañana?');
    const s: TurnContext = contextWith(async () => {
      s.turn = next;
      throw new Error('offline');
    });
    await run(s);
    expect(s.turn).toBe(next);
    expect([next.bubble.done, next.bubble.error]).toEqual([false, undefined]);
  });

  it('writes nothing of the answer into the conversation, and the new turn goes on', async () => {
    const next = turnOf('¿Y mañana?');
    const s: TurnContext = contextWith(async (_body, options) => {
      s.turn = next;
      options.onFrame(done({ append: [{ role: 'assistant', content: 'Tarde.' }] }));
    });
    const before = [...s.state.thread.conversation];
    await run(s);
    expect(s.state.thread.conversation).toEqual(before);
    expect([s.turn, next.bubble.done]).toEqual([next, false]);
  });

  it('shows no card of the old turn: a card waits only with its turn in flight', async () => {
    const s: TurnContext = contextWith(async (_body, options) => {
      s.turn = turnOf('¿Y mañana?');
      for (const frame of onCard()) options.onFrame(frame);
    });
    await run(s);
    expect(s.state.confirm).toBeNull();
  });
});
