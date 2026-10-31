// The assistant's panel (BASE-G110 open and close, G111 the conversation, G114 go to a screen, G115 the card, G120 the
// person's conversation, the host's empty conversation, G122 the allowance, G123 report, G124 offline and without a
// plan): on the right, docked beside the screen from 768 px and over it on a phone; closed with ×, Escape, the veil or
// «Go to …»; the allowance read once per opening, as the host reads it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import type { LiveClient } from '../../sdk/live-client';
import { ConfirmDialog } from '../ConfirmDialog';
import { configure, EMPLOYEE, flush, memoryStorage, mountAssistant, OWNER, PLAN_URL } from './__tests__/mount-assistant';
import AssistantEmpty from './AssistantEmpty.vue';
import AssistantPanel from './AssistantPanel.vue';
import AssistantReport from './AssistantReport.vue';
import type { AssistantCard } from './card';
import { type AssistantConfig, type AssistantUsage, configureAssistant } from './config';
import { type Assistant, createAssistant, installAssistant } from './state';
import type { TurnBody, TurnFrame, TurnOptions } from './stream';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

let assistant: Assistant;
let posted: TurnBody[];
let script: TurnFrame[][];

const answer = (text: string): TurnFrame[] => [
  { type: 'text', text },
  { type: 'done', append: [{ role: 'assistant', content: text }], pending: [], continuation: null },
];

beforeEach(() => {
  posted = [];
  script = [];
  assistant = createAssistant({
    storage: memoryStorage(),
    openStorage: memoryStorage(),
    post: async (body: TurnBody, options: TurnOptions) => {
      posted.push(JSON.parse(JSON.stringify(body)) as TurnBody);
      for (const frame of script.shift() ?? answer('ok')) options.onFrame(frame);
    },
  });
  installAssistant(assistant);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 768px)', addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => {
  installAssistant(undefined);
  configureAssistant(undefined);
  document.body.innerHTML = '';
  document.documentElement.className = '';
  vi.unstubAllGlobals();
});

const USAGE: AssistantUsage = { used: 3, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false };

interface PanelOptions {
  /** What the host's reading of the allowance gives; an `Error`, it cannot be read. */
  usage?: AssistantUsage | Error;
  session?: typeof OWNER;
  open?: boolean;
  /** The pieces of the host's configuration a test changes. */
  config?: Partial<AssistantConfig>;
  slots?: Record<string, unknown>;
}

async function panel(options: PanelOptions = {}) {
  const usage = vi.fn<(client: LiveClient) => Promise<AssistantUsage>>(async () => {
    const given = options.usage ?? USAGE;
    if (given instanceof Error) throw given;
    return given;
  });
  const report = vi.fn(async () => ({ sent: true }));
  configure({ usage, report, ...options.config });
  const m = await mountAssistant(AssistantPanel, {
    locale: 'es',
    session: options.session ?? OWNER,
    routes: ['/settings', '/customer/customers'],
    slots: options.slots,
  });
  if (options.open ?? true) {
    assistant.setOpen(true);
    for (let i = 0; i < 3; i += 1) await flush();
  }
  return { ...m, usage };
}

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

  it('reads the allowance once per opening, through the page\'s client, and from 80 % says what is left', async () => {
    const m = await panel({ usage: { ...USAGE, used: 25 } });
    expect(m.usage).toHaveBeenCalledWith(m.client);
    expect(m.usage).toHaveBeenCalledTimes(1);
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('Te quedan 5 de 30 mensajes este mes. Se renuevan el 1 de noviembre.');
    assistant.setOpen(false);
    await flush();
    assistant.setOpen(true);
    for (let i = 0; i < 3; i += 1) await flush();
    expect(m.usage).toHaveBeenCalledTimes(2);
  });

  it('after each turn the foot counts what is left now, with no other reading', async () => {
    script.push([
      { type: 'text', text: 'Hola.' },
      { type: 'usage', used: 26, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false },
      { type: 'done', append: [{ role: 'assistant', content: 'Hola.' }], pending: [], continuation: null },
    ]);
    const m = await panel({ usage: { ...USAGE, used: 25 } });
    await assistant.ask('Hola');
    await flush();
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('Te quedan 4 de 30 mensajes este mes. Se renuevan el 1 de noviembre.');
    expect(m.usage).toHaveBeenCalledTimes(1);
  });

  it('a turn refused for a spent month: the foot says the same as the answer, without a second «Upgrade plan» (gh:hub#1183)', async () => {
    script.push([{ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false }]);
    // The host's plan page: the answer's «Upgrade plan» goes there.
    const m = await panel({ usage: { ...USAGE, used: 25 } });
    await assistant.ask('Hola');
    await flush();
    const foot = m.wrapper.get('[data-testid="assistant-usage"]');
    expect(foot.text()).toBe('Has usado los 30 mensajes de este mes. Se renuevan el 1 de noviembre.');
    expect(foot.find('a').exists()).toBe(false);
    expect(m.wrapper.findAll('[data-testid="assistant-upgrade"]')).toHaveLength(1);
    expect(m.wrapper.get('[data-testid="assistant-upgrade"]').attributes('href')).toBe(PLAN_URL);
  });

  it('opened with the month already spent, the foot says so', async () => {
    const m = await panel({ usage: { ...USAGE, used: 30 } });
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('Has usado los 30 mensajes de este mes. Se renuevan el 1 de noviembre.');
  });

  it('under 80 %, or when the allowance cannot be read, it says nothing of it', async () => {
    const low = await panel();
    expect(low.wrapper.find('[data-testid="assistant-usage"]').exists()).toBe(false);
    low.wrapper.unmount();
    const failed = await panel({ usage: new Error('unavailable') });
    expect(failed.wrapper.find('[data-testid="assistant-usage"]').exists()).toBe(false);
  });

  it('a host that does not count messages: nothing is read and nothing said of them', async () => {
    const m = await panel({ usage: { ...USAGE, used: 30 }, config: { usage: undefined } });
    expect(m.usage).not.toHaveBeenCalled();
    expect(m.wrapper.find('[data-testid="assistant-usage"]').exists()).toBe(false);
    expect(m.wrapper.find('[data-testid="assistant-no-plan"]').exists()).toBe(false);
  });

  it('a plan without the assistant: says so, the owner gets «Upgrade plan», and nothing can be sent', async () => {
    const m = await panel({ usage: { ...USAGE, used: 0, limit: 0 } });
    expect(m.wrapper.get('[data-testid="assistant-no-plan"]').text()).toContain('Tu plan no incluye el asistente.');
    expect(m.wrapper.get('[data-testid="assistant-no-plan-upgrade"]').attributes('href')).toBe(PLAN_URL);
    expect(m.wrapper.get('[data-testid="assistant-send"]').attributes('disabled')).toBeDefined();
    m.wrapper.unmount();
    const employee = await panel({ usage: { ...USAGE, used: 0, limit: 0 }, session: EMPLOYEE });
    expect(employee.wrapper.get('[data-testid="assistant-no-plan"]').text()).toContain('Pídele a quien administra el negocio que mejore el plan.');
    expect(employee.wrapper.find('[data-testid="assistant-no-plan-upgrade"]').exists()).toBe(false);
  });

  it("without the assistant and nobody who may upgrade: the host's own line under it, when it gives one (ui#49)", async () => {
    const m = await panel({ usage: { ...USAGE, used: 0, limit: 0 }, session: EMPLOYEE, config: { spentNoteKey: 'host.spentNote' } });
    const foot = m.wrapper.get('[data-testid="assistant-no-plan"]');
    expect(foot.get('[data-testid="assistant-spent-note"]').text()).toBe('Cada negocio tiene su propio asistente.');
    expect(foot.text()).not.toContain('Pídele a quien administra el negocio que mejore el plan.');
    expect(foot.find('[data-testid="assistant-no-plan-upgrade"]').exists()).toBe(false);
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
