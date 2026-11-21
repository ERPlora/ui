import { afterEach, describe, expect, it, vi } from 'vitest';

import { assistantWith, done, hub } from './__tests__/assistant-state';
import { memoryStorage } from './__tests__/mount-assistant';
import { type AssistantApproval, configureAssistant } from './config';
import { HISTORY_KEY } from './history';
import { forgetAssistant, installAssistant, useAssistant } from './state';

describe("the tab's assistant (`useAssistant`), as the host configured it", () => {
  afterEach(() => {
    installAssistant(undefined);
    configureAssistant(undefined);
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('a host that never configured it is told at once', () => {
    expect(() => useAssistant()).toThrow(/configureAssistant/);
  });

  it("posts each turn to the host's route, through the host's approval, with the host's pass", async () => {
    const config = document.createElement('script');
    config.id = 'spa-config';
    config.type = 'application/json';
    config.textContent = JSON.stringify({ csrfCookieName: 'csrftoken', csrfHeader: 'X-CSRFToken', liveUrl: '/api/live', apiBase: '/api', lang: 'es', deviceIdStorageKey: 'erplora.device' });
    document.body.append(config);
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response('data: {"type":"text","text":"ok"}\n\ndata: {"type":"done","append":[],"pending":[],"continuation":null}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const run = vi.fn((request: () => Promise<unknown>) => request());
    configureAssistant({
      turnUrl: '/api/chat/turn',
      approval: { run: run as AssistantApproval['run'], declined: () => false },
      elevationToken: () => 'pass',
    });
    const assistant = useAssistant();
    expect(useAssistant()).toBe(assistant);
    assistant.forUser('u1');
    await assistant.ask('Hola');
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/chat/turn');
    expect(new Headers(init?.headers).get('X-Elevation-Token')).toBe('pass');
    expect(run).toHaveBeenCalledTimes(1);
    expect(assistant.state.thread.bubbles.at(-1)?.text).toBe('ok');
  });
});

describe('signing out (`forgetAssistant`)', () => {
  afterEach(() => {
    installAssistant(undefined);
    sessionStorage.clear();
  });

  it("forgets the tab's conversation, even when the panel was never opened", () => {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ user: 'u1', bubbles: [], conversation: [] }));
    forgetAssistant();
    expect(sessionStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it("empties the tab's assistant and its stored conversation", async () => {
    const storage = memoryStorage();
    const { post } = hub([{ type: 'text', text: 'Hola.' }, done({ append: [{ role: 'assistant', content: 'Hola.' }] })]);
    const assistant = assistantWith(post, storage);
    installAssistant(assistant);
    await assistant.ask('Hola');
    expect(storage.getItem(HISTORY_KEY)).not.toBeNull();
    forgetAssistant();
    expect(assistant.state.thread.bubbles).toEqual([]);
    expect(assistant.state.thread.user).toBe('');
    expect(storage.getItem(HISTORY_KEY)).toBeNull();
  });
});
