import { describe, expect, it, vi } from 'vitest';

import { installTrustedTypesPolicy } from './trusted-types.boot';

type Rules = {
  createHTML: (s: string) => string;
  createScriptURL: (s: string) => string;
  createScript: (s: string) => string;
};

const fakeWindow = (existing: string[] = []) => {
  const createPolicy = vi.fn((_name: string, rules: Rules) => rules);
  const win = { trustedTypes: { createPolicy, defaultPolicy: existing.includes('default') ? {} : null } };
  return { win: win as unknown as Window, createPolicy };
};

const rulesOf = (createPolicy: ReturnType<typeof fakeWindow>['createPolicy']): Rules =>
  createPolicy.mock.calls[0][1];

describe('installTrustedTypesPolicy', () => {
  it('creates the default policy', () => {
    const { win, createPolicy } = fakeWindow();
    expect(installTrustedTypesPolicy(win, false)).toBe(true);
    expect(createPolicy).toHaveBeenCalledWith('default', expect.any(Object));
  });

  it('in production only lets <svg ...> markup through (icons)', () => {
    const { win, createPolicy } = fakeWindow();
    installTrustedTypesPolicy(win, false);
    const { createHTML } = rulesOf(createPolicy);
    expect(createHTML('  <svg viewBox="0 0 1 1"></svg>')).toContain('<svg');
    expect(() => createHTML('<img src=x onerror=alert(1)>')).toThrow();
    expect(() => createHTML('<script>alert(1)</script>')).toThrow();
  });

  it('in dev passes any HTML through', () => {
    const { win, createPolicy } = fakeWindow();
    installTrustedTypesPolicy(win, true);
    expect(rulesOf(createPolicy).createHTML('<b>x</b>')).toBe('<b>x</b>');
  });

  it('always rejects script URLs and scripts', () => {
    for (const dev of [true, false]) {
      const { win, createPolicy } = fakeWindow();
      installTrustedTypesPolicy(win, dev);
      const rules = rulesOf(createPolicy);
      expect(() => rules.createScriptURL('https://evil.example/x.js')).toThrow();
      expect(() => rules.createScript('alert(1)')).toThrow();
    }
  });

  it('does nothing when the browser has no Trusted Types', () => {
    expect(installTrustedTypesPolicy({} as unknown as Window, false)).toBe(false);
  });

  it('does nothing when a default policy already exists', () => {
    const { win, createPolicy } = fakeWindow(['default']);
    expect(installTrustedTypesPolicy(win, false)).toBe(false);
    expect(createPolicy).not.toHaveBeenCalled();
  });

  it('survives createPolicy throwing (duplicate policy under a strict CSP allow-list)', () => {
    const win = {
      trustedTypes: {
        createPolicy: () => {
          throw new TypeError('dup');
        },
      },
    } as unknown as Window;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(installTrustedTypesPolicy(win, false)).toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
