import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { unnamedButtons, unnamedIcons } from '../../testing/a11y';
import HubIcon from '../HubIcon.vue';
import ActionRow from './ActionRow.vue';
import type { ActionNotice } from './types';

const notice: ActionNotice = {
  id: 'printer',
  severity: 'warning',
  icon: 'ion:cloud-offline-outline',
  label: 'Printer offline',
  title: 'The kitchen printer is offline',
  chip: 'Offline',
};

function mountRow(resolved = false) {
  return mount(ActionRow, { props: { notice, resolved } });
}

describe('ActionRow', () => {
  it('is a compact Ionic item with the notice icon, label, chip and detail arrow', () => {
    const row = mountRow().get('[data-testid="action-row"]');
    expect(row.element.tagName).toBe('ION-ITEM');
    expect(row.attributes('data-severity')).toBe('warning');
    expect(row.findAllComponents(HubIcon)[0]?.props('name')).toBe('ion:cloud-offline-outline');
    expect(row.get('strong').text()).toBe('Printer offline');
    expect(row.get('ion-chip').text()).toBe('Offline');
    expect((row.element as HTMLElement & { detail?: boolean }).detail).toBe(true);
    expect(unnamedButtons(row.element)).toEqual([]);
    expect(unnamedIcons(row.element)).toEqual([]);
  });

  it('asks to feature its notice when pressed', async () => {
    const wrapper = mountRow();
    await wrapper.get('[data-testid="action-row"]').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['printer']]);
  });

  it('marks a resolved row with a check instead of the detail arrow', () => {
    const row = mountRow(true).get('[data-testid="action-row"]');
    expect(row.attributes('data-resolved')).toBe('true');
    expect((row.element as HTMLElement & { detail?: boolean }).detail).toBe(false);
    expect(row.findAllComponents(HubIcon)[1]?.props('name')).toBe('ion:checkmark-circle');
  });
});
