// BASE-G110: the sparkles «Assistant» in the topbar opens and closes the panel and says which; only to a person the
// host lets use it (`AssistantConfig.canUse`; the Hub's: whoever sees the Home, `base.view_home`).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { accessibleName, configure, flush, memoryStorage, mountAssistant, OWNER } from './__tests__/mount-assistant';
import AssistantButton from './AssistantButton.vue';
import { configureAssistant } from './config';
import { type Assistant, createAssistant, installAssistant } from './state';

let assistant: Assistant;

/** Attached, `ion-button` moves its `aria-*` to the native button of its shadow root, as in a browser, and follows
 *  only `aria-checked`, `aria-label` and `aria-pressed` afterwards: a toggle says its state with `aria-pressed`. */
const pressed = (element: Element) =>
  element.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed') ?? element.getAttribute('aria-pressed');

beforeEach(() => {
  assistant = createAssistant({ storage: memoryStorage(), openStorage: memoryStorage(), post: async () => undefined });
  installAssistant(assistant);
  configure();
});

afterEach(() => {
  installAssistant(undefined);
  configureAssistant(undefined);
  document.body.innerHTML = '';
});

describe('AssistantButton', () => {
  it('opens and closes the panel, named «Asistente», pressed while it is open', async () => {
    const { wrapper } = await mountAssistant(AssistantButton, { locale: 'es' });
    const button = wrapper.get('[data-testid="assistant-button"]');
    expect(accessibleName(button.element)).toBe('Asistente');
    expect(pressed(button.element)).toBe('false');
    await button.trigger('click');
    await flush();
    expect(assistant.state.open).toBe(true);
    expect(pressed(wrapper.get('[data-testid="assistant-button"]').element)).toBe('true');
    await wrapper.get('[data-testid="assistant-button"]').trigger('click');
    expect(assistant.state.open).toBe(false);
  });

  it('not there for a person the host does not let use the assistant', async () => {
    const { wrapper } = await mountAssistant(AssistantButton, { session: { ...OWNER, permissions: ['demo.view'] } });
    expect(wrapper.find('[data-testid="assistant-button"]').exists()).toBe(false);
  });

  it('a host that says nothing of who uses it: whoever is signed in', async () => {
    configure({ canUse: undefined });
    const { wrapper } = await mountAssistant(AssistantButton, { session: { ...OWNER, permissions: [] } });
    expect(wrapper.find('[data-testid="assistant-button"]').exists()).toBe(true);
  });
});
