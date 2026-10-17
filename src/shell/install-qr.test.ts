import { describe, expect, it } from 'vitest';

import { installQrUrl } from './install-qr';

// hub#1715: the sidebar QR carries this hub to a phone. A wrong address still paints a perfectly
// scannable code, so the rule lives here, with tests.
describe('installQrUrl', () => {
  it('is the hub itself: its origin with the trailing slash, whatever screen the shell is on', () => {
    expect(installQrUrl({ origin: 'https://acme.erplora.com' })).toBe('https://acme.erplora.com/');
  });

  it('drops the path, the query and the hash (the installed app sits on `/?shell=1`)', () => {
    const location = { origin: 'https://acme.erplora.com', href: 'https://acme.erplora.com/demo/items?shell=1#x' };
    expect(installQrUrl(location)).toBe('https://acme.erplora.com/');
  });

  it('lowercases the host, as a phone types it', () => {
    expect(installQrUrl({ origin: 'https://ACME.Erplora.com' })).toBe('https://acme.erplora.com/');
  });

  it('keeps the port and the scheme of a local hub (development, http on loopback)', () => {
    expect(installQrUrl({ origin: 'http://a.localhost:8000' })).toBe('http://a.localhost:8000/');
  });
});
