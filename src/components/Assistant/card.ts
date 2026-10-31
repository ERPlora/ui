// The card of a write the assistant wants to run (BASE-G115, G116), as the server describes it (the turn's `confirm`
// frame; the Hub's base/assistant.py `card`): its action by its verb (the host's catalogue, `AssistantConfig.verbKey`)
// and its app by its name, never the operation's id; each
// datum in words — an amount its schema marks (`money`), in the business's currency (gh:hub#1045) or, in a preview,
// the one its read answers, and, when it says it is signed (a difference), with its sign as Cash register writes it, a
// yes or no, a dash for nothing, a list by its items in words or else by how many. A normal write is one line; a
// dangerous one, every datum and what to type.
import { formatMoney, type Money } from '../format/money';

export interface AssistantField {
  name: string;
  label: string;
  kind: 'text' | 'money' | 'bool' | 'list' | 'object' | 'empty';
  value: unknown;
  /** Its `label` is the title its app wrote («Cuenta» for the check a write of Tables touches): the card calls it so,
   *  over its own word for a datum it knows by its name (`FIELDS`). */
  titled?: boolean;
  /** An amount its app declares signed (Cash register's difference): «+» over, «-» short, none at zero. */
  signed?: boolean;
  /** The currency of an amount of a preview, as its read answers it (an invoice keeps the one it was issued in);
   *  none = the business's, the card's own. */
  money?: Money | null;
  /** A list whose every item the server said in words (a record by its name, a moment, a value by its label, an
   *  amount: `live.assistant.NAMED`): the card says its items. Without it, how many it carries (codes nobody names). */
  named?: boolean;
}

export interface AssistantCard {
  operation: string;
  app: string;
  app_name: string;
  action: string;
  risk: 'normal' | 'high';
  fields: AssistantField[];
  count: number | null;
  confirm_word: string;
  blocked: boolean;
  /** The business's currency for its amounts (gh:hub#1045). */
  money?: Money | null;
  /** What a dangerous write will do, as the read its app declares answers it for this person (BASE-F98); none when
   *  its app declares no preview. */
  preview?: AssistantField[] | null;
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

export interface CardFormat {
  locale: string;
  money?: Money;
  t: Translate;
}

/** The data a card names itself in the person's language (`assistant.card.fields.<name>`, the chat's own words) unless their app titles
 *  them; another, by the label the server gives it in that language (base/assistant.py `_label`). */
const FIELDS = [
  'name', 'price', 'amount', 'note', 'notes', 'status', 'email', 'phone', 'quantity', 'qty', 'description',
  'duration_minutes', 'date', 'time', 'starts_at', 'ends_at', 'customer_id', 'reason', 'id', 'ids', 'title', 'category',
  'app',
];

export function fieldLabelKey(name: string): string | null {
  return FIELDS.includes(name) ? `assistant.card.fields.${name}` : null;
}

/** A key that is a figure (the face value of what a cash count counted) is data the person reads; any other is a name
 *  of the code's, in English. */
const FIGURE = /^\d+(?:[.,]\d+)?$/;

/** An amount inside an object or a list, as the server sends it (base/assistant.py `_Words.amount`): written as one on
 *  top of the card, in its currency (`money`; none, the card's) and with the screen's own symbol. */
interface AssistantAmount {
  kind: 'money';
  value: number;
  money?: Money | null;
}

const AMOUNT_KEYS = new Set(['kind', 'value', 'money']);

function isAmount(value: unknown): value is AssistantAmount {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const shape = value as Record<string, unknown>;
  return shape.kind === 'money' && typeof shape.value === 'number' && Object.keys(shape).every((key) => AMOUNT_KEYS.has(key));
}

/** An object datum in words (FIX-HUB-BASE-ASSISTANT-CARD-OBJECT-SHOWS-INNER-KEYS-IN-ENGLISH): by its values, as a
 *  summary says an address or a ticket a variant, never by its keys — but a figure's —; its empty data left out, a
 *  yes or no in words, an amount as one on top (`isAmount`), a list's items one after another. Empty: '' (the caller
 *  writes the dash). */
function compact(value: unknown, format: CardFormat): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return format.t(value ? 'assistant.card.yes' : 'assistant.card.no');
  if (typeof value !== 'object') return String(value);
  if (isAmount(value)) return fieldText({ name: '', label: '', kind: 'money', value: value.value, money: value.money }, format);
  const parts = Array.isArray(value)
    ? value.map((item) => compact(item, format))
    : Object.entries(value as Record<string, unknown>).map(([key, inner]) => {
        const text = compact(inner, format);
        return text && FIGURE.test(key) ? `${key}: ${text}` : text;
      });
  return parts.filter(Boolean).join(Array.isArray(value) ? ', ' : ' · ');
}

/** The items a list says by name: up to this many, every one; past it, one fewer and how many more (Odoo's tags list,
 *  «A, B, C y 2 más»: never «and 1 more» for an item that could have been named). */
const LIST_NAMES = 4;

/** An item of a list said as a value on top — a text (a record the server names), a figure, a yes or no, an amount —;
 *  '' when it cannot be: a record the server left out, or a line (which datum names a line, only its app knows: one whose
 *  record was left out would read as a bare quantity or price). */
function listItem(item: unknown, format: CardFormat): string {
  const value = typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || isAmount(item);
  return value ? compact(item, format) : '';
}

/** A list in words (FIX-HUB-PRINTING-ASSISTANT-CARD-LEAVES-OUT-ITS-RECORDS), when the server said its items in words
 *  (`named`): one after another, the ones it cannot say among the more; else, or none it can say, how many it carries.
 *  Items that carry a comma themselves (a moment in Spanish, «2 nov 2026, 10:00») are told apart by a semicolon, as the
 *  RAE and English style guides separate a series whose items have commas. */
function listText(items: readonly unknown[], named: boolean, format: CardFormat): string {
  const said = named ? items.map((item) => listItem(item, format)).filter(Boolean) : [];
  if (said.length === 0) return format.t('assistant.card.items', { count: items.length });
  const shown = said.slice(0, items.length <= LIST_NAMES ? LIST_NAMES : LIST_NAMES - 1);
  const more = items.length - shown.length;
  const text = shown.join(shown.some((item) => item.includes(',')) ? '; ' : ', ');
  return more === 0 ? text : format.t('assistant.card.more', { items: text, count: more });
}

export function fieldText(field: AssistantField, format: CardFormat): string {
  switch (field.kind) {
    case 'empty':
      return '—';
    case 'money': {
      const text = formatMoney(field.value, format.locale, field.money ?? format.money);
      return field.signed && Number(field.value) > 0 ? `+${text}` : text;
    }
    case 'bool':
      return format.t(field.value ? 'assistant.card.yes' : 'assistant.card.no');
    case 'list':
      return listText(Array.isArray(field.value) ? field.value : [], field.named === true, format);
    case 'object':
      return compact(field.value, format) || '—';
    default:
      return String(field.value);
  }
}

/** A dangerous write's data, one line each: the title its app wrote, else its name in the person's language, else the
 *  server's label, and its value in words. What it sends and what it will do (its preview) are said alike. */
export function fieldLines(fields: readonly AssistantField[], format: CardFormat): string[] {
  return fields.map((field) => {
    const key = field.titled ? null : fieldLabelKey(field.name);
    return `${key ? format.t(key) : field.label}: ${fieldText(field, format)}`;
  });
}

/** A normal write in one line: its first three data, the empty ones left out. */
export function cardLine(card: AssistantCard, format: CardFormat): string {
  return card.fields
    .filter((field) => field.kind !== 'empty')
    .slice(0, 3)
    .map((field) => fieldText(field, format))
    .join(' · ');
}

/** Whether `typed` is what the card asks, as `ConfirmDialog` (which asks it) and the server compare it: spaces around
 *  and case ignored, accents not; a normal write asks nothing; a blocked one, never. */
export function typedMatches(card: AssistantCard, typed: string): boolean {
  if (card.blocked) return false;
  return card.confirm_word === '' || typed.trim().toLocaleLowerCase() === card.confirm_word.toLocaleLowerCase();
}
