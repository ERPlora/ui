// Accessibility of the DataTable chrome, from the second UX audit of the SaaS panel (2026-10-14):
//   - R-03: 392 of the 740 unnamed icons were this table's. Ionic paints `ion-icon` as `role="img"`,
//     so every icon is decorative (`aria-hidden="true"`) and every icon-only button carries its name
//     (`aria-label`): the toolbar, the sort carets, the row actions, the cards, the states, the pager.
//   - R-13: the selection checkboxes are 24×24 (Ionic's ios box is 22) with a 44px target on touch.
//   - R-12: the search box shows where the focus is (the theme's accent ring).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { unnamedButtons, unnamedIcons } from '../../testing/a11y';
import { byTestId, click, ionChange, mountTable, settle, viewport, type Table } from './__tests__/harness';
import source from './DataTable.vue?raw';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const ROWS = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `Business ${i + 1}`, total: i * 10 }));
const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'total', label: 'Total', align: 'right' as const },
];
const ACTIONS = [
  { id: 'edit', label: 'Edit', icon: 'create-outline' },
  { id: 'pay', label: 'Pay', icon: 'card-outline', showLabel: true },
  { id: 'remove', label: 'Remove', icon: 'trash-outline', menuOnly: true },
];

/** Everything the table can paint at once: toolbar, selection bar, sorted list, actions, pager. */
async function fullTable(props: Record<string, unknown> = {}, locale: 'en' | 'es' = 'en'): Promise<Table> {
  const t = mountTable(
    {
      rows: ROWS,
      columns: COLUMNS,
      actions: ACTIONS,
      title: 'Businesses',
      searchKeys: ['name'],
      selectable: true,
      addable: true,
      primaryAction: { label: 'Export', icon: 'download-outline' },
      views: true,
      testid: 'list',
      ...props,
    },
    { locale, attachTo: document.body },
  );
  await settle();
  return t;
}

/** The `aria-label` of a button: on the host, or where hydrated Ionic moves it (its native button). */
const ariaLabel = (el: Element): string | null | undefined =>
  el.getAttribute('aria-label') ?? el.shadowRoot?.querySelector('button')?.getAttribute('aria-label');

const describeAll = (els: Element[]): string[] =>
  els.map((el) => `${el.tagName.toLowerCase()}.${el.className} ${el.outerHTML.slice(0, 120)}`);

describe('R-03: no unnamed icon and no unnamed button in the DataTable', () => {
  it('the list with its whole chrome: toolbar, selection bar, sort caret, row actions, «⋮» menu, pager', async () => {
    const t = await fullTable();
    await click(t.element.querySelector('.data-table__cell--sortable'));
    await ionChange(t.element.querySelector('.data-table__row--data ion-checkbox')!, { checked: true });
    await click(byTestId(t, 'list-row-1-menu')[0]);
    expect(t.element.querySelector('[data-stub="ion-popover"]'), 'the row menu is open').not.toBeNull();
    expect(t.element.querySelector('.data-table__selection-bar'), 'the selection bar is shown').not.toBeNull();
    expect(t.element.querySelector('.data-table__pager-nav'), 'the pager has pages').not.toBeNull();
    expect(describeAll(unnamedIcons(t.element))).toEqual([]);
    expect(describeAll(unnamedButtons(t.element))).toEqual([]);
  });

  it('the cards, with their icon, checkbox, actions and «⋮»', async () => {
    const t = await fullTable({ defaultView: 'cards', cardIcon: () => 'storefront-outline' });
    expect(t.element.querySelector('.data-table__card-icon ion-icon'), 'the card icon is painted').not.toBeNull();
    expect(describeAll(unnamedIcons(t.element))).toEqual([]);
    expect(describeAll(unnamedButtons(t.element))).toEqual([]);
  });

  it('the failed load, the empty list and the search that finds nothing', async () => {
    for (const props of [{ error: 'The service did not answer.' }, { rows: [] }, { rows: ROWS, search: 'zzz' }]) {
      const t = await fullTable(props);
      expect(t.element.querySelector('.data-table__state-icon ion-icon'), JSON.stringify(props)).not.toBeNull();
      expect(describeAll(unnamedIcons(t.element)), JSON.stringify(props)).toEqual([]);
      expect(describeAll(unnamedButtons(t.element)), JSON.stringify(props)).toEqual([]);
      t.unmount();
    }
  });

  it('the pager arrows say where they go, in the language of the page; the current page is marked', async () => {
    const en = await fullTable();
    expect(ariaLabel(byTestId(en, 'list-page-prev')[0])).toBe('Previous page');
    expect(ariaLabel(byTestId(en, 'list-page-next')[0])).toBe('Next page');
    const pages = [...en.element.querySelectorAll('.data-table__page')];
    expect(pages.map((page) => page.getAttribute('aria-current'))).toEqual(['page', null, null]);
    en.unmount();
    const es = await fullTable({}, 'es');
    expect(ariaLabel(byTestId(es, 'list-page-prev')[0])).toBe('Página anterior');
    expect(ariaLabel(byTestId(es, 'list-page-next')[0])).toBe('Página siguiente');
  });

  it('the sort direction, which the caret only shows, is said by the column header (aria-sort)', async () => {
    const t = await fullTable();
    const headers = () => [...t.element.querySelectorAll('.data-table__cell--sortable')];
    expect(headers().map((h) => h.getAttribute('aria-sort'))).toEqual([null, null]);
    await click(headers()[0]);
    expect(headers().map((h) => h.getAttribute('aria-sort'))).toEqual(['ascending', null]);
    await click(headers()[0]);
    expect(headers().map((h) => h.getAttribute('aria-sort'))).toEqual(['descending', null]);
  });
});

// The stylesheet carries R-12 and R-13: happy-dom lays nothing out, so the rules are read from it.
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const SCOPED = stripComments(source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(/\s+/g, ' ');
const WEAK = stripComments(source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(/\s+/g, ' ');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Body of the first rule whose selector list is exactly `selector`, and where it starts. */
function rule(selector: string, css: string): { body: string; at: number } {
  const found = new RegExp(`(?:^|[}{;])\\s*${escape(selector)}\\s*\\{([^}]*)\\}`).exec(css);
  if (!found) throw new Error(`no rule for «${selector}»`);
  return { body: found[1].trim(), at: found.index };
}
/** Text of the first `@media <query> { … }` block. */
function media(query: string, css: string): string {
  const start = css.indexOf(`@media ${query} {`);
  if (start === -1) throw new Error(`no @media ${query}`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
  }
  throw new Error('unbalanced @media');
}

describe('R-13: the selection checkboxes are big enough to hit', () => {
  it('the box is 24×24 at every width (Ionic ios paints 22)', () => {
    expect(rule('.data-table ion-checkbox', SCOPED).body).toMatch(/--size:\s*24px/);
  });

  it('on touch (and up to 834px) the target is 44×44, without growing the row: the extra is a negative margin', () => {
    const touch = rule('.data-table ion-checkbox', media('(pointer: coarse), (max-width: 834px)', SCOPED)).body;
    expect(touch).toMatch(/width:\s*44px/);
    expect(touch).toMatch(/height:\s*44px/);
    expect(touch).toMatch(/margin:\s*-10px/);
    // The box centred in its target: the whole host toggles (Ionic listens on it).
    expect(touch).toMatch(/display:\s*grid/);
    expect(touch).toMatch(/place-items:\s*center/);
  });
});

describe('R-12: the search box shows where the focus is', () => {
  const FOCUS = ':where(.data-table__search) ion-searchbar:focus-within, :where(.data-table__search) ion-searchbar.searchbar-has-focus';

  it('focused (with the keyboard or not), its field takes the accent ring of the theme', () => {
    expect(rule(FOCUS, WEAK).body).toMatch(/--box-shadow:\s*var\(--ep-ring-accent\)/);
  });

  it('after the borderless rule, which has the same weight and would otherwise switch it off', () => {
    const borderless = rule(':where(.data-table__search) ion-searchbar.ion-no-border', WEAK);
    expect(borderless.body).toMatch(/--box-shadow:\s*none/);
    expect(rule(FOCUS, WEAK).at).toBeGreaterThan(borderless.at);
  });
});
