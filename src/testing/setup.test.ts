// What `vitest.setup.ts` gives every test file of this package, so a new test has nothing to remember:
// an `ion-icon` paints by name, as the shell makes it paint at boot, without the warning whose dump
// (the whole element, by the thousand lines) buries a real failure in the log of the run. This file
// registers nothing on purpose.
import { IonIcon } from '@ionic/vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ION_ICONS } from '../shell/icons';

describe('a test file of this package, before it does anything', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('has every shell icon registered, as `createShell` leaves them at boot', () => {
    const registry = (window as unknown as { Ionicons?: { map?: Map<string, string> } }).Ionicons?.map;
    expect(Object.fromEntries(registry ?? [])).toEqual(ION_ICONS);
  });

  it('paints an `ion-icon` by name without logging the warning that floods a test run', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const icon = mount(IonIcon, { props: { name: 'close-circle-outline' }, attachTo: document.body });
    await vi.waitFor(() => expect(icon.element.shadowRoot?.querySelector('svg')).not.toBeNull());
    expect(warn.mock.calls.filter(([message]) => String(message).includes('Could not load icon'))).toEqual([]);
    icon.unmount();
  });
});
