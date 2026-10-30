// What guides the person in the panel: the sentence of each failure and its way out (BASE-G124, G122), the footer of
// the allowance (BASE-G122; gh:hub#1183) and the names of the screens an answer leads to (BASE-G114). The setup's
// shortcuts (BASE-G121) are the Hub's own (its empty conversation).
import { describe, expect, it } from 'vitest';

import type { SessionMenuSection } from '../../shell/session';
import { errorView, screenLabel, usageNote } from './guide';

describe('errorView', () => {
  it('no connection and a service down are told apart, both with «Try again»', () => {
    expect(errorView('assistant.unreachable')).toEqual({ key: 'assistant.errors.unreachable', recovery: 'retry' });
    expect(errorView('assistant.unavailable')).toEqual({ key: 'assistant.errors.unavailable', recovery: 'retry' });
    expect(errorView('assistant.provider_failed')).toEqual({ key: 'assistant.errors.unavailable', recovery: 'retry' });
  });

  it('a spent allowance is no breakdown: it says the numbers and leads to the plan', () => {
    const view = errorView('assistant.quota_exceeded', { used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z' });
    expect(view).toMatchObject({ key: 'assistant.errors.quotaSpent', recovery: 'upgrade' });
    expect(view.values).toMatchObject({ used: 30, limit: 30 });
  });

  it('a plan without the assistant says so', () => {
    expect(errorView('assistant.quota_exceeded', { used: 0, limit: 0 })).toMatchObject({
      key: 'assistant.errors.noPlan',
      recovery: 'upgrade',
    });
  });

  it('a session gone leads to sign in again; a conversation too long, to a new one', () => {
    expect(errorView('unauthorized').recovery).toBe('signin');
    expect(errorView('assistant.too_large').recovery).toBe('new');
    expect(errorView('payload_too_large').recovery).toBe('new');
  });

  it('a loop cut and the frequency limit say what to do', () => {
    expect(errorView('assistant.too_many_steps')).toEqual({ key: 'assistant.errors.tooManySteps', recovery: 'none' });
    expect(errorView('assistant.rate_limited', { retry_after: 40 })).toEqual({
      key: 'assistant.errors.rateLimited',
      values: { seconds: 40 },
      recovery: 'retry',
    });
  });

  it('an answer cut half way keeps what was said and offers to try again', () => {
    expect(errorView('assistant.cut')).toEqual({ key: 'assistant.errors.cut', recovery: 'retry' });
  });

  it('what it does not know is the service down, never silence', () => {
    expect(errorView('something_else')).toEqual({ key: 'assistant.errors.unavailable', recovery: 'retry' });
  });
});

describe('usageNote', () => {
  it('nothing below 80 %', () => {
    expect(usageNote({ used: 23, limit: 30, resets_at: null, demo: false })).toBeNull();
  });

  it('from 80 %: what is left of how many', () => {
    expect(usageNote({ used: 24, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false })).toEqual({
      left: 6,
      limit: 30,
      resetsAt: '2026-11-01T00:00:00Z',
    });
  });

  it('a plan without the assistant, or nothing read, says nothing here', () => {
    expect(usageNote({ used: 0, limit: 0, resets_at: null, demo: false })).toBeNull();
    expect(usageNote(undefined)).toBeNull();
  });
});

describe('screenLabel', () => {
  const menu: SessionMenuSection[] = [
    {
      id: 'customer',
      label: 'Clientes',
      items: [
        { path: '/customer/customers', label: 'Clientes', icon: 'ion:people' },
        { path: '/customer/groups', label: 'Grupos', icon: 'ion:people' },
      ],
    },
  ];
  const t = (key: string) => `«${key}»`;
  /** The host's platform screens, by the key of their name in its catalogue. */
  const platform = (path: string) => (path === '/settings' ? 'host.screens.settings' : null);

  it("a screen of the host's platform by the name its catalogue gives it, with or without its section", () => {
    expect(screenLabel('/settings', menu, t, platform)).toBe('«host.screens.settings»');
    expect(screenLabel('/settings#business', menu, t, platform)).toBe('«host.screens.settings»');
    expect(screenLabel('/settings/', menu, t, platform)).toBe('«host.screens.settings»');
  });

  it("without the host's platform screens, only the menu names a path", () => {
    expect(screenLabel('/settings', menu, t)).toBeUndefined();
    expect(screenLabel('/customer/groups', menu, t)).toBe('Clientes › Grupos');
  });

  it('an app by its name, and a tab as «App › Tab»', () => {
    expect(screenLabel('/customer/customers', menu, t)).toBe('Clientes');
    expect(screenLabel('/customer/groups', menu, t)).toBe('Clientes › Grupos');
    expect(screenLabel('/customer/customers/0193e1c2', menu, t)).toBe('Clientes');
  });

  it('a path no menu names has no name', () => {
    expect(screenLabel('/reports', menu, t)).toBeUndefined();
  });
});
