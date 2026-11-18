import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import AlignedCardGrid from './AlignedCardGrid.vue';
import * as entry from './index';

const SFC = join(dirname(fileURLToPath(import.meta.url)), 'AlignedCardGrid.vue');
const style = readFileSync(SFC, 'utf8').match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '';

describe('AlignedCardGrid', () => {
  it('renders slotted cards and the row track class chosen by the caller', () => {
    const wrapper = mount(AlignedCardGrid, {
      props: { rows: 7 },
      attrs: { 'data-testid': 'cards' },
      slots: { default: '<article>One</article><article>Two</article>' },
    });
    expect(wrapper.classes()).toContain('aligned-card-grid');
    expect(wrapper.classes()).toContain('aligned-card-grid--rows-7');
    expect(wrapper.attributes('data-testid')).toBe('cards');
    expect(wrapper.findAll('article')).toHaveLength(2);
  });

  it('uses one shared track by default', () => {
    expect(mount(AlignedCardGrid).classes()).toContain('aligned-card-grid--rows-1');
  });

  it('lays out equal columns, shared row spans and a centred odd card on two columns', () => {
    expect(style).toMatch(/grid-template-columns: minmax\(0, 1fr\)/);
    expect(style).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(style).toMatch(/grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(style).toMatch(/grid-row: span var\(--aligned-card-grid-rows\)/);
    expect(style).toMatch(/:last-child:nth-child\(odd\)/);
    expect(style).toMatch(/justify-self: center/);
    expect(style).toMatch(/max-inline-size: 1120px/);
  });

  it('has no domain-specific content or styling', () => {
    expect(style).not.toMatch(/plan|billing/i);
    expect(style).not.toMatch(/--ok-/);
  });

  it('is exported from its folder, from the components barrel and from the package root', () => {
    expect(entry.AlignedCardGrid).toBe(AlignedCardGrid);
    expect(components.AlignedCardGrid).toBe(AlignedCardGrid);
    expect(root.AlignedCardGrid).toBe(AlignedCardGrid);
  });
});
