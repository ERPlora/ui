// The empty conversation (BASE-G111): the sparkles, a sentence and the shortcuts, each asked at once. The words are the
// host's (the Hub's: its setup's shortcuts, BASE-G121); without them, the chat's own sentence and no shortcut.
import { describe, expect, it } from 'vitest';

import { mountAssistant } from './__tests__/mount-assistant';
import AssistantEmpty from './AssistantEmpty.vue';

const shortcuts = (m: Awaited<ReturnType<typeof mountAssistant>>) =>
  m.wrapper.findAll('[data-testid="assistant-shortcut"]').map((button) => button.text());

describe('AssistantEmpty', () => {
  it("without the host's words, the chat's own sentence and no shortcut", async () => {
    const m = await mountAssistant(AssistantEmpty, { locale: 'es' });
    expect(m.wrapper.get('.assistant-empty-text').text()).toBe('Pregúntame lo que quieras de tu negocio.');
    expect(shortcuts(m)).toEqual([]);
  });

  it("the host's sentence and its shortcuts, each one asked at once", async () => {
    const m = await mountAssistant(AssistantEmpty, {
      locale: 'es',
      props: { text: 'Revisa tu cuenta.', shortcuts: ['¿Qué plan tengo?', '¿Cuándo se renueva?'] },
    });
    expect(m.wrapper.get('.assistant-empty-text').text()).toBe('Revisa tu cuenta.');
    expect(shortcuts(m)).toEqual(['¿Qué plan tengo?', '¿Cuándo se renueva?']);
    await m.wrapper.findAll('[data-testid="assistant-shortcut"]')[1].trigger('click');
    expect(m.wrapper.emitted('ask')).toEqual([['¿Cuándo se renueva?']]);
  });
});
