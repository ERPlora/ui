import { defineComponent, h, provide } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import HubIcon from '../../shell/HubIcon.vue';
import { TOPBAR_MENU_KEY } from '../../shell/topbar-menu';
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

  // In the menu the panel waits for the menu to go: opened at once, it lost the keyboard to the menu's focus trap.
  it('listed in the bar «⋮» of a phone: a row with its label, that opens the panel once the menu has gone', async () => {
    let afterClose: (() => void) | undefined;
    const InMenu = defineComponent({
      setup() {
        provide(TOPBAR_MENU_KEY, { closeThen: (action: () => void) => (afterClose = action) });
        return () => h(AssistantButton);
      },
    });
    const { wrapper } = await mountAssistant(InMenu, { locale: 'es' });
    const row = wrapper.get('[data-testid="assistant-button"]');
    expect(row.text()).toBe('Asistente');
    expect(row.getComponent(HubIcon).attributes('slot')).toBe('start');
    await row.trigger('click');
    expect(assistant.state.open).toBe(false);
    afterClose?.();
    expect(assistant.state.open).toBe(true);
  });

  it('in the bar itself, the sparkles alone', async () => {
    const { wrapper } = await mountAssistant(AssistantButton);
    const button = wrapper.get('[data-testid="assistant-button"]');
    expect(button.text()).toBe('');
    expect(button.getComponent(HubIcon).attributes('slot')).toBe('icon-only');
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
