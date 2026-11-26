import { afterEach, describe, expect, it, vi } from 'vitest';

import { byTestId, mountModal, settle, unmountModals } from './__tests__/form-modal';

vi.mock('@ionic/vue', async (importOriginal) => (await import('./__tests__/ionModalStub')).ionicVueWithModalStub(importOriginal));

afterEach(unmountModals);

const HINT = 'Enter the name to continue.';

describe('FormModal: what is missing while Save is off', () => {
  it('says it next to the buttons, as a status a screen reader announces', async () => {
    mountModal({ testid: 'invite', submitDisabled: true, submitHint: HINT });
    await settle();
    const hint = byTestId('invite-hint');
    expect(hint?.textContent?.trim()).toBe(HINT);
    expect(hint?.getAttribute('role')).toBe('status');
    expect(hint?.closest('.ep-form-modal__footer')).not.toBeNull();
  });

  it('says nothing once Save is on, without a hint, or in a read-only dialog', async () => {
    mountModal({ testid: 'on', submitDisabled: false, submitHint: HINT });
    mountModal({ testid: 'empty', submitDisabled: true, submitHint: '' });
    const readonly = mountModal({ testid: 'readonly', readonly: true, submitDisabled: true, submitHint: HINT });
    await settle();
    expect(byTestId('on-hint')).toBeNull();
    expect(byTestId('empty-hint')).toBeNull();
    expect(byTestId('readonly-hint')).toBeNull();
    expect(readonly.find('.ep-form-modal__hint').exists()).toBe(false);
  });

  it('follows the form: it changes and goes as the page fills it in', async () => {
    const wrapper = mountModal({ testid: 'invite', submitDisabled: true, submitHint: HINT });
    await settle();
    await wrapper.setProps({ submitHint: 'Choose the tax category to continue.' });
    await settle();
    expect(byTestId('invite-hint')?.textContent?.trim()).toBe('Choose the tax category to continue.');
    await wrapper.setProps({ submitDisabled: false, submitHint: '' });
    await settle();
    expect(byTestId('invite-hint')).toBeNull();
  });
});
