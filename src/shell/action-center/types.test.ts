// Compile-time contract of the action center's data (checked by `vue-tsc`, run by `typecheck`).
// The runtime assertions only keep vitest from reporting an empty file.
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ref } from 'vue';

import type { ActionNotice, ActionNoticeSource, NoticeAction, NoticeDestination, NoticeSeverity } from './types';

describe('action center types', () => {
  it('an action goes to a page, opens a link or runs something', () => {
    const actions: NoticeAction[] = [
      { label: 'Pay the invoice', to: '/billing' },
      { label: 'Read more', href: 'https://erplora.com/help' },
      { label: 'Retry', run: () => Promise.resolve() },
      { label: 'Reconnect', run: () => undefined },
    ];
    expect(actions).toHaveLength(4);
  });

  it('an action does exactly one of them', () => {
    // @ts-expect-error: a page and a link at once
    const pageAndLink: NoticeAction = { label: 'Pay', to: '/billing', href: 'https://erplora.com' };
    // @ts-expect-error: a page and something to run at once
    const pageAndRun: NoticeAction = { label: 'Pay', to: '/billing', run: () => undefined };
    // @ts-expect-error: a link and something to run at once
    const linkAndRun: NoticeAction = { label: 'Pay', href: 'https://erplora.com', run: () => undefined };
    // @ts-expect-error: nothing to do
    const nothing: NoticeAction = { label: 'Pay' };
    expect([pageAndLink, pageAndRun, linkAndRun, nothing]).toHaveLength(4);
  });

  it('a notice needs only its id, severity, icon and texts; the rest is optional', () => {
    const bare: ActionNotice = {
      id: 'base.blocking',
      severity: 'danger',
      icon: 'ion:lock-closed-outline',
      label: 'You cannot sell',
      title: 'The business is suspended',
    };
    const full: ActionNotice = {
      ...bare,
      id: 'billing.unpaid:hub-1',
      body: 'Pay before 20 Nov or the business is suspended.',
      figure: '29,00 €',
      chip: '3 days left',
      count: 2,
      due: { at: '2026-11-20T00:00:00Z', from: '2026-11-13T00:00:00Z' },
      action: { label: 'Pay the invoice', to: '/billing' },
      secondary: { label: 'Change card', href: 'https://erplora.com/billing/card' },
    };
    expectTypeOf(bare.severity).toEqualTypeOf<NoticeSeverity>();
    expectTypeOf<NoticeSeverity>().toEqualTypeOf<'danger' | 'warning' | 'info'>();
    expect(full.due?.from).toBe('2026-11-13T00:00:00Z');
  });

  it('a source gives the notices, undefined while loading, and whether it failed', () => {
    const source: ActionNoticeSource = { notices: ref<readonly ActionNotice[] | undefined>(), failed: ref(false) };
    expectTypeOf(source.retry).toEqualTypeOf<(() => void) | undefined>();
    expect(source.notices.value).toBeUndefined();
  });

  it('where an action leads is a page or a link', () => {
    expectTypeOf<NoticeDestination>().toEqualTypeOf<{ readonly to: string } | { readonly href: string }>();
    const destination: NoticeDestination = { to: '/billing' };
    expect(destination).toEqual({ to: '/billing' });
  });
});
