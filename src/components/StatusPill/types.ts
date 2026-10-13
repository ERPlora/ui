// Public types of StatusPill and of the panel's status helpers (`statuses.ts`).

/** Colour of a pill, by meaning: done/fine, in progress, needs attention, blocked/failed, inert. */
export type StatusPillTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

/** `md` is the pill of the mockups (11.5px); `sm` is a tighter one for dense rows. */
export type StatusPillSize = 'sm' | 'md';

/** What a status helper returns: spread it on the component (`<StatusPill v-bind="spec" />`). */
export interface StatusPillSpec {
  tone: StatusPillTone;
  label: string;
  /** The dot pulses: the status is in progress (preparing, issuing). */
  busy: boolean;
}

/** Statuses of a business (`hubs.business.list`), of a member and of a subscription or module. */
export type BusinessStatus =
  | 'ready'
  | 'preparing'
  | 'past_due'
  | 'suspended'
  | 'deleting'
  | 'pending_invitation'
  | 'active'
  | 'cancelled';

/** Statuses of an ERPlora invoice to the customer (Account → Billing). */
export type InvoiceStatus = 'draft' | 'pending' | 'issuing' | 'paid' | 'failed' | 'refunded';
