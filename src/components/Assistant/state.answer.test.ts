import { describe, expect, it, vi } from 'vitest';

import { assistantWith, done, hub, onCard } from './__tests__/assistant-state';
import { memoryStorage } from './__tests__/mount-assistant';
import { loadThread } from './history';

describe('the answer to a card', () => {
  it('a yes goes out with what the person typed', async () => {
    const { post, bodies } = hub(onCard(), [done()]);
    const assistant = assistantWith(post);
    await assistant.ask('crea Mesa 4');
    await assistant.decide(true, 'Mesa 4');
    expect(bodies[1].decision).toEqual({ call_id: 'c1', accepted: true, typed: 'Mesa 4', stop: false });
  });

  it('«Stop» while a card waits cancels it with the rest of the turn', async () => {
    const { post, bodies } = hub(onCard(), [done()]);
    const assistant = assistantWith(post);
    await assistant.ask('crea Mesa 4');
    assistant.stop();
    await vi.waitFor(() => expect(assistant.state.busy).toBe(false));
    expect(bodies[1].decision).toEqual({ call_id: 'c1', accepted: false, typed: '', stop: true });
  });

  it('a new conversation while a card waits takes the card with its turn, and nothing is left to answer', async () => {
    const { post } = hub(onCard());
    const assistant = assistantWith(post);
    await assistant.ask('crea Mesa 4');
    assistant.newConversation();
    expect([assistant.state.confirm, assistant.state.busy]).toEqual([null, false]);
    await assistant.decide(true);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('a question', () => {
  it('is kept in the tab before its request goes out', async () => {
    const storage = memoryStorage();
    const { post } = hub();
    let kept: string[] = [];
    post.mockImplementationOnce(async (_body, options) => {
      kept = loadThread(storage, 'u1').bubbles.map((bubble) => bubble.text);
      options.onFrame(done());
    });
    await assistantWith(post, storage).ask('¿Cuántos tengo?');
    expect(kept).toEqual(['¿Cuántos tengo?', '']);
  });
});
