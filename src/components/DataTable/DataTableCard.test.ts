import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataTableCard from './DataTableCard.vue';
import source from './DataTableCard.vue?raw';
import identitySource from './DataTableIdentity.vue?raw';

const row = { id: '1', name: 'Invoicing', total: '10,00 €' };
const actions = { items: [], menu: [] };

function mountCard(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(DataTableCard, {
    props: {
      row,
      rowId: '1',
      title: 'Invoicing',
      fields: [{ key: 'total', label: 'Total' }],
      actions,
      testid: 'apps',
      ...props,
    },
    slots,
  });
}

describe('DataTableCard', () => {
  it('paints an Ionic card with its heading, metadata and test hooks', () => {
    const wrapper = mountCard({ icon: 'document-text-outline' });
    expect(wrapper.find('ion-card.data-table__card').exists()).toBe(true);
    expect(wrapper.find('.data-table__card-title').text()).toBe('Invoicing');
    expect(wrapper.find('.data-table__card-meta-label').text()).toBe('Total');
    expect(wrapper.find('.data-table__card-meta-value').text()).toBe('10,00 €');
    expect(wrapper.find('ion-card').attributes('data-testid')).toBe('apps-row');
    expect(wrapper.find('ion-card').attributes('data-id')).toBe('1');
  });

  it('uses the title column cell slot without repeating it in the body', () => {
    const wrapper = mountCard(
      { titleColumn: { key: 'name', label: 'App', cell: 'app' }, fields: [] },
      { app: '<template #app="{ row }"><strong class="custom-title">{{ row.name }}</strong></template>' },
    );
    expect(wrapper.find('.data-table__card-title .custom-title').text()).toBe('Invoicing');
    expect(wrapper.findAll('.data-table__field')).toHaveLength(0);
  });

  it('emits opening, selection and keyboard activation from the same card', async () => {
    const wrapper = mountCard({ clickable: true, selectable: true });
    await wrapper.find('ion-card').trigger('click');
    await wrapper.find('ion-card').trigger('keydown', { key: 'Enter' });
    await wrapper.find('ion-checkbox').trigger('ionChange', { checked: true });
    expect(wrapper.emitted('open')).toEqual([[row], [row]]);
    expect(wrapper.emitted('select')).toEqual([['1']]);
    expect(wrapper.find('ion-card').attributes('role')).toBe('button');
    expect(wrapper.find('ion-card').attributes('tabindex')).toBe('0');
  });
});


describe('the default clear card body', () => {
  it('paints status, a full-width description and discreet metadata, omitting empty values', () => {
    const wrapper = mountCard({
      row: { id: '1', name: 'Invoicing', state: 'Active', summary: 'Issue invoices.', category: 'Finance', requires: '—' },
      fields: [
        { key: 'state', label: 'Status' },
        { key: 'summary', label: 'Description' },
        { key: 'category', label: 'Category' },
        { key: 'requires', label: 'Comes with' },
      ],
    });
    expect(wrapper.find('.data-table__card-status .status-pill').text()).toBe('Active');
    expect(wrapper.find('.data-table__card-status').text()).not.toContain('Status');
    expect(wrapper.find('.data-table__card-description').text()).toBe('Issue invoices.');
    expect(wrapper.findAll('.data-table__card-meta')).toHaveLength(1);
    expect(wrapper.find('.data-table__card-meta').text()).toContain('Finance');
    expect(wrapper.findAll('.data-table__field')).toHaveLength(0);
  });

  it('paints a slotted field even when the row has no value under its key', () => {
    const wrapper = mountCard(
      { row: { id: '1', name: 'Invoicing' }, fields: [{ key: 'photo', label: 'Photo', cell: 'photo' }] },
      { photo: '<template #photo><img class="custom-photo" alt=""></template>' },
    );
    expect(wrapper.find('.data-table__card-meta .custom-photo').exists()).toBe(true);
  });

  it('leaves the status chip to a slotted status column', () => {
    const wrapper = mountCard(
      { row: { id: '1', name: 'Invoicing', status: 'on' }, fields: [{ key: 'status', label: 'Status', cell: 'status' }] },
      { status: '<template #status><span class="custom-status">On</span></template>' },
    );
    expect(wrapper.find('.data-table__card-status .custom-status').text()).toBe('On');
    expect(wrapper.find('.data-table__card-status .status-pill').exists()).toBe(false);
  });

  it('uses the identity column component in the card heading', () => {
    const wrapper = mountCard({
      titleColumn: {
        key: 'name',
        label: 'App',
        identity: { icon: () => 'ion:cube-outline', subtitle: () => 'Free', testid: 'apps-plan' },
      },
      fields: [],
    });
    expect(wrapper.find('.data-table__identity-title').text()).toBe('Invoicing');
    expect(wrapper.find('[data-testid="apps-plan"]').text()).toBe('Free');
  });
});

describe('the card footer', () => {
  it('is left out when the row offers no action, so no empty bar is painted', () => {
    const wrapper = mountCard({ hasActions: true, actions: { items: [], menu: [] } });
    expect(wrapper.find('.data-table__card-actions').exists()).toBe(false);
  });

  it('holds the main action and «⋮» when there are some', () => {
    const open = { id: 'open', label: 'Open', icon: 'ion:open-outline' };
    const wrapper = mountCard({ hasActions: true, actions: { items: [{ action: open, primary: true }], menu: [] } });
    expect(wrapper.find('.data-table__card-actions [data-testid="apps-row-1-open"]').text()).toBe('Open');
  });

  it('holds the consumer’s own controls even without actions', () => {
    const wrapper = mountCard({ hasActions: true }, { 'row-actions': '<button class="own">Go</button>' });
    expect(wrapper.find('.data-table__card-actions .own').exists()).toBe(true);
  });
});

describe('a field with a switch, on a card', () => {
  const state = {
    key: 'state',
    label: 'State',
    cell: 'state',
    toggle: { checked: () => false, label: () => 'Turn Invoicing on', note: () => 'Could not turn on', noteTone: () => 'danger' as const },
  };
  const slots = { state: '<template #state><span class="custom-chip">Failed</span></template>' };
  const withSwitch = () => mountCard({ fields: [state, { key: 'total', label: 'Total' }] }, slots);

  it('puts the switch at the end of the head, the status under the head without it', () => {
    const wrapper = withSwitch();
    expect(wrapper.find('.data-table__card-head ion-toggle').attributes('aria-label')).toBe('Turn Invoicing on');
    expect(wrapper.find('.data-table__card-head').element.lastElementChild?.classList.contains('data-table__toggle')).toBe(true);
    expect(wrapper.find('.data-table__card-status .custom-chip').text()).toBe('Failed');
    expect(wrapper.find('.data-table__card-status ion-toggle').exists()).toBe(false);
  });

  it('its note is a line of the card, among the secondary data, with its tone', () => {
    const note = withSwitch().find('.data-table__card-meta.data-table__card-note');
    expect(note.text()).toContain('Could not turn on');
    expect(note.classes()).toContain('data-table__card-note--danger');
  });

  it('a row the column hides it for has no switch in its head, and keeps the note', () => {
    const readOnly = { ...state, toggle: { ...state.toggle, hidden: () => true } };
    const wrapper = mountCard({ fields: [readOnly] }, slots);
    expect(wrapper.find('ion-toggle').exists()).toBe(false);
    expect(wrapper.find('.data-table__card-note').text()).toContain('Could not turn on');
  });

  it('a flip emits `toggle` and never opens the card', async () => {
    const wrapper = mountCard({ clickable: true, fields: [state] }, slots);
    const toggle = wrapper.find('.data-table__card-head ion-toggle');
    toggle.element.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: true } }));
    await toggle.trigger('click');
    expect(wrapper.emitted('toggle')).toEqual([[{ column: 'state', row, checked: true }]]);
    expect(wrapper.emitted('open')).toBeUndefined();
  });
});

describe('a field line on a card', () => {
  const withAnIconAndAPlainField = () =>
    mountCard({
      row: { id: '1', name: 'Invoicing', category: 'Finance', sku: 'INV-1' },
      fields: [
        { key: 'category', label: 'Category', cardIcon: 'ion:pricetag-outline' },
        { key: 'sku', label: 'SKU' },
      ],
    });

  it('carries the icon its column declares, and none it does not declare', () => {
    const wrapper = withAnIconAndAPlainField();
    const [category, sku] = wrapper.findAll('.data-table__card-meta');
    expect(category.find('.data-table__card-meta-icon').exists()).toBe(true);
    expect(sku.find('.data-table__card-meta-icon').exists()).toBe(false);
    expect(sku.find('.data-table__card-meta-label').text()).toBe('SKU');
  });

  it('says what its value is: the icon where the column has one, otherwise the field name in sight', () => {
    // A bare «EUR», «1» or «46» under the title leaves the person guessing whether it is stock, prices or
    // diners: a stacked row of a table names each value, the way the list's header names its column.
    const wrapper = withAnIconAndAPlainField();
    const [category, sku] = wrapper.findAll('.data-table__card-meta-label');
    expect(category.classes()).toContain('data-table__card-meta-label--hidden');
    expect(sku.classes()).not.toContain('data-table__card-meta-label--hidden');
    const style = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '';
    expect(style).toMatch(/\.data-table__card-meta-label--hidden \{[^}]*clip-path: inset\(50%\)/);
    expect(style).not.toMatch(/\.data-table__card-meta-label \{[^}]*clip-path/);
  });
});

describe('a long name in a card head', () => {
  it('wraps between words, never inside one', () => {
    expect(source).toMatch(/\.data-table__card-title \{[^}]*overflow-wrap: break-word/);
    expect(identitySource).toMatch(/\.data-table__identity-title \{[^}]*overflow-wrap: break-word/);
    expect(identitySource).not.toContain('overflow-wrap: anywhere');
  });
});
