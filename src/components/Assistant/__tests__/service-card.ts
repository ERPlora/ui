// The card of a new service, the normal write the card's tests and the confirmation's tests start from.
import type { AssistantCard, AssistantField } from '../card';

/** Its name and its price, as the server sends them. */
const HAIRCUT: AssistantField[] = [
  { name: 'name', label: 'Name', kind: 'text', value: 'Corte caballero' },
  { name: 'price', label: 'Price', kind: 'money', value: 1500 },
];

/** Creating a service in Services: its name and its price, then `more`; any other part of the card as `card` says. */
export function serviceCard(more: AssistantField[], card: Partial<AssistantCard> = {}): AssistantCard {
  return {
    operation: 'service.service.create',
    app: 'service',
    app_name: 'Servicios',
    action: 'create',
    risk: 'normal',
    fields: [...HAIRCUT, ...more],
    count: null,
    confirm_word: '',
    blocked: false,
    ...card,
  };
}
