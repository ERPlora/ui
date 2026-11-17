import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import CollapsibleChecklist from './CollapsibleChecklist.vue';
import * as entry from './index';

const SFC = join(dirname(fileURLToPath(import.meta.url)), 'CollapsibleChecklist.vue');
const source = readFileSync(SFC, 'utf8');

const ITEMS = Array.from({ length: 7 }, (_, index) => ({ text: `Detail ${index + 1}`, testid: `detail-${index + 1}` }));

function checklist(extra: Record<string, unknown> = {}) {
  return mount(CollapsibleChecklist, {
    props: { items: ITEMS, showAllLabel: 'All details', showFewerLabel: 'Less detail', toggleTestid: 'details-toggle', ...extra },
    attachTo: document.body,
  });
}

describe('CollapsibleChecklist', () => {
  it('shows five items by default and expands with an Ionic disclosure button', async () => {
    const wrapper = checklist();
    const toggle = wrapper.get('[data-testid="details-toggle"]');
    const native = () => toggle.element.shadowRoot?.querySelector('button');
    await vi.waitFor(() => expect(native()?.getAttribute('aria-expanded')).toBe('false'));
    expect(wrapper.findAll('ion-item')).toHaveLength(5);
    expect(wrapper.get('[data-testid="detail-1"]').text()).toBe('Detail 1');
    expect(toggle.element.tagName).toBe('ION-BUTTON');
    expect(toggle.attributes('fill')).toBe('clear');
    expect(toggle.attributes('size')).toBe('small');
    expect(toggle.attributes('aria-expanded')).toBeUndefined();
    expect(native()?.getAttribute('aria-controls')).toBeNull();
    expect(toggle.get('ion-icon').attributes('slot')).toBe('start');

    await toggle.trigger('click');
    await vi.waitFor(() => expect(native()?.getAttribute('aria-expanded')).toBe('true'));
    expect(wrapper.findAll('ion-item')).toHaveLength(7);
    expect(toggle.text()).toBe('Less detail');

    await toggle.trigger('click');
    await vi.waitFor(() => expect(native()?.getAttribute('aria-expanded')).toBe('false'));
    expect(wrapper.findAll('ion-item')).toHaveLength(5);
    expect(wrapper.text()).not.toContain('Detail 6');
  });

  it('accepts a different collapsed count and caller-provided labels', async () => {
    const wrapper = checklist({
      items: ITEMS.slice(0, 3).map(({ text }) => ({ text })),
      collapsedCount: 2,
      showAllLabel: 'Mostrar todo',
      showFewerLabel: 'Mostrar menos',
    });
    expect(wrapper.findAll('ion-item')).toHaveLength(2);
    expect(wrapper.get('ion-item').attributes('data-testid')).toBeUndefined();
    const toggle = wrapper.get('[data-testid="details-toggle"]');
    expect(toggle.text()).toBe('Mostrar todo');
    await toggle.trigger('click');
    expect(wrapper.findAll('ion-item')).toHaveLength(3);
    expect(toggle.text()).toBe('Mostrar menos');
  });

  it('omits the disclosure when every item fits', () => {
    const wrapper = checklist({ items: ITEMS.slice(0, 5) });
    expect(wrapper.findAll('ion-item')).toHaveLength(5);
    expect(wrapper.find('[data-testid="details-toggle"]').exists()).toBe(false);
  });

  it('keeps its touch target at least 44 px and owns no parent grid placement', () => {
    expect(source).not.toMatch(/grid-row/);
    expect(source).toMatch(/@media \(max-width: 640px\), \(pointer: coarse\)/);
    expect(source).toMatch(/min-block-size: 44px/);
  });

  it('is exported from its folder, from the components barrel and from the package root', () => {
    expect(entry.CollapsibleChecklist).toBe(CollapsibleChecklist);
    expect(components.CollapsibleChecklist).toBe(CollapsibleChecklist);
    expect(root.CollapsibleChecklist).toBe(CollapsibleChecklist);
  });
});
