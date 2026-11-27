import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configure, mountAssistant } from './__tests__/mount-assistant';
import AssistantMessage from './AssistantMessage.vue';
import { configureAssistant } from './config';
import type { Bubble } from './history';
import { ASSISTANT_ICONS } from './icons';

beforeEach(() => configure());

/** Hydrated Ionic moves the host's `aria-label` to its native button. */
const ariaLabel = (el: Element) => el.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? el.getAttribute('aria-label');
afterEach(() => configureAssistant(undefined));

function answer(fields: Partial<Bubble> = {}): Bubble {
  return { id: 'b2', role: 'assistant', text: '', files: [], notices: [], done: true, question: '¿Cuántos?', ...fields };
}

function mountBubble(bubble: Bubble, extra: Record<string, unknown> = {}, locale: 'en' | 'es' = 'es') {
  return mountAssistant(AssistantMessage, {
    locale,
    props: {
      bubble,
      screenExists: (path: string) => ['/settings', '/customer/customers'].includes(path.split('#')[0]),
      nameOf: (path: string) => ({ '/settings': 'Ajustes', '/customer/customers': 'Clientes' })[path.split('#')[0]],
      // The menu's name of an app, in the screen's language; none for an app it does not list.
      appNameOf: (app: string) => ({ demo: 'Demo', invoice: 'Facturación' })[app],
      canUpgrade: false,
      planUrl: '',
      canSpeak: false,
      canReport: true,
      ...extra,
    },
  });
}

describe('AssistantMessage', () => {
  it('«Read aloud» is the speaker icon alone, and the stop icon while it reads, named by what a press does', async () => {
    const { wrapper } = await mountBubble(answer({ text: 'Hoy has vendido 120 €.' }), { canSpeak: true });
    const listen = () => wrapper.get('[data-testid="assistant-listen"]');
    const icon = () => (listen().get('ion-icon[slot="icon-only"]').element as HTMLElement & { src?: string }).src;
    const seen = () => [listen().text(), ariaLabel(listen().element), listen().attributes('title'), icon()];
    expect(seen()).toEqual(['', 'Leer en voz alta', 'Leer en voz alta', ASSISTANT_ICONS.listen]);
    await wrapper.setProps({ speaking: true });
    await flushPromises();
    expect(seen()).toEqual(['', 'Dejar de leer', 'Dejar de leer', ASSISTANT_ICONS.stop]);
    wrapper.unmount();
  });

  it('the person’s question comes out as written, with its files', async () => {
    const { wrapper } = await mountBubble({ id: 'b1', role: 'user', text: '**hola**', files: ['carta.pdf'], notices: [], done: true });
    expect(wrapper.find('[data-testid="assistant-bubble-user"]').text()).toContain('**hola**');
    expect(wrapper.text()).toContain('carta.pdf');
    wrapper.unmount();
  });

  it('dots while nothing has arrived yet, and no report under an answer still being written', async () => {
    const { wrapper } = await mountBubble(answer({ done: false }));
    expect(wrapper.find('[data-testid="assistant-writing"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assistant-report"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('an answer that ended saying nothing says so', async () => {
    const { wrapper } = await mountBubble(answer({ text: '' }));
    expect(wrapper.text()).toContain('(sin respuesta)');
    wrapper.unmount();
  });

  it('«Go to …» for each screen of this app it names, by its menu name, and never one it does not serve', async () => {
    const { wrapper } = await mountBubble(answer({ text: 'Ve a [aquí](/settings#business), a /customer/customers o a /reports.' }));
    const goes = wrapper.findAll('[data-testid="assistant-go"]');
    expect(goes.map((button) => button.text())).toEqual(['Ir a Ajustes', 'Ir a Clientes']);
    await goes[0].trigger('click');
    expect(wrapper.emitted('go')).toEqual([['/settings#business']]);
    wrapper.unmount();
  });

  it('the notices of what it said against what ran, outside the answer', async () => {
    const { wrapper } = await mountBubble(answer({ text: 'He creado Mesa 4.', notices: ['claimed_change'] }));
    expect(wrapper.find('[data-testid="assistant-notice-claimed_change"]').text()).toBe(
      'El asistente ha dicho que hizo un cambio, pero no se ejecutó ninguna acción. No se ha modificado nada.',
    );
    wrapper.unmount();
  });

  it('a receipt of each action of the turn: done, or why not', async () => {
    const executed = [
      { name: 'demo.item.create', app: 'demo', outcome: 'ok' },
      { name: 'demo.item.delete', app: 'demo', outcome: 'cancelled' },
    ];
    const { wrapper } = await mountBubble(answer({ text: 'Listo.', executed }));
    expect(wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'Hecho: Crear en Demo',
      'No se hizo, cancelado: Borrar en Demo',
    ]);
    wrapper.unmount();
  });

  it('a failed receipt says why in a sentence, as the server said it, and only in the language it was said in', async () => {
    const executed = [
      { name: 'demo.item.create', app: 'demo', outcome: 'error', reason: { es: 'Este elemento está cerrado: ábrelo para añadir líneas.' } },
      // A host that says no reason (or a receipt kept from before it did): the receipt as it was.
      { name: 'demo.item.create', app: 'demo', outcome: 'error' },
      { name: 'demo.item.delete', app: 'demo', outcome: 'cancelled', reason: { es: 'No se dice.' } },
    ];
    const es = await mountBubble(answer({ text: 'No lo he hecho.', executed }));
    expect(es.wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'No se hizo, falló: Crear en Demo. Este elemento está cerrado: ábrelo para añadir líneas.',
      'No se hizo, falló: Crear en Demo',
      'No se hizo, cancelado: Borrar en Demo',
    ]);
    es.wrapper.unmount();
    // Read in English, the receipt is said whole in English: without the reason, which was said in Spanish.
    const en = await mountBubble(answer({ text: 'Not done.', executed }), {}, 'en');
    expect(en.wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'Not done, it failed: Create in Demo',
      'Not done, it failed: Create in Demo',
      'Not done, cancelled: Delete in Demo',
    ]);
    en.wrapper.unmount();
    const english = [{ name: 'demo.item.create', app: 'demo', outcome: 'error', reason: { en: 'This item is closed: open it to add lines.' } }];
    const said = await mountBubble(answer({ text: 'Not done.', executed: english }), {}, 'en');
    expect(said.wrapper.find('[data-testid="assistant-receipt"]').text()).toBe(
      'Not done, it failed: Create in Demo. This item is closed: open it to add lines.',
    );
    said.wrapper.unmount();
  });

  it('a receipt names the action by its own verb, in Spanish and in English, never «Do this»', async () => {
    const executed = [
      { name: 'invoice.invoice.rectify', app: 'invoice', app_name: 'Facturación', outcome: 'ok' },
      { name: 'invoice.invoice.mark_paid', app: 'invoice', app_name: 'Facturación', outcome: 'cancelled' },
    ];
    const es = await mountBubble(answer({ text: 'Hecho.', executed }));
    expect(es.wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'Hecho: Rectificar en Facturación',
      'No se hizo, cancelado: Registrar el cobro en Facturación',
    ]);
    es.wrapper.unmount();
    const english = executed.map((row) => ({ ...row, app_name: 'Invoicing' }));
    // The menu in the screen's language, as the shell's is.
    const en = await mountBubble(answer({ text: 'Done.', executed: english }), { appNameOf: (app: string) => ({ invoice: 'Invoicing' })[app] }, 'en');
    expect(en.wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'Done: Rectify in Invoicing',
      'Not done, cancelled: Record the payment in Invoicing',
    ]);
    en.wrapper.unmount();
  });

  it('a receipt says the verb its card said: emptying a cart «Vaciar», taking a line out «Quitar», a cash count the count', async () => {
    const executed = [
      { name: 'cart_checkout.cart.clear', app: 'cart_checkout', app_name: 'Carrito y pago', outcome: 'ok' },
      { name: 'cart_checkout.item.remove', app: 'cart_checkout', app_name: 'Carrito y pago', outcome: 'cancelled' },
      { name: 'cash_register.count.add', app: 'cash_register', app_name: 'Caja', outcome: 'ok' },
    ];
    const es = await mountBubble(answer({ text: 'Hecho.', executed }));
    expect(es.wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'Hecho: Vaciar en Carrito y pago',
      'No se hizo, cancelado: Quitar en Carrito y pago',
      'Hecho: Registrar arqueo en Caja',
    ]);
    es.wrapper.unmount();
    const names = { cart_checkout: 'Cart & Checkout', cash_register: 'Cash register' };
    const en = await mountBubble(answer({ text: 'Done.', executed }), { appNameOf: (app: string) => names[app as keyof typeof names] }, 'en');
    expect(en.wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'Done: Clear in Cart & Checkout',
      'Not done, cancelled: Remove in Cart & Checkout',
      'Done: Register count in Cash register',
    ]);
    en.wrapper.unmount();
  });

  it('a receipt names where it happened as the server says it: the platform by its screen, never «base»', async () => {
    const executed = [{ name: 'base.access.settings_update', app: 'base', app_name: 'Ajustes', outcome: 'cancelled' }];
    const { wrapper } = await mountBubble(answer({ text: 'No lo he hecho.', executed }));
    expect(wrapper.find('[data-testid="assistant-receipt"]').text()).toBe('No se hizo, cancelado: Cambiar en Ajustes');
    wrapper.unmount();
  });

  it('a receipt kept from a turn in another language is said whole in the screen’s: the app by its menu, the platform by its screen', async () => {
    const executed = [
      { name: 'invoice.invoice.rectify', app: 'invoice', app_name: 'Invoicing', outcome: 'cancelled' },
      { name: 'base.access.settings_update', app: 'base', app_name: 'Settings', screen: 'settings', outcome: 'ok' },
      // An app the menu does not list (gone, or not this person's): as the server named it then.
      { name: 'demo.item.create', app: 'stock', app_name: 'Almacén', outcome: 'ok' },
    ];
    const { wrapper } = await mountBubble(answer({ text: 'No lo he hecho.', executed }));
    expect(wrapper.findAll('[data-testid="assistant-receipt"]').map((row) => row.text())).toEqual([
      'No se hizo, cancelado: Rectificar en Facturación',
      'Hecho: Cambiar en Ajustes',
      'Hecho: Crear en Almacén',
    ]);
    wrapper.unmount();
  });

  it('a failure before any word: no empty bubble, the failure in its place', async () => {
    const { wrapper } = await mountBubble(answer({ error: 'assistant.unavailable' }));
    expect(wrapper.find('[data-testid="assistant-answer"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assistant-bubble-assistant"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-failure"]').exists()).toBe(true);
    wrapper.unmount();
    const partial = await mountBubble(answer({ text: 'Hoy has', error: 'assistant.cut' }));
    expect(partial.wrapper.get('[data-testid="assistant-bubble-assistant"]').text()).toContain('Hoy has');
    partial.wrapper.unmount();
  });

  it('a failure says what happened and offers its way out', async () => {
    const { wrapper } = await mountBubble(answer({ error: 'assistant.unreachable' }));
    expect(wrapper.text()).toContain('No se pudo contactar con el asistente.');
    await wrapper.find('[data-testid="assistant-retry"]').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
    wrapper.unmount();
  });

  it.each([
    ['es', 1, 'Demasiadas preguntas seguidas: espera 1 segundo y vuelve a intentarlo.'],
    ['es', 40, 'Demasiadas preguntas seguidas: espera 40 segundos y vuelve a intentarlo.'],
    ['en', 1, 'Too many questions in a row: wait 1 second and try again.'],
    ['en', 40, 'Too many questions in a row: wait 40 seconds and try again.'],
  ] as const)('in %s, too many questions says how long to wait (%i s): the singular for one second, the plural from two (ui#117)', async (locale, wait, said) => {
    const { wrapper } = await mountBubble(answer({ error: 'assistant.rate_limited', details: { retry_after: wait } }), {}, locale);
    expect(wrapper.get('[data-testid="assistant-failure"] p').text()).toBe(said);
    wrapper.unmount();
  });

  it('a spent allowance and when it comes back read as two sentences, in both languages', async () => {
    const spent = answer({ error: 'assistant.quota_exceeded', details: { used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z' } });
    const es = await mountBubble(spent);
    expect(es.wrapper.get('[data-testid="assistant-failure"] p').text()).toBe(
      'Has usado todos los mensajes del asistente de este mes (30 de 30). Se renuevan el 1 de noviembre.',
    );
    es.wrapper.unmount();
    const en = await mountBubble(spent, {}, 'en');
    expect(en.wrapper.get('[data-testid="assistant-failure"] p').text()).toBe(
      "You have used all the assistant's messages of this month (30 of 30). They renew on November 1.",
    );
    en.wrapper.unmount();
  });

  it('a spent allowance: the numbers, when they come back, and the plan for who may upgrade it', async () => {
    const spent = answer({ error: 'assistant.quota_exceeded', details: { used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z' } });
    const owner = await mountBubble(spent, { canUpgrade: true, planUrl: 'https://erplora.com/hubs/a/plan' });
    expect(owner.wrapper.text()).toContain('Has usado todos los mensajes del asistente de este mes (30 de 30).');
    expect(owner.wrapper.text()).toContain('Se renuevan el 1 de noviembre.');
    expect(owner.wrapper.find('[data-testid="assistant-upgrade"]').attributes('href')).toBe('https://erplora.com/hubs/a/plan');
    owner.wrapper.unmount();
    const cashier = await mountBubble(spent);
    expect(cashier.wrapper.find('[data-testid="assistant-upgrade"]').exists()).toBe(false);
    expect(cashier.wrapper.text()).toContain('Pídele a quien administra el negocio que mejore el plan.');
    cashier.wrapper.unmount();
  });

  it('«Upgrade plan» tells the panel of its click, with the event: the host may take it from the link', async () => {
    const spent = answer({ error: 'assistant.quota_exceeded', details: { used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z' } });
    const owner = await mountBubble(spent, { canUpgrade: true, planUrl: 'https://erplora.com/hubs/a/plan' });
    const link = owner.wrapper.get('[data-testid="assistant-upgrade"]');
    link.element.addEventListener('click', (seen) => seen.preventDefault(), { once: true });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.element.dispatchEvent(event);
    expect(owner.wrapper.emitted('openPlan')).toEqual([[event]]);
    owner.wrapper.unmount();
  });

  it("a spent allowance where nobody may upgrade: the host's own line, when it gives one (ui#49)", async () => {
    configure({ spentNoteKey: 'host.spentNote' });
    const spent = answer({ error: 'assistant.quota_exceeded', details: { used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z' } });
    const es = await mountBubble(spent);
    expect(es.wrapper.get('[data-testid="assistant-spent-note"]').text()).toBe('Cada negocio tiene su propio asistente.');
    expect(es.wrapper.text()).not.toContain('Pídele a quien administra el negocio que mejore el plan.');
    expect(es.wrapper.find('[data-testid="assistant-upgrade"]').exists()).toBe(false);
    es.wrapper.unmount();
    const en = await mountBubble(spent, {}, 'en');
    expect(en.wrapper.get('[data-testid="assistant-spent-note"]').text()).toBe('Each business has its own assistant.');
    en.wrapper.unmount();
    // Who may upgrade still gets «Upgrade plan», never the host's line as well.
    const owner = await mountBubble(spent, { canUpgrade: true, planUrl: 'https://erplora.com/hubs/a/plan' });
    expect(owner.wrapper.find('[data-testid="assistant-upgrade"]').exists()).toBe(true);
    expect(owner.wrapper.find('[data-testid="assistant-spent-note"]').exists()).toBe(false);
    owner.wrapper.unmount();
  });

  it('«Report a problem» under a finished answer, never under the panel’s own failure', async () => {
    const done = await mountBubble(answer({ text: 'Tienes 3.' }));
    await done.wrapper.find('[data-testid="assistant-report"]').trigger('click');
    expect(done.wrapper.emitted('report')).toHaveLength(1);
    done.wrapper.unmount();
    const failed = await mountBubble(answer({ error: 'assistant.unavailable' }));
    expect(failed.wrapper.find('[data-testid="assistant-report"]').exists()).toBe(false);
    failed.wrapper.unmount();
  });

  it('no «Report a problem» for a host that takes no reports', async () => {
    const { wrapper } = await mountBubble(answer({ text: 'Tienes 3.' }), { canReport: false });
    expect(wrapper.find('[data-testid="assistant-report"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('a file a read handed is under the answer: «Descargar …» gives the host the whole file to save', async () => {
    const saveFile = vi.fn(async () => true);
    configure({ saveFile });
    const content = '﻿Nombre;SKU\nCaña;C-1\n';
    const handed = [{ filename: 'inventario-productos.csv', content_type: 'text/csv', content }];
    const { wrapper } = await mountBubble(answer({ text: 'Aquí tienes la carta.', handed }));
    const button = wrapper.find('[data-testid="assistant-file"]');
    // The file's name is data and stays in sight; the verb is the download icon, spoken and shown as its tooltip.
    expect(button.text()).toBe('inventario-productos.csv');
    expect([ariaLabel(button.element), button.attributes('title')]).toEqual(['Descargar inventario-productos.csv', 'Descargar inventario-productos.csv']);
    await button.trigger('click');
    await flushPromises();
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [name, blob, translate] = saveFile.mock.calls[0] as unknown as [string, Blob, (key: string) => string];
    expect([name, blob.type, await blob.text()]).toEqual(['inventario-productos.csv', 'text/csv', content]);
    // The host says its own words with the panel's: a toast of where the file went, or why it could not.
    expect(translate('host.spentNote')).toBe('Cada negocio tiene su propio asistente.');
  });

  it('a file being saved cannot be asked for twice until the host answers', async () => {
    let answered: (saved: boolean) => void = () => undefined;
    configure({ saveFile: () => new Promise<boolean>((resolve) => (answered = resolve)) });
    const handed = [{ filename: 'customers.csv', content_type: 'text/csv', content: 'name\nAna\n' }];
    const { wrapper } = await mountBubble(answer({ text: 'Listo.', handed }));
    // Ionic's button takes `disabled` as its property once it is defined, and reflects it later.
    const disabled = () => (wrapper.find('[data-testid="assistant-file"]').element as HTMLIonButtonElement).disabled;
    await wrapper.find('[data-testid="assistant-file"]').trigger('click');
    expect(disabled()).toBe(true);
    answered(true);
    await flushPromises();
    expect(disabled()).toBe(false);
  });

  it('a file kept from before a reload has no content: its name says it is gone and how to get it again', async () => {
    configure({ saveFile: vi.fn() });
    const { wrapper } = await mountBubble(answer({ text: 'Aquí la tienes.', handed: [{ filename: 'customers.csv', content_type: 'text/csv' }] }));
    expect(wrapper.find('[data-testid="assistant-file"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="assistant-file-gone"]').text()).toBe(
      'El fichero «customers.csv» ya no está aquí: pídelo otra vez para descargarlo.',
    );
  });

  it('a host that saves no file offers none', async () => {
    const handed = [{ filename: 'customers.csv', content_type: 'text/csv', content: 'name\nAna\n' }];
    const { wrapper } = await mountBubble(answer({ text: 'Listo.', handed }));
    expect(wrapper.find('[data-testid="assistant-files"]').exists()).toBe(false);
  });

  it('what was not done from the chat says so', async () => {
    const { wrapper } = await mountBubble(answer({ text: 'Hazlo en Citas.', blocked: true }));
    expect(wrapper.find('[data-testid="assistant-not-from-chat"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
