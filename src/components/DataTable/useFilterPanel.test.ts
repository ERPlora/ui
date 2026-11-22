import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { settle, viewport } from './__tests__/harness';
import type { DataTableColumn, DataTableFilters } from './types';
import { useFilterPanel } from './useFilterPanel';

type Row = { id: string; name: string };
const FILTERED: DataTableColumn<Row>[] = [{ key: 'name', label: 'Name', filter: { type: 'text' } }];

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

interface ProbeOptions {
  filterable?: boolean;
  cards?: boolean;
  columns?: DataTableColumn<Row>[];
  /** The funnel's native button, in its shadow root, as an `ion-button` has once loaded. */
  nativeButton?: boolean;
}

/** A table root as the panel finds it: the funnel, and the drawer inside the surface while open. */
function mountProbe(options: ProbeOptions = {}) {
  const filterable = ref(options.filterable ?? true);
  const cards = ref(options.cards ?? false);
  const columns = ref(options.columns ?? FILTERED);
  const setFilters = vi.fn<(filters: DataTableFilters) => void>();
  let panel!: ReturnType<typeof useFilterPanel<Row>>;
  const Probe = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      panel = useFilterPanel<Row>({
        root,
        filterable: () => filterable.value,
        cardsOn: () => cards.value,
        filterColumns: () => columns.value,
        setFilters,
      });
      return () =>
        h('div', { ref: root, class: 'data-table' }, [
          h('div', { class: 'data-table__surface' }, [
            h('div', { class: 'data-table__filter-button', tabindex: -1 }),
            panel.filterPanelOpen.value ? h('aside', { class: 'data-table__drawer', tabindex: -1 }) : null,
          ]),
        ]);
    },
  });
  const el = mount(Probe, { attachTo: document.body }).element as HTMLElement;
  const funnel = el.querySelector<HTMLElement>('.data-table__filter-button')!;
  const native = options.nativeButton ? funnel.attachShadow({ mode: 'open' }).appendChild(document.createElement('button')) : null;
  const drawer = () => el.querySelector<HTMLElement>('.data-table__drawer');
  return { panel, filterable, cards, columns, setFilters, funnel, native, drawer };
}
type Probe = ReturnType<typeof mountProbe>;

/** The panel's state change rendered, and the focus moved after it. */
async function rendered(): Promise<void> {
  await nextTick();
  await nextTick();
}

describe('useFilterPanel', () => {
  it('the filters fold behind the funnel with `filterable` or in the cards, and the funnel needs a filter to show', async () => {
    const p = mountProbe({ filterable: true });
    expect([p.panel.filtersFolded.value, p.panel.showFunnel.value]).toEqual([true, true]);
    p.filterable.value = false;
    expect([p.panel.filtersFolded.value, p.panel.showFunnel.value]).toEqual([false, false]);
    p.cards.value = true;
    expect([p.panel.filtersFolded.value, p.panel.showFunnel.value]).toEqual([true, true]);
    p.columns.value = [];
    expect([p.panel.filtersFolded.value, p.panel.showFunnel.value]).toEqual([true, false]);
  });

  it('the funnel opens the panel and puts the focus in its drawer; again, it closes it', async () => {
    const p = mountProbe();
    expect(p.panel.filterPanelOpen.value).toBe(false);
    p.panel.toggleFilterPanel();
    await rendered();
    expect(p.panel.filterPanelOpen.value).toBe(true);
    expect(document.activeElement === p.drawer(), 'the focus is in the drawer').toBe(true);
    p.panel.toggleFilterPanel();
    await rendered();
    expect(p.panel.filterPanelOpen.value).toBe(false);
  });

  it('closing gives the focus back to the funnel: to its native button once Ionic has loaded it, else to the host', async () => {
    const ionic = mountProbe({ nativeButton: true });
    ionic.panel.toggleFilterPanel();
    await rendered();
    const toNative = vi.spyOn(ionic.native!, 'focus');
    ionic.panel.closeFilterPanel();
    await rendered();
    expect(toNative).toHaveBeenCalledOnce();
    document.body.replaceChildren();

    const plain = mountProbe();
    plain.panel.toggleFilterPanel();
    await rendered();
    plain.panel.closeFilterPanel();
    await rendered();
    expect(document.activeElement === plain.funnel, 'the focus is on the funnel').toBe(true);
  });

  it('closing a panel that is not open moves no focus', async () => {
    const p = mountProbe();
    const toFunnel = vi.spyOn(p.funnel, 'focus');
    p.panel.closeFilterPanel();
    await rendered();
    expect(toFunnel).not.toHaveBeenCalled();
  });

  it('«Apply» applies the draft and closes the panel', async () => {
    const p = mountProbe();
    p.panel.toggleFilterPanel();
    await rendered();
    p.panel.applyFilterPanel({ name: 'ana' });
    await rendered();
    expect(p.setFilters).toHaveBeenCalledExactlyOnceWith({ name: 'ana' });
    expect(p.panel.filterPanelOpen.value).toBe(false);
    expect(document.activeElement === p.funnel, 'the focus is back on the funnel').toBe(true);
  });

  it.each<[string, ProbeOptions, (p: Probe) => unknown]>([
    ['the page drops `filterable`', { filterable: true }, (p) => (p.filterable.value = false)],
    ['the columns stop declaring filters', { filterable: true }, (p) => (p.columns.value = [])],
    ['the list comes back from the cards', { filterable: false, cards: true }, (p) => (p.cards.value = false)],
  ])('the open panel closes when %s, and nothing is applied', async (_case, start, change) => {
    const p = mountProbe(start);
    p.panel.toggleFilterPanel();
    await rendered();
    change(p);
    await rendered();
    expect(p.panel.filterPanelOpen.value).toBe(false);
    expect(p.setFilters).not.toHaveBeenCalled();
  });

  it('below 834 px the open panel is a modal sheet; closed, it is none', async () => {
    viewport(true);
    const p = mountProbe();
    expect(p.panel.panelIsSheet.value).toBe(false);
    p.panel.toggleFilterPanel();
    await settle();
    expect(p.panel.panelIsSheet.value).toBe(true);
    p.panel.toggleFilterPanel();
    await settle();
    expect(p.panel.panelIsSheet.value).toBe(false);
  });
});
