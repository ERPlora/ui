import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, reactive } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import { ionIconSrc } from '../../shell/icons';
import { DATA_TABLE_ICONS } from './model';
import type { DataTableLabels } from './types';
import { usePartChrome } from './usePartChrome';

/** A part of the table, mounted with the shell's i18n, handing back what `usePartChrome` gave it. */
function partWith(props: { labels?: Partial<DataTableLabels>; testid?: string }, locale: 'en' | 'es' = 'en') {
  let chrome!: ReturnType<typeof usePartChrome>;
  const Part = defineComponent({
    setup() {
      chrome = usePartChrome(props);
      return () => null;
    },
  });
  mount(Part, { global: { plugins: [createShellI18n({ locale })] } });
  return chrome;
}

describe('usePartChrome', () => {
  it('names a test hook under the table’s prefix, and none without one', () => {
    expect(partWith({ testid: 'rules' }).tid('filters-apply')).toBe('rules-filters-apply');
    expect(partWith({}).tid('filters-apply')).toBeUndefined();
  });

  it('says the chrome’s texts in the page’s language, the table’s own `labels` first, and follows them', async () => {
    expect(partWith({}, 'es').label('apply')).toBe('Aplicar');
    const props = reactive<{ labels?: Partial<DataTableLabels> }>({ labels: { apply: 'Show results' } });
    const { label } = partWith(props);
    expect(label('apply')).toBe('Show results');
    props.labels = undefined;
    expect(label('apply')).toBe('Apply');
  });

  it('paints the table’s own icons, baked into the shell', () => {
    const { ICONS, icon } = partWith({});
    expect(ICONS).toBe(DATA_TABLE_ICONS);
    expect(icon).toBe(ionIconSrc);
  });
});
