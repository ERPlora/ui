import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import { ConfirmDialog } from '../ConfirmDialog';
import { answer, assistant, panel, posted, script, setUpPanel, tearDownPanel } from './__tests__/assistant-panel';
import { flush } from './__tests__/mount-assistant';
import AssistantEmpty from './AssistantEmpty.vue';
import panelSource from './AssistantPanel.vue?raw';
import AssistantReport from './AssistantReport.vue';
import type { AssistantCard } from './card';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

beforeEach(setUpPanel);
afterEach(tearDownPanel);

const aside = (m: Awaited<ReturnType<typeof panel>>) => m.wrapper.get('[data-testid="assistant-panel"]');

describe('AssistantPanel', () => {
  it('closed, it paints nothing and reads nothing', async () => {
    const m = await panel({ open: false });
    expect(aside(m).attributes('data-open')).toBe('false');
    expect(aside(m).attributes('aria-hidden')).toBe('true');
    expect(m.wrapper.find('[data-testid="assistant-input"]').exists()).toBe(false);
    expect(m.usage).not.toHaveBeenCalled();
  });

  it("open: its title and the empty conversation, in the chat's own words when the host gives none", async () => {
    const m = await panel();
    expect(aside(m).attributes('data-open')).toBe('true');
    expect(aside(m).text()).toContain('Asistente');
    expect(aside(m).get('[data-testid="assistant-empty"]').text()).toContain('Pregúntame lo que quieras de tu negocio.');
    expect(m.wrapper.findAll('[data-testid="assistant-shortcut"]')).toHaveLength(0);
  });

  it("the host's empty conversation (its `empty` slot): it knows when the panel was opened for the setup, and its shortcuts ask", async () => {
    const empty = ({ setup, ask }: { setup: boolean; ask: (text: string, options?: { setup?: boolean }) => void }) =>
      h(AssistantEmpty, {
        text: setup ? 'Repasemos tu configuración.' : 'Pregúntame por tus ventas.',
        shortcuts: ['¿Qué falta por configurar?'],
        onAsk: (text: string) => ask(text, { setup: true }),
      });
    const m = await panel({ slots: { empty } });
    expect(aside(m).text()).toContain('Pregúntame por tus ventas.');
    await m.wrapper.get('[data-testid="assistant-shortcut"]').trigger('click');
    for (let i = 0; i < 3; i += 1) await flush();
    expect(posted[0].setup).toBe(true);
    expect(posted[0].messages).toEqual([{ role: 'user', content: '¿Qué falta por configurar?' }]);
    expect(m.wrapper.findAll('[data-testid="assistant-bubble-user"]')).toHaveLength(1);
    m.wrapper.unmount();
    assistant.newConversation();
    assistant.setOpen(false);
    const setup = await panel({ slots: { empty }, open: false });
    assistant.openForSetup();
    for (let i = 0; i < 3; i += 1) await flush();
    expect(aside(setup).text()).toContain('Repasemos tu configuración.');
  });

  it('× and Escape close it, wherever the focus is; an Escape inside a dialog over it is the dialog’s', async () => {
    const m = await panel();
    await m.wrapper.get('[data-testid="assistant-close"]').trigger('click');
    expect(assistant.state.open).toBe(false);
    assistant.setOpen(true);
    await flush();
    await aside(m).trigger('keydown', { key: 'Escape' });
    expect(assistant.state.open).toBe(false);
    assistant.setOpen(true);
    await flush();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(assistant.state.open).toBe(false);
    assistant.setOpen(true);
    await flush();
    const dialog = document.createElement('ion-modal');
    const field = document.createElement('input');
    dialog.append(field);
    document.body.append(dialog);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(assistant.state.open).toBe(true);
    m.wrapper.unmount();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(assistant.state.open).toBe(true);
  });

  it('docked beside the screen from 768 px, pushing it, without a veil', async () => {
    const m = await panel();
    expect(document.documentElement.classList.contains('assistant-docked')).toBe(true);
    expect(m.wrapper.find('[data-testid="assistant-veil"]').exists()).toBe(false);
    assistant.setOpen(false);
    await flush();
    expect(document.documentElement.classList.contains('assistant-docked')).toBe(false);
    assistant.setOpen(true);
    await flush();
    m.wrapper.unmount();
    expect(document.documentElement.classList.contains('assistant-docked')).toBe(false);
  });

  it('on a phone, over the screen with a veil that closes it', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const m = await panel();
    expect(document.documentElement.classList.contains('assistant-docked')).toBe(false);
    await m.wrapper.get('[data-testid="assistant-veil"]').trigger('click');
    expect(assistant.state.open).toBe(false);
  });

  describe('the cursor when it opens (ui#86)', () => {
    /** The button the person opened it with, holding the focus as the topbar's sparkles do. */
    function opener(): HTMLButtonElement {
      const button = document.createElement('button');
      document.body.append(button);
      button.focus();
      return button;
    }
    /** The composer's native field, the one the keyboard writes in. */
    const box = () => document.querySelector<HTMLTextAreaElement>('[data-testid="assistant-input"] textarea');

    it('with a keyboard and a mouse, the cursor waits in «Write a message…», so typing writes there', async () => {
      opener();
      await panel();
      expect(box()).not.toBeNull();
      expect(document.activeElement).toBe(box());
    });

    it('on a touch screen the focus stays where it was, so the keyboard does not jump up', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(min-width: 768px)' || query === '(pointer: coarse)',
        addEventListener() {},
        removeEventListener() {},
      }));
      const button = opener();
      await panel();
      expect(box()).not.toBeNull();
      expect(document.activeElement).toBe(button);
    });

    it('closed with Escape, the focus goes back to the button that opened it', async () => {
      const button = opener();
      await panel();
      box()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      expect(assistant.state.open).toBe(false);
      expect(document.activeElement).toBe(button);
    });

    it('an Ionic button that opened it gets the focus back on its native button, as the topbar\'s sparkles (ui#73)', async () => {
      const m = await panel({ open: false });
      const sparkles = document.createElement('ion-button');
      document.body.append(sparkles);
      await flush();
      const native = sparkles.shadowRoot?.querySelector<HTMLElement>('[part~="native"]');
      expect(native).toBeTruthy();
      native!.focus();
      assistant.setOpen(true);
      for (let i = 0; i < 3; i += 1) await flush();
      expect(document.activeElement).toBe(box());
      await m.wrapper.get('[data-testid="assistant-close"]').trigger('click');
      await flush();
      expect(document.activeElement).toBe(sparkles);
      expect(sparkles.shadowRoot?.activeElement).toBe(native);
    });

    it('closed while the person works beside it, the focus stays where they are', async () => {
      opener();
      await panel();
      const field = document.createElement('input');
      document.body.append(field);
      field.focus();
      assistant.setOpen(false);
      await flush();
      expect(document.activeElement).toBe(field);
    });

    describe('its own style, as the browser cascades it', () => {
      type Device = { settings: { device: { prefersReducedMotion: string } } };
      const device = () => (window as unknown as { happyDOM: Device }).happyDOM.settings.device;
      let style: HTMLStyleElement;

      beforeEach(() => {
        // The panel's rules, unscoped so they reach the painted panel without its scope attribute.
        style = document.createElement('style');
        style.textContent = /<style scoped>([\s\S]*?)<\/style>/.exec(panelSource)?.[1] ?? '';
        document.head.append(style);
      });

      afterEach(() => {
        style.remove();
        device().prefersReducedMotion = 'no-preference';
      });

      /** How a change of `property` is transitioned on the element, in seconds (zeros: it is not). */
      function transitionOf(element: Element, property: string): { duration: number; delay: number } {
        const seconds = (time: string) => Number.parseFloat(time) / (time.endsWith('ms') ? 1000 : 1);
        for (const item of getComputedStyle(element).transition.split(',')) {
          const [name, ...rest] = item.trim().split(/\s+/);
          if (name !== property && name !== 'all') continue;
          const [duration = 0, delay = 0] = rest.filter((token) => /^-?[\d.]+m?s$/.test(token)).map(seconds);
          return { duration, delay };
        }
        return { duration: 0, delay: 0 };
      }

      it('opening, it is visible from the first frame of its slide, so the box can take the cursor at once', async () => {
        const m = await panel();
        expect(getComputedStyle(aside(m).element).visibility).toBe('visible');
        expect(transitionOf(aside(m).element, 'transform').duration).toBeGreaterThan(0);
        expect(transitionOf(aside(m).element, 'visibility')).toEqual({ duration: 0, delay: 0 });
      });

      it('closing, it stays on screen while it slides out, and only then hides', async () => {
        const m = await panel();
        assistant.setOpen(false);
        await flush();
        const slide = transitionOf(aside(m).element, 'transform').duration;
        expect(getComputedStyle(aside(m).element).visibility).toBe('hidden');
        expect(slide).toBeGreaterThan(0);
        expect(transitionOf(aside(m).element, 'visibility')).toEqual({ duration: 0, delay: slide });
      });

      it('with reduced motion, it opens and closes without moving', async () => {
        device().prefersReducedMotion = 'reduce';
        const m = await panel();
        expect(transitionOf(aside(m).element, 'transform')).toEqual({ duration: 0, delay: 0 });
        expect(transitionOf(aside(m).element, 'visibility')).toEqual({ duration: 0, delay: 0 });
        assistant.setOpen(false);
        await flush();
        expect(transitionOf(aside(m).element, 'transform')).toEqual({ duration: 0, delay: 0 });
        expect(transitionOf(aside(m).element, 'visibility')).toEqual({ duration: 0, delay: 0 });
      });
    });
  });

  it('offline: a line says it, and it can still write', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const m = await panel();
    expect(m.wrapper.get('[data-testid="assistant-offline"]').text()).toBe('Sin conexión: puedes escribir y enviar cuando vuelva.');
    window.dispatchEvent(new Event('online'));
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(m.wrapper.find('[data-testid="assistant-offline"]').exists()).toBe(false);
  });

  it('«Go to …» opens the screen and closes the panel', async () => {
    script.push(answer('Lo tienes en /settings#business'));
    const m = await panel();
    await assistant.ask('¿Dónde cambio el nombre?');
    await flush();
    const go = m.wrapper.get('[data-testid="assistant-go"]');
    expect(go.text()).toBe('Ir a Ajustes');
    await go.trigger('click');
    await flush();
    expect(m.router.currentRoute.value.fullPath).toBe('/settings#business');
    expect(assistant.state.open).toBe(false);
  });

  it('a write waits on its card, over everything, and the answer goes to the turn', async () => {
    const card: AssistantCard = {
      operation: 'demo.item.create', app: 'demo', app_name: 'Demo', action: 'create', risk: 'normal',
      fields: [{ name: 'name', label: 'Name', kind: 'text', value: 'Mesa 4' }], count: null, confirm_word: '', blocked: false,
    };
    const call = { call_id: 'c1', name: 'demo__item__create', arguments: '{"name":"Mesa 4"}' };
    script.push([
      { type: 'confirm', card, call },
      { type: 'done', append: [], pending: [call], continuation: 'k1' },
    ]);
    script.push(answer('Hecho.'));
    const m = await panel();
    await assistant.ask('Crea la Mesa 4');
    for (let i = 0; i < 3; i += 1) await flush();
    const dialog = m.wrapper.findComponent(ConfirmDialog);
    expect(dialog.props('open')).toBe(true);
    dialog.vm.$emit('confirm');
    for (let i = 0; i < 3; i += 1) await flush();
    expect(posted[1].decision).toEqual({ call_id: 'c1', accepted: true, typed: '', stop: false });
    expect(dialog.props('open')).toBe(false);
  });

  it('«Report a problem» opens the report of that answer', async () => {
    script.push(answer('Hoy has vendido 120 €.'));
    const m = await panel();
    await assistant.ask('¿Cuánto he vendido?');
    await flush();
    await m.wrapper.get('[data-testid="assistant-report"]').trigger('click');
    await flush();
    expect(m.wrapper.findComponent(AssistantReport).props('bubble')).toMatchObject({ text: 'Hoy has vendido 120 €.', question: '¿Cuánto he vendido?' });
  });

  it('a host that takes no reports: no «Report a problem», and no dialog for it', async () => {
    script.push(answer('Hoy has vendido 120 €.'));
    const m = await panel({ config: { report: undefined } });
    await assistant.ask('¿Cuánto he vendido?');
    await flush();
    expect(m.wrapper.find('[data-testid="assistant-answer"]').text()).toContain('Hoy has vendido 120 €.');
    expect(m.wrapper.find('[data-testid="assistant-report"]').exists()).toBe(false);
    expect(m.wrapper.findComponent(AssistantReport).exists()).toBe(false);
  });

  it('«New conversation» empties it; the conversation is this person’s', async () => {
    const m = await panel();
    expect(m.wrapper.find('[data-testid="assistant-new"]').exists()).toBe(false);
    await assistant.ask('Hola');
    await flush();
    expect(assistant.state.thread.user).toBe('u1');
    await m.wrapper.get('[data-testid="assistant-new"]').trigger('click');
    expect(assistant.state.thread.bubbles).toEqual([]);
  });
});
