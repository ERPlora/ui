import { afterEach, describe, expect, it } from 'vitest';

import { ionIconSrc } from '../../shell/icons';
import { click, mountPart, mountTable, NAME, PEOPLE, settle, text } from './__tests__/harness';
import DataTableSelectionBar from './DataTableSelectionBar.vue';
import { DATA_TABLE_ICONS } from './model';

afterEach(() => {
  document.body.replaceChildren();
});

type Ionic = HTMLElement & Record<string, unknown>;

/** The bar as the table paints it with one row selected. */
const AT_REST = { count: 1 };

const mountBar = (props: Record<string, unknown> = {}, locale: 'en' | 'es' = 'en') =>
  mountPart(DataTableSelectionBar, AT_REST, props, { locale });
const count = (root: Element) => text(root.querySelector('.data-table__selection-bar > strong'));
const clearButton = (root: Element) => root.querySelector('.data-table__selection-bar > .data-table__selection-clear') as Ionic;

describe('DataTableSelectionBar', () => {
  it('says how many rows are selected, in the table’s language', () => {
    expect(count(mountBar({ count: 3 }).element.parentElement!)).toBe('3 selected');
    document.body.replaceChildren();
    expect(count(mountBar({ count: 1 }, 'es').element.parentElement!)).toBe('1 seleccionado');
  });

  it('«Clear» is a small clear Ionic button whose icon assistive tech skips, and asks the table to empty the selection', async () => {
    const bar = mountBar();
    const clear = clearButton(bar.element.parentElement!);
    expect([clear.tagName, clear.fill, clear.size, text(clear)]).toEqual(['ION-BUTTON', 'clear', 'small', 'Clear']);
    const glyph = clear.querySelector('ion-icon')!;
    expect([glyph.icon, glyph.getAttribute('aria-hidden')]).toEqual([ionIconSrc(DATA_TABLE_ICONS.clear), 'true']);
    await click(clear);
    expect(bar.emitted('clear')).toHaveLength(1);
  });

  it('says the page’s own texts before the catalogue’s', () => {
    const bar = mountBar({ count: 2, labels: { selected: '{n} bills ticked', clear: 'Untick' } });
    expect([count(bar.element.parentElement!), text(clearButton(bar.element.parentElement!))]).toEqual(['2 bills ticked', 'Untick']);
  });
});

describe('DataTableSelectionBar inside the table', () => {
  it('says the table’s own `labels`', async () => {
    const labels = { selected: '{n} people ticked', clear: 'Untick' };
    const t = mountTable({ rows: PEOPLE, columns: NAME, selectable: true, selected: ['1', '2'], labels }, { attachTo: document.body });
    await settle();
    expect([count(t.element), text(clearButton(t.element))]).toEqual(['2 people ticked', 'Untick']);
  });
});
