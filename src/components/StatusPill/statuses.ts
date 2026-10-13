// The statuses the SaaS panel paints, each with its tone and its label, so a status looks and reads
// the same on every page and in both languages:
//   <StatusPill v-bind="businessStatusPill(row.status)" />
// The label comes from this folder's catalogue (`locales/{en,es}.json`) in `locale`, or else in the
// language of the page (`<html lang>`, which the shell keeps in step with the person's), like the
// shell's own `shellText`. A status the panel does not know yet is still shown, neutral, with its
// raw value: never a blank cell.
import { shellLocale } from '../../shell/i18n';
import en from './locales/en.json';
import es from './locales/es.json';
import type { BusinessStatus, InvoiceStatus, StatusPillSpec, StatusPillTone } from './types';

const CATALOGUES = { en: en.statusPill, es: es.statusPill } as const;

interface StatusLook {
  tone: StatusPillTone;
  busy?: boolean;
}

/** A business (`preparing|ready|past_due|suspended|deleting`), a member and a subscription/module. */
const BUSINESS: Readonly<Record<BusinessStatus, StatusLook>> = {
  ready: { tone: 'success' },
  preparing: { tone: 'info', busy: true },
  past_due: { tone: 'warning' },
  suspended: { tone: 'danger' },
  deleting: { tone: 'danger' },
  pending_invitation: { tone: 'warning' },
  active: { tone: 'success' },
  // Cancelled at the end of the period: it still works until then (the mockups' «Cancelado»).
  cancelled: { tone: 'warning' },
};

/** An invoice of ERPlora to the customer (old SaaS `Invoice.status`, plus «issuing» of the plan). */
const INVOICE: Readonly<Record<InvoiceStatus, StatusLook>> = {
  draft: { tone: 'neutral' },
  pending: { tone: 'warning' },
  issuing: { tone: 'info', busy: true },
  paid: { tone: 'success' },
  failed: { tone: 'danger' },
  refunded: { tone: 'neutral' },
};

export const BUSINESS_STATUSES = Object.freeze(Object.keys(BUSINESS)) as readonly BusinessStatus[];
export const INVOICE_STATUSES = Object.freeze(Object.keys(INVOICE)) as readonly InvoiceStatus[];

function spec<K extends string>(
  looks: Readonly<Record<K, StatusLook>>,
  group: 'business' | 'invoice',
  status: K,
  locale: string | undefined,
): StatusPillSpec {
  if (!Object.hasOwn(looks, status)) return { tone: 'neutral', label: String(status), busy: false };
  const labels: Record<string, string> = CATALOGUES[shellLocale(locale ?? document.documentElement.lang)][group];
  const look = looks[status];
  return { tone: look.tone, label: labels[status], busy: look.busy === true };
}

/** Tone and label of a business, member or subscription status. */
export function businessStatusPill(status: BusinessStatus, locale?: string): StatusPillSpec {
  return spec(BUSINESS, 'business', status, locale);
}

/** Tone and label of an invoice status. */
export function invoiceStatusPill(status: InvoiceStatus, locale?: string): StatusPillSpec {
  return spec(INVOICE, 'invoice', status, locale);
}
