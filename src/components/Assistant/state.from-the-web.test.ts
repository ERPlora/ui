import { describe, expect, it, vi } from 'vitest';

import { asked, assistantWith, done, hub, LIST } from './__tests__/assistant-state';
import { memoryStorage } from './__tests__/mount-assistant';
import type { TurnBody, TurnOptions } from './stream';

describe('where an answer came from, for its report (ui#103)', () => {
  const answer = (assistant: ReturnType<typeof assistantWith>) => assistant.state.thread.bubbles.at(-1)!;

  it('a round that brought pages marks the answer, and the continuation after its tools never unmarks it', async () => {
    const { post } = hub(
      [{ type: 'text', text: 'Lo busco.' }, done({ append: [asked(LIST)], pending: [LIST], continuation: 'tok', web: true })],
      [{ type: 'text', text: 'El IVA es del 10 %.' }, done({ web: false })],
    );
    const assistant = assistantWith(post);
    await assistant.ask('¿Qué IVA tienen las comidas?');
    expect(answer(assistant)).toMatchObject({ done: true, web: true });
  });

  it('an answer whose rounds all brought none says so', async () => {
    const { post } = hub(
      [done({ append: [asked(LIST)], pending: [LIST], continuation: 'tok', web: false })],
      [{ type: 'text', text: 'Tienes 3 mesas.' }, done({ web: false })],
    );
    const assistant = assistantWith(post);
    await assistant.ask('¿Cuántas mesas tengo?');
    expect(answer(assistant)).toMatchObject({ done: true, web: false });
  });

  it('a host that does not say where a round came from leaves the answer unknown', async () => {
    const { post } = hub(
      [done({ append: [asked(LIST)], pending: [LIST], continuation: 'tok', web: false })],
      [{ type: 'text', text: 'Tienes 3 mesas.' }, done()],
    );
    const assistant = assistantWith(post);
    await assistant.ask('¿Cuántas mesas tengo?');
    expect(answer(assistant).done).toBe(true);
    expect(answer(assistant).web).toBeUndefined();
  });

  it('«Stop» while a round writes leaves the answer unknown: that round never said where it came from', async () => {
    let calls = 0;
    const post = vi.fn((_body: TurnBody, options: TurnOptions) => {
      calls += 1;
      if (calls === 1) {
        options.onFrame(done({ append: [asked(LIST)], pending: [LIST], continuation: 'tok', web: false }));
        return Promise.resolve();
      }
      return new Promise<void>((_resolve, reject) => {
        options.onFrame({ type: 'text', text: 'Según la web' });
        options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const assistant = assistantWith(post);
    const running = assistant.ask('¿Qué IVA tienen las comidas?');
    await vi.waitFor(() => expect(calls).toBe(2));
    assistant.stop();
    await running;
    expect(answer(assistant)).toMatchObject({ text: 'Según la web', stopped: true, done: true });
    expect(answer(assistant).web).toBeUndefined();
  });

  it('«Stop» before a round wrote anything keeps what the rounds before it said', async () => {
    let calls = 0;
    const post = vi.fn((_body: TurnBody, options: TurnOptions) => {
      calls += 1;
      if (calls === 1) {
        options.onFrame({ type: 'text', text: 'Miro tus mesas.' });
        options.onFrame(done({ append: [asked(LIST)], pending: [LIST], continuation: 'tok', web: false }));
        return Promise.resolve();
      }
      return new Promise<void>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const assistant = assistantWith(post);
    const running = assistant.ask('¿Cuántas mesas tengo?');
    await vi.waitFor(() => expect(calls).toBe(2));
    assistant.stop();
    await running;
    expect(answer(assistant)).toMatchObject({ text: 'Miro tus mesas.', stopped: true, web: false });
  });

  it('the mark is kept in the tab: after a reload each answer still says it', async () => {
    const storage = memoryStorage();
    const { post } = hub(
      [{ type: 'text', text: 'El IVA es del 10 %.' }, done({ web: true })],
      [{ type: 'text', text: 'Tienes 3 mesas.' }, done({ web: false })],
    );
    const assistant = assistantWith(post, storage);
    await assistant.ask('¿Qué IVA tienen las comidas?');
    await assistant.ask('¿Cuántas mesas tengo?');
    const again = assistantWith(hub().post, storage);
    expect(again.state.thread.bubbles.filter((b) => b.role === 'assistant').map((b) => b.web)).toEqual([true, false]);
  });
});
