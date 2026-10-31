// BASE-G115 and G116: what the card of a write says before it runs — its action and app by their names, each datum
// in words (an amount in the business's currency, never in cents: gh:hub#1045). Cases of the old hub's
// `assistant-confirm.test.ts` and `assistant-danger.test.ts`.
import { describe, expect, it } from 'vitest';

import { type AssistantCard, cardLine, fieldLabelKey, fieldLines, fieldText, typedMatches } from './card';
import { assistantMessages } from './messages';

const { en, es } = assistantMessages;

const EUR = { currency: 'EUR', decimals: 2 };
const t = (key: string, values?: Record<string, unknown>) => (values ? `${key}${JSON.stringify(values)}` : key);
const opts = { locale: 'es-ES', money: EUR, t };
/** The card's format with a real catalogue's words, as the screen says them. */
const said = (catalogue: unknown) => ({
  ...opts,
  t: (key: string) => String(key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalogue)),
});

function card(fields: Partial<AssistantCard> = {}): AssistantCard {
  return {
    operation: 'service.service.create',
    app: 'service',
    app_name: 'Servicios',
    action: 'create',
    risk: 'normal',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', value: 'Corte caballero' },
      { name: 'price', label: 'Price', kind: 'money', value: 1500 },
      { name: 'online', label: 'Online', kind: 'bool', value: true },
      { name: 'note', label: 'Note', kind: 'empty', value: null },
    ],
    count: null,
    confirm_word: '',
    blocked: false,
    ...fields,
  };
}

describe('each datum', () => {
  it('an amount marked in cents is written in the business’s currency', () => {
    expect(fieldText(card().fields[1], opts)).toBe('15,00\u00a0€');
  });

  it('an amount marked signed says over or short as Cash register does: + over, - short, none at zero', () => {
    // FIX-HUB-BASE-ASSISTANT-CARD-POSITIVE-DIFFERENCE-WITHOUT-SIGN: a difference over came as «137,90 €», like an
    // amount, while only the one short had its sign.
    const difference = (value: number) => ({ name: 'difference', label: 'Diferencia', kind: 'money' as const, value, signed: true });
    expect(fieldText(difference(13790), opts)).toBe('+137,90 €');
    expect(fieldText(difference(-490), opts)).toBe('-4,90 €');
    expect(fieldText(difference(0), opts)).toBe('0,00 €');
    expect(fieldText(difference(13790), { ...opts, locale: 'en' })).toBe('+€137.90');
    // Until the business's currency is known, the figure alone, with its sign.
    expect(fieldText(difference(13790), { locale: 'en', t })).toBe('+137.90');
    // Any other amount, positive as it is, never gets one; nor does a datum that is no amount, whatever it says.
    expect(fieldText(card().fields[1], opts)).toBe('15,00 €');
    expect(fieldText({ name: 'duration', label: 'Duration', kind: 'text', value: 1500, signed: true }, opts)).toBe('1500');
  });

  it('an amount that carries its own currency (a preview’s, as its read answers it) is written in it, not the business’s', () => {
    // FIX-HUB-BASE-ASSISTANT-CARD-MONEY-IN-BUSINESS-NOT-PREVIEW-CURRENCY: an invoice issued in euros, rectified once the
    // business had moved to Poland, showed «-121,00 zł» on the card.
    const PLN = { currency: 'PLN', decimals: 2 };
    const total = { name: 'total_amount', label: 'Total', kind: 'money' as const, value: -12100, money: EUR };
    expect(fieldText(total, { ...opts, money: PLN })).toBe('-121,00 €');
    expect(fieldText(total, { locale: 'en', money: PLN, t })).toBe('-€121.00');
    // Even before the business's is known; with its sign when it is a difference.
    expect(fieldText(total, { locale: 'es-ES', t })).toBe('-121,00 €');
    expect(fieldText({ ...total, value: 4200, signed: true }, { ...opts, money: PLN })).toBe('+42,00 €');
    // One that carries none, in the business's, as before.
    expect(fieldText({ ...total, money: null }, { ...opts, money: PLN })).toBe('-121,00 zł');
    expect(fieldText(card().fields[1], { ...opts, money: PLN })).toBe('15,00 zł');
  });

  it('an amount is in the minor unit of its currency: a yen invoice’s total is not a hundred times less', () => {
    // FIX-HUB-BASE-ASSISTANT-CARD-MONEY-IN-BUSINESS-NOT-PREVIEW-CURRENCY: Invoicing answers ¥12,100 as 12100.
    const JPY = { currency: 'JPY', decimals: 0 };
    const total = { name: 'total_amount', label: 'Total', kind: 'money' as const, value: -12100, money: JPY };
    expect(fieldText(total, { ...opts, locale: 'en' })).toBe('-¥12,100');
    expect(fieldText(card().fields[1], { locale: 'en', money: JPY, t })).toBe('¥1,500');
  });

  it('what is not marked as money stays a number', () => {
    expect(fieldText({ name: 'duration', label: 'Duration', kind: 'text', value: 1500 }, opts)).toBe('1500');
  });

  it('a yes or no in words, an empty one as a dash', () => {
    expect(fieldText(card().fields[2], opts)).toBe('assistant.card.yes');
    expect(fieldText(card().fields[3], opts)).toBe('—');
  });

  it('a list of lines says how many, a nested object never breaks the card', () => {
    expect(fieldText({ name: 'rows', label: 'Rows', kind: 'list', value: [{ qty: 1 }, { qty: 2 }, { qty: 3 }] }, opts)).toBe(
      'assistant.card.items{"count":3}',
    );
    expect(fieldText({ name: 'address', label: 'Address', kind: 'object', value: { city: 'Vigo' } }, opts)).toBe('Vigo');
  });
});

describe('a datum that is a list', () => {
  // FIX-HUB-PRINTING-ASSISTANT-CARD-LEAVES-OUT-ITS-RECORDS: the server names each record of a list («Caja», «Cocina»),
  // and the card said «Impresoras: 2 elementos». As Odoo's tags, Salesforce's pills or Atlassian's avatars: what it can
  // say in words, one after another; past four, the first three and how many more. Only a list the server says it put
  // in words (`named`): one of texts sent as they are — codes nobody names — still says how many.
  const list = (value: unknown[], named = true) => ({ name: 'printers', label: 'Impresoras', kind: 'list' as const, value, named });
  /** The screen's words, with their values and the plural the catalogue picks (`a | b | c`: none, one, more). */
  const spoken = (catalogue: unknown) => ({
    ...opts,
    t: (key: string, values: Record<string, unknown> = {}) => {
      const text = String(key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalogue));
      const forms = text.split(' | ');
      const count = Number(values.count ?? 2);
      const form = forms.length === 3 ? forms[Math.min(count, 2)] : forms[0];
      return form.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
    },
  });

  it('says the records the server names, one after another (printing.device.update’s printers)', () => {
    expect(fieldText(list(['E2E PAC Caja', 'E2E PAC Cocina']), spoken(es))).toBe('E2E PAC Caja, E2E PAC Cocina');
    expect(fieldLines([list(['Caja', 'Cocina'])], spoken(es))).toEqual(['Impresoras: Caja, Cocina']);
    expect(cardLine(card({ fields: [list(['Caja'])] }), spoken(en))).toBe('Caja');
  });

  it('up to four, every one; past four, the first three and how many more', () => {
    expect(fieldText(list(['A', 'B', 'C', 'D']), spoken(es))).toBe('A, B, C, D');
    expect(fieldText(list(['A', 'B', 'C', 'D', 'E']), spoken(es))).toBe('A, B, C y 2 más');
    expect(fieldText(list(['A', 'B', 'C', 'D', 'E', 'F', 'G']), spoken(en))).toBe('A, B, C and 4 more');
  });

  it('one it cannot name (left out: not there, or not the person’s to read) counts among the more, never by its id', () => {
    expect(fieldText(list(['Caja', null]), spoken(es))).toBe('Caja y 1 más');
    expect(fieldText(list(['Caja', null]), spoken(en))).toBe('Caja and 1 more');
    // None of them: how many, as before.
    expect(fieldText(list([null, null]), spoken(es))).toBe('2 elementos');
    expect(fieldText(list([null]), spoken(en))).toBe('1 item');
  });

  it('a value is said as one on top: a figure, a yes or no, an amount in its currency', () => {
    expect(fieldText(list([10, 20]), opts)).toBe('10, 20');
    expect(fieldText(list([true, false]), opts)).toBe('assistant.card.yes, assistant.card.no');
    expect(fieldText(list([{ kind: 'money', value: 150 }, { kind: 'money', value: 1200, money: { currency: 'USD', decimals: 2 } }]), opts)).toBe(
      // A decimal comma inside each amount: a semicolon between them, as between moments.
      '1,50\u00a0€; 12,00\u00a0$',
    );
  });

  it('lines (objects or lists) say how many: which datum names a line, only its app knows', () => {
    // A line whose record the server left out would read as a bare quantity or price («2 · 3,00 €»).
    expect(fieldText(list([{ quantity: 2, unit_price: { kind: 'money', value: 300 } }], false), spoken(es))).toBe('1 elemento');
    expect(fieldText(list([{}], false), spoken(es))).toBe('1 elemento');
    expect(fieldText(list([['a'], ['b']], false), spoken(en))).toBe('2 items');
    // Even marked, a line is never said by its values: it counts among the more.
    expect(fieldText(list(['Caja', { quantity: 2 }]), spoken(es))).toBe('Caja y 1 más');
  });

  it('a list of texts the server did not name says how many, never its codes (flow.flow.grant’s operations)', () => {
    // The two revisers of ui#48: «Permisos: sale.sale.create, invoice.invoice.issue…» on a dangerous write.
    const operations = { name: 'operations', label: 'Permisos', kind: 'list' as const, value: ['sale.sale.create', 'invoice.invoice.issue'] };
    expect(fieldText(operations, spoken(es))).toBe('2 elementos');
    expect(fieldLines([operations], spoken(es))).toEqual(['Permisos: 2 elementos']);
    expect(fieldText(list(['sale', 'invoice'], false), spoken(en))).toBe('2 items');
  });

  it('moments said with a comma are told apart: a semicolon between them (appointment.appointment.bulk_create’s starts)', () => {
    const starts = list(['2 nov 2026, 10:00', '9 nov 2026, 10:00', '16 nov 2026, 10:00', '23 nov 2026, 10:00', '30 nov 2026, 10:00']);
    expect(fieldText(starts, spoken(es))).toBe('2 nov 2026, 10:00; 9 nov 2026, 10:00; 16 nov 2026, 10:00 y 2 más');
    expect(fieldText(list(['2 nov 2026, 10:00', '9 nov 2026, 10:00']), spoken(es))).toBe('2 nov 2026, 10:00; 9 nov 2026, 10:00');
    // Names without a comma keep the comma between them.
    expect(fieldText(list(['Caja', 'Cocina']), spoken(es))).toBe('Caja, Cocina');
    // One item with a comma is enough: a name that carries one would run into the next.
    expect(fieldText(list(['García, Ana', 'Eva Gil']), spoken(es))).toBe('García, Ana; Eva Gil');
  });

  it('an empty one says it carries none', () => {
    expect(fieldText(list([]), spoken(es))).toBe('ningún elemento');
  });
});

describe('a datum that is an object', () => {
  // FIX-HUB-BASE-ASSISTANT-CARD-OBJECT-SHOWS-INNER-KEYS-IN-ENGLISH: its inner data went by their keys, in English in
  // every language («Plantilla: name: cita_recordatorio · language: es»). Like an address on a summary or a variant
  // on a ticket, it is said by its values; its own name is the datum's.
  const template = {
    name: 'template',
    label: 'Plantilla',
    kind: 'object' as const,
    value: { name: 'cita_recordatorio', language: 'es', variables: ['Ana', '10:00'] },
  };

  it('says its values, never their keys (whatsapp_inbox.message.send’s template)', () => {
    expect(fieldText(template, opts)).toBe('cita_recordatorio · es · Ana, 10:00');
    expect(fieldLines([template], opts)).toEqual(['Plantilla: cita_recordatorio · es · Ana, 10:00']);
    const line = cardLine(card({ fields: [{ name: 'to', label: 'Teléfono', kind: 'text', value: '+34600111222' }, template] }), opts);
    expect(line).toBe('+34600111222 · cita_recordatorio · es · Ana, 10:00');
    expect(line).not.toMatch(/\b(name|language|variables):/);
  });

  it('leaves out its empty data; one with none is a dash', () => {
    expect(fieldText({ ...template, value: { name: 'cita_recordatorio', language: null, variables: [], header_sample: '' } }, opts)).toBe(
      'cita_recordatorio',
    );
    expect(fieldText({ ...template, value: { language: null, variables: [] } }, opts)).toBe('—');
  });

  it('within it, an object or a list is said the same way, and a yes or no in words', () => {
    const content = { hero: { title: 'Hola', visible: true }, gallery: [{ url: 'a.jpg' }, { url: 'b.jpg' }], footer: { visible: false } };
    expect(fieldText({ name: 'content', label: 'Contenido', kind: 'object', value: content }, opts)).toBe(
      'Hola · assistant.card.yes · a.jpg, b.jpg · assistant.card.no',
    );
  });

  it('a key that is a figure is data, not a name, and stays: the face value of what was counted', () => {
    // A JavaScript object gives its whole-number keys in ascending order, as they come.
    const denominations = { bills: { '50': 2, '20': 1 }, coins: { '0.50': 4 } };
    expect(fieldText({ name: 'denominations', label: 'Billetes y monedas', kind: 'object', value: denominations }, opts)).toBe(
      '20: 1 · 50: 2 · 0.50: 4',
    );
    // A figure written with a decimal comma is one too; one counted as nothing is left out, as any empty datum.
    expect(fieldText({ name: 'denominations', label: 'Billetes y monedas', kind: 'object', value: { '0,50': 4, '20': null } }, opts)).toBe(
      '0,50: 4',
    );
  });

  it('a key with a figure only in part of it is still a name: an address’s line1 (cart_checkout’s free fields)', () => {
    const address = { line1: 'Calle Mayor 1', '2nd_line': '2º B', postal_code: '36201', city: 'Vigo' };
    expect(fieldText({ name: 'shipping_address', label: 'Dirección de envío', kind: 'object', value: address }, opts)).toBe(
      'Calle Mayor 1 · 2º B · 36201 · Vigo',
    );
  });

  it('an amount within it is written as one on top: its currency, the same symbol, never the server’s words', () => {
    // FIX-HUB-BASE-ASSISTANT-MONEY-KNOWN-ONLY-BY-DESCRIPTION-WORDS: the server said an amount inside an object in its own
    // words («1,50 US$», «1,50 PLN») and the screen the one on top in its own («1,50 $», «1,50 zł»), on one card.
    const PLN = { currency: 'PLN', decimals: 2 };
    const USD = { currency: 'USD', decimals: 2 };
    const JPY = { currency: 'JPY', decimals: 0 };
    const line = (amount: unknown) => ({ name: 'line', label: 'Línea', kind: 'object' as const, value: { text: 'Café', unit_price: amount } });
    const top = (money?: typeof USD) => ({ name: 'price', label: 'Precio', kind: 'money' as const, value: 150, money });
    // In the business's currency, the card's own.
    expect(fieldText(line({ kind: 'money', value: 150 }), { ...opts, money: PLN })).toBe('Café · 1,50 zł');
    expect(fieldText(top(), { ...opts, money: PLN })).toBe('1,50 zł');
    // In the one its write names, with its decimals.
    expect(fieldText(line({ kind: 'money', value: 150, money: USD }), opts)).toBe('Café · 1,50 $');
    expect(fieldText(top(USD), opts)).toBe('1,50 $');
    expect(fieldText(line({ kind: 'money', value: 1500, money: JPY }), opts)).toBe('Café · 1500 ¥');
    // Inside a list inside an object, the same.
    const order = { lines: [{ text: 'Té', unit_price: { kind: 'money', value: 1200 } }] };
    expect(fieldText({ name: 'order', label: 'Pedido', kind: 'object', value: order }, opts)).toBe('Té · 12,00 €');
    // What only looks like one is said by its values, as any other.
    expect(fieldText(line({ kind: 'money', value: 150, note: 'x' }), opts)).toBe('Café · money · 150 · x');
    expect(fieldText(line({ kind: 'money', value: '150' }), opts)).toBe('Café · money · 150');
    expect(fieldText(line({ kind: 'cash', value: 150 }), opts)).toBe('Café · cash · 150');
  });

  it('a secret stays hidden as the server sends it', () => {
    expect(fieldText({ name: 'login', label: 'Acceso', kind: 'object', value: { user: 'ana', password: '••••••••' } }, opts)).toBe(
      'ana · ••••••••',
    );
  });

  it('a known datum is named in the person’s language; another by its own title', () => {
    expect(fieldLabelKey('price')).toBe('assistant.card.fields.price');
    // The app a card turns on or off (base.app.enable/disable, PLAN-HUB §9): «App» in both languages.
    expect(fieldLabelKey('app')).toBe('assistant.card.fields.app');
    expect(fieldLabelKey('tax_category_key')).toBeNull();
  });
});

describe('the lines of a dangerous write', () => {
  it('each datum by its name in the person’s language, else by the label the server gives it, and its value in words', () => {
    // BASE-F98: what the write sends and what it will do (its preview) are both said this way.
    expect(fieldLines(card().fields.slice(0, 2), opts)).toEqual([
      'assistant.card.fields.name: Corte caballero',
      'assistant.card.fields.price: 15,00\u00a0€',
    ]);
    expect(fieldLines([{ name: 'expected_balance', label: 'Efectivo esperado', kind: 'money', value: 23000 }], opts)).toEqual([
      'Efectivo esperado: 230,00\u00a0€',
    ]);
    expect(fieldLines([], opts)).toEqual([]);
  });

  // FIX-HUB-BASE-ASSISTANT-DANGER-CARD-CALLS-THE-RECORD-BY-ITS-FIELD-NAME: transferring a check said «Registro: 5
  // (Terraza)» where Tables titles it «Cuenta»: the screen's word for a datum it knows by its name (`id`) hid the title
  // its app wrote, which the server marks `titled`.

  it('a datum its app titles is called by that title, over the screen’s word for its name', () => {
    const check = { name: 'id', kind: 'text' as const, value: '5 (Terraza)', titled: true };
    expect(fieldLines([{ ...check, label: 'Cuenta' }], said(es))).toEqual(['Cuenta: 5 (Terraza)']);
    expect(fieldLines([{ ...check, label: 'Check' }], said(en))).toEqual(['Check: 5 (Terraza)']);
  });

  it('one its app does not title keeps the screen’s word for its name, in English and in Spanish', () => {
    // The server's label for an untitled `id` is the model's («ID»), or pydantic's made-up title for another.
    const device = { name: 'id', label: 'ID', kind: 'text' as const, value: 'Barra' };
    const name = { name: 'name', label: 'Name', kind: 'text' as const, value: 'Corte caballero' };
    expect(fieldLines([device, name], said(es))).toEqual(['Registro: Barra', 'Nombre: Corte caballero']);
    expect(fieldLines([device, name], said(en))).toEqual(['Record: Barra', 'Name: Corte caballero']);
    expect(fieldLines([{ ...device, titled: false }], said(es))).toEqual(['Registro: Barra']);
  });
});

describe('the one line of a normal write', () => {
  it('says its first data, never the empty ones', () => {
    expect(cardLine(card(), opts)).toBe('Corte caballero · 15,00\u00a0€ · assistant.card.yes');
  });
});

describe('what a dangerous write asks to type', () => {
  it('is compared as ConfirmDialog and the server do: spaces around and case ignored', () => {
    const high = card({ risk: 'high', confirm_word: 'CONFIRMAR' });
    expect(typedMatches(high, ' CONFIRMAR ')).toBe(true);
    expect(typedMatches(high, 'confirmar')).toBe(true);
    expect(typedMatches(high, 'CONFIRMA')).toBe(false);
    expect(typedMatches(card(), '')).toBe(true);
    expect(typedMatches(card({ risk: 'high', confirm_word: '3', count: 3 }), '3')).toBe(true);
  });

  it('nothing is ever confirmed on a write that is not done from the chat', () => {
    expect(typedMatches(card({ risk: 'high', blocked: true, confirm_word: 'CONFIRMAR' }), 'CONFIRMAR')).toBe(false);
  });
});
