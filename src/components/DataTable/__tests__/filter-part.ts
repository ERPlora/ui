// Mounts a part of the table that paints its column filters (its filter row, its filters panel) the way the table
// does: with the table's one state of its filter controls, built from the `filterErrors` and `labels` of a
// reactive state the test may change.
import { mount } from '@vue/test-utils';
import { type Component, defineComponent, h, reactive } from 'vue';

import { createShellI18n } from '../../../shell/i18n';
import { useDataTableLabels } from '../labels';
import type { DataTableLabels } from '../types';
import { type FilterControls, useFilterControls } from '../useFilterControls';

type Row = Record<string, unknown>;

interface PartState {
  filterErrors?: Record<string, string>;
  labels?: Partial<DataTableLabels>;
}

export function mountFilterPart<S extends PartState>(
  part: Component,
  initial: S,
  partProps: (state: S, controls: FilterControls<Row>) => Record<string, unknown>,
  locale: 'en' | 'es' = 'en',
) {
  const state = reactive(initial) as S;
  const Host = defineComponent({
    setup() {
      const { text: label } = useDataTableLabels(() => state.labels);
      const controls = useFilterControls<Row>({ filterErrors: () => state.filterErrors, label });
      return () => h(part, partProps(state, controls));
    },
  });
  const wrapper = mount(Host, { global: { plugins: [createShellI18n({ locale })] }, attachTo: document.body });
  return { wrapper, props: state };
}
