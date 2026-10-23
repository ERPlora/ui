import { describe, expect, it, vi } from 'vitest';

import { ION_ICONS, ionIconSrc, resolveIcon } from '../icons';
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

  // ionicons resolves an icon data URL with `DOMParser.parseFromString(url, 'text/html')`, a Trusted
  // Types sink: the policy sees the whole `data:image/svg+xml;utf8,<svg …>` string, not just the SVG.
  it('in production lets the icon data URLs through: Ionicons, the other baked sets and inline SVG', () => {
    const { win, createPolicy } = fakeWindow();
    installTrustedTypesPolicy(win, false);
    const { createHTML } = rulesOf(createPolicy);
    for (const url of [
      ION_ICONS.add,
      ION_ICONS['cart-outline'],
      resolveIcon('lucide:lock'),
      resolveIcon('mdi:cart'),
      resolveIcon('material-symbols:point-of-sale'),
      ionIconSrc('<svg viewBox="0 0 1 1"></svg>'),
    ]) {
      expect(url).toBeDefined();
      expect(createHTML(url as string)).toBe(url);
    }
  });

  it('in production rejects data URLs that are not an SVG image starting with <svg', () => {
    const { win, createPolicy } = fakeWindow();
    installTrustedTypesPolicy(win, false);
    const { createHTML } = rulesOf(createPolicy);
    for (const html of [
      'data:image/svg+xml;utf8,<img src=x onerror=alert(1)>',
      'data:image/svg+xml;utf8,<svgx onload=alert(1)>',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:text/html,<svg>',
      'data:text/html;utf8,<svg></svg>',
      'x data:image/svg+xml;utf8,<svg></svg>',
      '<svgx onload=alert(1)>',
      '<div>',
    ]) {
      expect(() => createHTML(html), html).toThrow(TypeError);
    }
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

  // Stripe.js (the SaaS's Embedded Checkout) sets script `src` strings for its own chunks
  // (`…/v3/fingerprinted/js/embedded-checkout-outer-*.js`, `…/trusted-types-checker-*.js`) without a
  // policy of its own, so they reach the `default` policy: the shell admits the origins it is given.
  it('admits a script URL only when its origin is exactly one of the allowlist, in dev and in production', () => {
    for (const dev of [true, false]) {
      const { win, createPolicy } = fakeWindow();
      installTrustedTypesPolicy(win, dev, ['https://js.stripe.com']);
      const { createScriptURL } = rulesOf(createPolicy);
      for (const url of [
        'https://js.stripe.com/v3/fingerprinted/js/x.js',
        'https://js.stripe.com/v3/',
        'https://js.stripe.com:443/v3/fingerprinted/js/trusted-types-checker-1a2b.js',
      ]) {
        expect(createScriptURL(url), url).toBe(url);
      }
      for (const url of [
        'https://js.stripe.com.evil.com/x.js',
        'http://js.stripe.com/x',
        'https://evil.com/js.stripe.com',
        'https://sub.js.stripe.com/x.js',
        'https://js.stripe.com:8443/x.js',
        'https://user:secret@js.stripe.com/x.js',
        'https://user@js.stripe.com/x.js',
        '//js.stripe.com/x.js',
        '/static/x.js',
        'javascript:alert(1)',
        'data:text/javascript,alert(1)',
        '',
      ]) {
        expect(() => createScriptURL(url), url).toThrow(TypeError);
      }
    }
  });

  // reCAPTCHA Enterprise (the SaaS's public doors): its loader `https://www.google.com/recaptcha/enterprise.js` sets its
  // release from `https://www.gstatic.com/recaptcha/releases/…` as a plain string. An entry with a path admits that
  // path and below only, not the rest of the origin.
  it('admits a script URL under an entry with a path, and nothing else of that origin', () => {
    const { win, createPolicy } = fakeWindow();
    installTrustedTypesPolicy(win, false, ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/']);
    const { createScriptURL } = rulesOf(createPolicy);
    for (const url of [
      'https://www.google.com/recaptcha/enterprise.js?render=6Le-site-key',
      'https://www.gstatic.com/recaptcha/releases/NhfdZHzre16wrc2m6BxEdu7J/recaptcha__en.js',
      'https://www.gstatic.com:443/recaptcha/releases/x/recaptcha__es.js',
    ]) {
      expect(createScriptURL(url), url).toBe(url);
    }
    for (const url of [
      'https://www.google.com/maps/api/js',
      'https://www.google.com/recaptcha',
      'https://www.google.com/recaptchaevil/x.js',
      'https://www.google.com/recaptcha/../evil.js',
      'https://www.google.com/recaptcha/%2e%2e/evil.js',
      'https://www.google.com/recaptcha%2F..%2Fevil.js',
      'https://www.gstatic.com/firebasejs/x.js',
      'https://user@www.google.com/recaptcha/enterprise.js',
      'http://www.google.com/recaptcha/enterprise.js',
      'https://www.google.com.evil.com/recaptcha/enterprise.js',
    ]) {
      expect(() => createScriptURL(url), url).toThrow(TypeError);
    }
  });

  it('mixes bare origins and entries with a path', () => {
    const { win, createPolicy } = fakeWindow();
    installTrustedTypesPolicy(win, false, ['https://js.stripe.com', 'https://www.google.com/recaptcha/']);
    const { createScriptURL } = rulesOf(createPolicy);
    expect(createScriptURL('https://js.stripe.com/v3/')).toBe('https://js.stripe.com/v3/');
    expect(createScriptURL('https://www.google.com/recaptcha/enterprise.js')).toBe('https://www.google.com/recaptcha/enterprise.js');
    expect(() => createScriptURL('https://www.google.com/x.js')).toThrow(TypeError);
  });

  it('with an allowlist still rejects scripts and any HTML that is not an icon', () => {
    const { win, createPolicy } = fakeWindow();
    installTrustedTypesPolicy(win, false, ['https://js.stripe.com']);
    const rules = rulesOf(createPolicy);
    expect(() => rules.createScript('alert(1)')).toThrow(TypeError);
    expect(() => rules.createHTML('<script src="https://js.stripe.com/v3/"></script>')).toThrow(TypeError);
  });

  it('keeps its own copy of the allowlist: changing the array later widens nothing', () => {
    const { win, createPolicy } = fakeWindow();
    const origins = ['https://js.stripe.com'];
    installTrustedTypesPolicy(win, false, origins);
    origins.push('https://evil.com');
    expect(() => rulesOf(createPolicy).createScriptURL('https://evil.com/x.js')).toThrow(TypeError);
  });

  it('refuses an allowlist entry that is neither a bare https origin nor one with a path ending in /, before creating any policy', () => {
    for (const origin of [
      'http://js.stripe.com',
      'https://js.stripe.com/',
      'https://js.stripe.com/v3',
      'https://*.js.stripe.com',
      'https://user@js.stripe.com',
      'js.stripe.com',
      '*',
      '',
      'http://www.google.com/recaptcha/',
      'https://www.google.com/recaptcha/../',
      'https://www.google.com/recaptcha/?x=1',
      'https://www.google.com/recaptcha/#x',
      'https://www.google.com/*/',
      'https://user@www.google.com/recaptcha/',
      'https://www.google.com/re%63aptcha/x/../',
    ]) {
      const { win, createPolicy } = fakeWindow();
      expect(() => installTrustedTypesPolicy(win, false, [origin]), origin).toThrow(TypeError);
      expect(createPolicy, origin).not.toHaveBeenCalled();
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
