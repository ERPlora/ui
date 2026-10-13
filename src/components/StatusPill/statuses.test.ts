// The statuses of the SaaS panel, each with its tone and its label (en + es), so every page paints a
// status the same way: `<StatusPill v-bind="businessStatusPill(row.status)" />`. Tones follow the
// mockups (`mockups/saas-panel/`): ready/active → success, preparing → info and busy, past due,
// pending invitation and cancelled-at-period-end → warning, suspended/being deleted → danger.
import { afterEach, describe, expect, it } from 'vitest';

import en from './locales/en.json';
import es from './locales/es.json';
import { BUSINESS_STATUSES, businessStatusPill, INVOICE_STATUSES, invoiceStatusPill } from './statuses';

afterEach(() => {
  document.documentElement.lang = '';
});

describe('businessStatusPill', () => {
  it.each([
    ['ready', 'success', 'Active', 'Activo'],
    ['preparing', 'info', 'Preparing', 'Preparando'],
    ['past_due', 'warning', 'Payment due', 'Pago pendiente'],
    ['suspended', 'danger', 'Suspended', 'Suspendido'],
    ['deleting', 'danger', 'Being deleted', 'En eliminación'],
    ['pending_invitation', 'warning', 'Pending', 'Pendiente'],
    ['active', 'success', 'Active', 'Activo'],
    ['cancelled', 'warning', 'Cancelled', 'Cancelado'],
  ] as const)('%s → %s, «%s» / «%s»', (status, tone, labelEn, labelEs) => {
    expect(businessStatusPill(status, 'en')).toMatchObject({ tone, label: labelEn });
    expect(businessStatusPill(status, 'es')).toMatchObject({ tone, label: labelEs });
  });

  it('only «preparing» is busy (its dot pulses while the business database is cloned)', () => {
    for (const status of BUSINESS_STATUSES) {
      expect(businessStatusPill(status, 'en').busy, status).toBe(status === 'preparing');
    }
  });

  it('reads the language of the page (`<html lang>`, which the shell keeps in step) when none is given', () => {
    document.documentElement.lang = 'es-ES';
    expect(businessStatusPill('suspended').label).toBe('Suspendido');
    document.documentElement.lang = 'en';
    expect(businessStatusPill('suspended').label).toBe('Suspended');
  });

  it('an unsupported language falls back to English', () => {
    expect(businessStatusPill('ready', 'fr').label).toBe('Active');
  });

  it('a status the panel does not know yet is still shown, neutral, with its raw value (never a blank cell)', () => {
    expect(businessStatusPill('archived' as never, 'en')).toEqual({ tone: 'neutral', label: 'archived', busy: false });
  });
});

describe('invoiceStatusPill', () => {
  it.each([
    ['draft', 'neutral', 'Draft', 'Borrador'],
    ['pending', 'warning', 'Pending', 'Pendiente'],
    ['issuing', 'info', 'Issuing', 'Emitiéndose'],
    ['paid', 'success', 'Paid', 'Pagada'],
    ['failed', 'danger', 'Not collected', 'No cobrada'],
    ['refunded', 'neutral', 'Refunded', 'Reembolsada'],
  ] as const)('%s → %s, «%s» / «%s»', (status, tone, labelEn, labelEs) => {
    expect(invoiceStatusPill(status, 'en')).toMatchObject({ tone, label: labelEn });
    expect(invoiceStatusPill(status, 'es')).toMatchObject({ tone, label: labelEs });
  });

  it('only «issuing» is busy (the fiscal record is on its way)', () => {
    for (const status of INVOICE_STATUSES) expect(invoiceStatusPill(status, 'en').busy, status).toBe(status === 'issuing');
  });

  it('an unknown invoice status is shown neutral with its raw value', () => {
    expect(invoiceStatusPill('void' as never, 'es')).toEqual({ tone: 'neutral', label: 'void', busy: false });
  });
});

describe('status catalogues', () => {
  it('en and es label exactly the same statuses, the ones the helpers map', () => {
    expect(Object.keys(en.statusPill.business).sort()).toEqual([...BUSINESS_STATUSES].sort());
    expect(Object.keys(es.statusPill.business).sort()).toEqual([...BUSINESS_STATUSES].sort());
    expect(Object.keys(en.statusPill.invoice).sort()).toEqual([...INVOICE_STATUSES].sort());
    expect(Object.keys(es.statusPill.invoice).sort()).toEqual([...INVOICE_STATUSES].sort());
  });
});
