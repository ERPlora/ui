// Storybook-free visual guard of the DataTable. The look of the Lit original lives in its CSS, which
// happy-dom does not lay out, so this pins (1) the class names the template paints and (2) the rules
// and custom properties of the ported stylesheet that carry the look. A later CSS clean-up cannot
// silently change the table: each assertion names the OutfitKit issue whose look it keeps.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ION_ICONS } from '../../shell/icons';
import { ionChange, mountTable, settle, viewport } from './__tests__/harness';
import source from './DataTable.vue?raw';
import { DATA_TABLE_ICONS } from './model';

const HERE = dirname(fileURLToPath(import.meta.url));
const VARIABLES = readFileSync(join(HERE, '../../shell/theme/variables.css'), 'utf8');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const STYLE = stripComments(source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(/\s+/g, ' ');
/** The unscoped block: rules that must stay as weak as they were in the Lit shadow root. */
const WEAK = stripComments(source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(/\s+/g, ' ');
const TEMPLATE = (source.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Every value `variables.css` gives a custom property, in file order (light, then dark). */
const values = (name: string): string[] =>
  [...VARIABLES.matchAll(new RegExp(`${escape(name)}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim());
/** Body of the first rule whose selector list is exactly `selector` (outside or inside @media). */
function rule(selector: string, css = STYLE): string {
  const found = css.match(new RegExp(`(?:^|[}{;])\\s*${escape(selector)}\\s*\\{([^}]*)\\}`));
  if (!found) throw new Error(`no rule for «${selector}»`);
  return found[1].trim();
}
/** Text of the first `@media <query> { … }` block. */
function media(query: string): string {
  const start = STYLE.indexOf(`@media ${query} {`);
  if (start === -1) throw new Error(`no @media ${query}`);
  let depth = 0;
  for (let i = STYLE.indexOf('{', start); i < STYLE.length; i++) {
    if (STYLE[i] === '{') depth++;
    if (STYLE[i] === '}' && --depth === 0) return STYLE.slice(STYLE.indexOf('{', start) + 1, i);
  }
  throw new Error('unbalanced @media');
}

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const ROWS = [
  { id: '1', name: 'Ana', total: '10,00 €' },
  { id: '2', name: 'Luis', total: '20,00 €' },
  { id: '3', name: 'Marta', total: '30,00 €' },
];

describe('the painted structure (class names the stylesheet hangs on)', () => {
  it('list view with toolbar, selection, row actions and pager', async () => {
    const t = mountTable({
      rows: ROWS,
      columns: [{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total', align: 'right' }],
      title: 'Customers',
      searchable: true,
      selectable: true,
      selected: ['1'],
      views: true,
      addable: true,
      actions: [{ id: 'edit', label: 'Edit', icon: 'create-outline' }],
      pageSize: 2,
    });
    await settle();
    for (const cls of [
      'data-table',
      'data-table__surface',
      'data-table__bar',
      'data-table__bar-main',
      'data-table__title-wrap',
      'data-table__title',
      'data-table__title-count',
      'data-table__search',
      'data-table__spacer',
      'data-table__columns-select',
      'data-table__page-size-select',
      'data-table__view-segment',
      'data-table__primary-button',
      'data-table__add-button',
      'data-table__selection-bar',
      'data-table__selection-clear',
      'data-table__scroll',
      'data-table__grid',
      'data-table__row',
      'data-table__row--head',
      'data-table__row--data',
      'data-table__row--selected',
      'data-table__select-cell',
      'data-table__cell',
      'data-table__cell--header',
      'data-table__cell--sortable',
      'data-table__cell--right',
      'data-table__cell--pinned',
      'data-table__cell--actions',
      'data-table__caret',
      'data-table__text',
      'data-table__actions',
      'data-table__pager',
      'data-table__pager-info',
      'data-table__pager-count',
      'data-table__pager-nav',
      'data-table__page',
      'data-table__page--current',
    ]) {
      expect(t.element.querySelector(`.${cls}`) ?? (t.element.classList.contains(cls) ? t.element : null), cls).not.toBeNull();
    }
    expect(t.findAll('.data-table__row--data')).toHaveLength(2);
    expect(t.find('ion-searchbar').classes()).toContain('ion-no-border');
  });

  it('card view and the three states', async () => {
    const cardsView = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total' }], views: true, defaultView: 'cards', selectable: true, cardTitle: (r: { name: string }) => r.name, cardIcon: () => 'person-outline', actions: [{ id: 'edit', label: 'Edit' }] });
    const empty = mountTable({ rows: [], columns: [{ key: 'name', label: 'Name' }] });
    const failed = mountTable({ rows: [], columns: [{ key: 'name', label: 'Name' }], error: 'Down' });
    const loading = mountTable({ rows: [], columns: [{ key: 'name', label: 'Name' }], loading: true });
    await settle();
    for (const cls of ['data-table__cards', 'data-table__card', 'data-table__card-head', 'data-table__card-icon', 'data-table__card-title', 'data-table__card-body', 'data-table__field', 'data-table__field-label', 'data-table__field-value', 'data-table__card-actions']) {
      expect(cardsView.element.querySelector(`.${cls}`), cls).not.toBeNull();
    }
    expect(cardsView.findAll('.data-table__card')).toHaveLength(3);
    expect(empty.find('.data-table__empty .data-table__state-icon').exists()).toBe(true);
    expect(failed.find('.data-table__error .data-table__state-icon').exists()).toBe(true);
    expect(failed.find('.data-table__error .data-table__error-title').exists()).toBe(true);
    expect(loading.find('.data-table__loading ion-spinner').exists()).toBe(true);
  });
});

// Ioan, 2026-10-13: the list/cards switch is Ionic's own segment, not the Lit original's bordered
// white box of two square buttons (`.viewseg` / `.toolbtn`). Same place in the toolbar, same API
// (`views`, `defaultView`, `viewChange`).
describe('the list/cards switch is an ion-segment', () => {
  const segmentOf = (t: ReturnType<typeof mountTable>) =>
    t.element.querySelector('.data-table__bar-main > ion-segment') as (HTMLElement & { value?: string }) | null;
  const buttonsOf = (t: ReturnType<typeof mountTable>) =>
    [...(segmentOf(t)?.querySelectorAll(':scope > ion-segment-button') ?? [])] as Array<HTMLElement & { value?: string }>;

  it('paints one ion-segment with a button per view, each with its icon and its name; no boxed buttons', async () => {
    const t = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], views: true, testid: 'people' });
    await settle();
    const segment = segmentOf(t);
    expect(segment?.classList.contains('data-table__view-segment')).toBe(true);
    expect(segment?.getAttribute('data-testid')).toBe('people-view');
    expect(segment?.value).toBe('table');
    const buttons = buttonsOf(t);
    expect(buttons.map((b) => [b.value, b.getAttribute('aria-label'), b.getAttribute('title'), b.getAttribute('data-testid')])).toEqual([
      ['table', 'View as list', 'View as list', 'people-view-table'],
      ['cards', 'View as cards', 'View as cards', 'people-view-cards'],
    ]);
    for (const button of buttons) expect(button.querySelectorAll('ion-icon')).toHaveLength(1);
    expect(t.element.querySelector('.data-table__view-switch'), 'the bordered box is gone').toBeNull();
    expect(t.element.querySelector('.data-table__tool-button'), 'and its square buttons').toBeNull();
    expect(t.element.querySelectorAll('.data-table__bar ion-button[aria-pressed]')).toHaveLength(0);
  });

  it('picking a segment emits viewChange and shows that view; the segment follows `defaultView`', async () => {
    const t = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], views: ['table', 'cards'] });
    const startsInCards = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], views: true, defaultView: 'cards' });
    await settle();
    expect(segmentOf(startsInCards)?.value).toBe('cards');
    await ionChange(segmentOf(t)!, { value: 'cards' });
    expect(t.emitted('viewChange')).toEqual([['cards']]);
    expect(t.element.querySelector('.data-table__cards')).not.toBeNull();
    expect(segmentOf(t)?.value).toBe('cards');
    await ionChange(segmentOf(t)!, { value: 'table' });
    expect(t.emitted('viewChange')).toEqual([['cards'], ['table']]);
    expect(t.element.querySelector('.data-table__cards')).toBeNull();
  });

  it('no segment without views to switch, and a value that is not a view changes nothing', async () => {
    const single = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], views: ['table'] });
    const t = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], views: true });
    await settle();
    expect(segmentOf(single)).toBeNull();
    await ionChange(segmentOf(t)!, { value: undefined });
    expect(t.emitted('viewChange')).toBeUndefined();
  });

  it('sits in the toolbar at its own width (an ion-segment is 100% wide by default) and is a 44px target on touch', () => {
    expect(rule('.data-table__view-segment')).toMatch(/flex: 0 0 auto; width: auto/);
    expect(rule('.data-table__view-segment ion-segment-button')).toMatch(/min-width: 44px; min-height: 36px/);
    const touch = media('(pointer: coarse), (max-width: 834px)');
    expect(rule('.data-table__view-segment ion-segment-button', touch)).toContain('min-height: 44px');
    expect(STYLE).not.toMatch(/\.data-table__view-switch|\.data-table__tool-button/);
  });
});

describe('icons', () => {
  it('every icon the chrome paints is baked into the shell (offline, under CSP), and the template names no other', () => {
    for (const name of Object.values(DATA_TABLE_ICONS)) expect(ION_ICONS, name).toHaveProperty(name);
    expect(TEMPLATE, 'icons go through DATA_TABLE_ICONS, never a literal name').not.toMatch(/<ion-icon[^>]*\sname=/);
  });
});

describe('our names only: nothing of OutfitKit in tags, classes or tokens', () => {
  it('no ok-* tag or class and no --ok-* token in the template or the stylesheet', () => {
    expect(TEMPLATE).not.toMatch(/<ok-|class="[^"]*\bok-|--ok-/);
    expect(`${STYLE} ${WEAK}`).not.toMatch(/--ok-|\.ok-|\bok-[a-z]/);
  });

  it('every token the stylesheet reads is its own, an --ion-*, or an --ep-* (theme value or Lit fallback)', () => {
    const own = new Set([...STYLE.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const read = new Set([...`${STYLE} ${WEAK}`.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    for (const token of read) {
      if (own.has(token) || token.startsWith('--ion-')) continue;
      expect(token.startsWith('--ep-'), token).toBe(true);
      // The theme's --ok-* tokens are gone (PLAN §16.11): an --ep-* it defines is pinned by value
      // below (the frame shadow); any other is read with the Lit fallback, so the look holds.
      if (!values(token).length) expect(STYLE, `${token} has no value in the theme: it needs its fallback`).not.toMatch(new RegExp(`var\\(${escape(token)}\\)`));
    }
  });
});

describe('tokens of the table (the Lit `:host`, now `.data-table`)', () => {
  it('declares the overridable vars with the same chains, --ok-* replaced by the --ion-* it mirrored', () => {
    const root = rule('.data-table');
    for (const declaration of [
      '--background: var(--ion-card-background, var(--ion-background-color, #ffffff))',
      '--color: var(--ion-text-color, #1c1b17)',
      '--color-muted: var(--ion-color-medium, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.55))',
      '--border-color: var(--ion-color-step-150, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.12))',
      '--border-color-soft: var(--ion-color-step-100, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.07))',
      '--control-border: color-mix(in srgb, var(--color) 22%, transparent)',
      '--header-background: var(--ion-color-step-100, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04))',
      '--row-hover: var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.03))',
      '--primary: var(--ion-color-primary, #3880ff)',
      '--primary-contrast: var(--ion-color-primary-contrast, #ffffff)',
      "--font: var(--ion-font-family, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif)",
      'color: var(--color)',
      'font-family: var(--font)',
    ]) {
      expect(root, declaration).toContain(declaration);
    }
  });

  it('keeps the shell frame the Lit host had (shadow, clip) and the 16px radius it painted (the shell’s --ok-radius was a cycle)', () => {
    const root = rule('.data-table');
    expect(root).toContain('display: block');
    expect(root).toContain('box-shadow: var(--ep-shadow-sm)');
    expect(root).toContain('overflow: hidden');
    expect(root).toContain('--border-radius: 16px');
    expect(root).not.toContain('border-radius: var');
    expect(rule('.data-table__surface')).toContain('border-radius: var(--border-radius)');
  });

  it('the frame shadow is --ep-shadow-sm, with the light and dark values the --ok-shadow-sm it replaced had', () => {
    expect(values('--ep-shadow-sm')).toEqual([
      '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
      '0 1px 3px rgba(0, 0, 0, 0.5)',
    ]);
  });

  it('the touch floor and the transition keep the Lit fallbacks (the shell never gave --ok-* values to them)', () => {
    expect(STYLE).toContain('var(--ep-tap-min, 44px)');
    expect(STYLE).toContain('var(--ep-transition, 150ms ease)');
  });
});

describe('the rules that carry the look (one per Lit regression)', () => {
  it('#67/#120: the pinned column is sticky, opaque, shadowed only on overflow; the scrollbar stays', () => {
    const pinned = rule('.data-table__cell--pinned');
    expect(pinned).toMatch(/position: sticky; right: 0; z-index: 1; background: inherit/);
    expect(rule('.data-table__scroll--overflow .data-table__cell--pinned')).toContain('box-shadow:');
    expect(rule('.data-table__row--head .data-table__cell--pinned')).toContain('var(--background)');
    expect(rule('.data-table__scroll::-webkit-scrollbar')).toContain('height: 10px');
  });

  it('#120/#121: the grid floor is the sum of the column minimums; row buttons never shrink', () => {
    expect(rule('.data-table__grid')).toMatch(/min-width: min-content/);
    expect(rule('.data-table__actions ion-button')).toMatch(/flex: 0 0 auto/);
    expect(rule('.data-table__actions')).not.toContain('flex-wrap');
    expect(rule('.data-table__card-actions .data-table__actions')).toContain('flex-wrap: wrap');
  });

  it('a selected row and the current page out-rank :hover, as in Lit (Vue’s scope attribute raises :hover)', () => {
    expect(rule('.data-table__row--data.data-table__row--selected')).toContain('color-mix(in srgb, var(--primary) 10%, transparent)');
    expect(rule('.data-table__page.data-table__page--current')).toContain('color: var(--primary)');
    expect(STYLE.indexOf('.data-table__row--data.data-table__row--selected')).toBeGreaterThan(STYLE.indexOf('.data-table__row--data:hover'));
    expect(STYLE.indexOf('.data-table__page.data-table__page--current')).toBeGreaterThan(STYLE.indexOf('.data-table__page:hover'));
  });

  it('#211/#217: the hidden-but-named label, and the one-line clip a tap unfolds', () => {
    expect(rule('.data-table__sr-only')).toMatch(/position: absolute; width: 1px; height: 1px;.*clip-path: inset\(50%\)/);
    expect(rule('.data-table__cell > :deep(span)')).toMatch(/overflow: hidden; text-overflow: ellipsis; white-space: nowrap/);
    // More specific than the clip, as `span.unfolded` was over `.gcell > span` in Lit.
    expect(rule('.data-table__cell > .data-table__text--unfolded')).toContain('white-space: normal');
  });

  it('#74/#79: clickable rows and cards afford it; the card head is one row in ios', () => {
    expect(rule('.data-table__row--clickable')).toContain('cursor: pointer');
    expect(rule('.data-table__card--clickable')).toContain('cursor: pointer');
    expect(rule('.data-table__card--clickable:focus-visible')).toContain('outline:');
    expect(rule('.data-table__card-head')).toMatch(/display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center/);
  });

  it('#92/#113/#78/pm#530: tap targets — 36px create button on a desk, 44px on touch', () => {
    expect(rule('.data-table__add-button')).toContain('min-height: 36px');
    expect(rule('.data-table__primary-button')).toContain('--background: var(--primary)');
    expect(rule('.data-table__load-more')).toContain('min-height: 44px');
    expect(rule('.data-table__page')).toMatch(/min-width: var\(--ep-tap-min, 44px\); height: var\(--ep-tap-min, 44px\)/);
    const touch = media('(pointer: coarse), (max-width: 834px)');
    expect(rule('.data-table__actions ion-button', touch)).toContain('min-width: 44px; min-height: 44px');
    expect(rule('.data-table__view-segment ion-segment-button', touch)).toContain('min-height: 44px');
    expect(rule('.data-table__add-button', touch)).toContain('min-height: 44px');
    expect(rule('.data-table__pager-nav ion-button', touch)).toContain('min-height: 44px');
    expect(rule('.data-table__error ion-button', touch)).toContain('min-height: 44px');
  });

  it('a select the page puts in the `filters` or `toolbar` slot is boxed like the table’s own selects', () => {
    const own = rule('.data-table__columns-select');
    const slotted = rule('.data-table__bar-main > :slotted(ion-select)');
    for (const declaration of [
      'min-height: 38px',
      'font-size: 13px',
      'background: var(--background)',
      'color: var(--color)',
      'border: 1px solid var(--control-border)',
      'border-radius: 10px',
    ]) {
      expect(own).toContain(declaration);
      expect(slotted).toContain(declaration);
    }
  });

  it('#218/#268/pm#530: fill stretches the states; on a phone the list grows with the page', () => {
    expect(rule('.data-table--fill')).toMatch(/display: flex; flex-direction: column; height: 100%; min-height: 0/);
    expect(rule('.data-table--fill .data-table__empty, .data-table--fill .data-table__error, .data-table--fill .data-table__loading')).toContain('flex: 1 1 auto');
    const phone = media('(max-width: 640px)');
    expect(rule('.data-table--fill .data-table__cards', phone)).toContain('overflow: visible');
    expect(rule('.data-table--fill.data-table--content-after', phone)).toContain('flex-shrink: 0 !important');
    // Measured in Chrome at 390px (AppPage detail-fill, 60 rows): with nothing after it the box kept
    // the container's height and, `overflow: hidden`, clipped every row and the pager below the fold;
    // the page had nothing to scroll. On a phone it grows with its rows, at least the container's height.
    expect(rule('.data-table--fill:not(.data-table--content-after)', phone)).toBe('height: auto; min-height: 100%;');
    expect(rule('.data-table__error .data-table__state-icon')).toContain('var(--ion-color-danger, #c5000f)');
  });

  it('document rules that never reached the Lit shadow root are held off the table’s own controls (measured in Chromium)', () => {
    // A document rule beats an Ionic `:host` rule, even Tailwind's layered preflight: Ionic's ios
    // host values come back, and polish.css's restyling of ion-button/ion-card/ion-card-header goes.
    expect(rule(':where(.data-table) ion-button')).toMatch(/height: auto; margin: 4px 2px; text-transform: inherit; font-weight: 500; --border-radius: 6px/);
    expect(rule(':where(.data-table) ion-button[fill="clear"]')).toMatch(/font-weight: normal; --color: var\(--ion-color-primary, #0054e9\)/);
    expect(rule(':where(.data-table) ion-button > ion-icon[slot="start"]')).toBe('margin-inline-start: -0.3em;');
    expect(rule(':where(.data-table) ion-card')).toMatch(/border: initial; border-radius: 8px; box-shadow: 0 4px 16px rgba\(0, 0, 0, 0.12\)/);
    expect(rule(':where(.data-table) ion-card-header')).toBe('padding: 20px 20px 16px;');
    // In the shadow root an ion-select inherited the table's --border-radius (16px).
    expect(rule(':where(.data-table) ion-select')).toBe('--border-radius: inherit;');
    expect(rule('.data-table__title')).toContain('letter-spacing: inherit');
    expect(rule('.data-table__selection-clear')).toContain('padding: revert');
    expect(rule('.data-table :deep(*)')).toBe('scrollbar-width: auto;');
  });

  it('the searchbar rules stay WEAKER than Ionic’s own classes, as in Lit (60px box, Ionic’s grey field)', () => {
    expect(STYLE, 'a scoped copy carries Vue’s attribute and outweighs Ionic').not.toMatch(/ion-searchbar\s*[.{]/);
    expect(rule(':where(.data-table__search) ion-searchbar', WEAK)).toBe('--background: var(--background); --border-radius: 10px; padding: 0; min-height: 36px;');
    expect(rule(':where(.data-table__search) ion-searchbar.ion-no-border', WEAK)).toBe('--box-shadow: none;');
    expect(rule(':where(.data-table__search) .searchbar-input', WEAK)).toBe('line-height: normal;');
    expect(rule(':where(.data-table__search) .searchbar-clear-button', WEAK)).toBe('font: revert; cursor: revert;');
  });
});

describe('the filters panel (`filterable`): pushes the list from 834 px, a sheet over the content area below', () => {
  it('≥ 834px: while open the surface is two columns, the list (toolbar, rows, footer) and the 360px panel', () => {
    const desk = media('(min-width: 834px)');
    expect(rule('.data-table__surface--panel', desk)).toBe(
      'display: grid; grid-template-columns: minmax(0, 1fr) 360px; grid-template-rows: auto minmax(0, 1fr) auto;',
    );
    expect(rule('.data-table__surface--panel > .data-table__pager', desk)).toBe('grid-column: 1; grid-row: 3;');
    expect(rule('.data-table__surface--panel > .data-table__drawer', desk)).toMatch(/^position: static; grid-column: 2; grid-row: 1 \/ -1;/);
  });

  it('< 834px (outfitkit#197): a fixed sheet between the measured top and bottom of the content area, its footer over the safe area', () => {
    const sheet = media('(max-width: 833.98px)');
    expect(rule('.data-table__drawer', sheet)).toMatch(
      /^position: fixed; inset: 0; top: var\(--data-table-sheet-top, 0px\); bottom: var\(--data-table-sheet-bottom, 0px\); width: 100%;/,
    );
    expect(rule('.data-table__drawer-foot', sheet)).toBe('padding-bottom: calc(0.6rem + var(--data-table-sheet-safe-bottom));');
    // Unmeasured, the sheet keeps the screen edges and the device's safe area.
    const root = rule('.data-table');
    expect(root).toContain('--data-table-sheet-top: 0px;');
    expect(root).toContain('--data-table-sheet-bottom: 0px;');
    expect(root).toContain('--data-table-sheet-safe-bottom: env(safe-area-inset-bottom, 0px);');
  });

  it('the funnel is a 36px tool button (44px on touch) with its count in a pill on its corner', () => {
    expect(rule('.data-table__filter-button')).toMatch(/width: 36px; height: 36px/);
    // Ionic clips its native button (`--overflow: hidden`): the pill on the corner was cut in half
    // (measured in Chromium at 390, 834 and 1440 px, FIX-DATATABLE).
    expect(rule('.data-table__filter-button')).toContain('--overflow: visible');
    expect(rule('.data-table__filter-button', media('(pointer: coarse), (max-width: 834px)'))).toBe('width: 44px; height: 44px;');
    expect(rule('.data-table__filter-button .data-table__filter-count')).toMatch(/^position: absolute; top: -5px; right: -5px;/);
  });
});

describe('FIX-UI-DATATABLE-CLIP: nothing of the table is cut off (measured in Chromium by the Hub e2e)', () => {
  it('a range shares the panel width: its two ends may shrink below the date field’s own width', () => {
    // A flex item never shrinks below its content (`min-width: auto`): two date fields side by side
    // reached 21px past the 360px panel and «To» lost its border (Hub: Staff «Hire date», 834 and 1440 px).
    expect(rule('.data-table__drawer-range > ion-input')).toBe('flex: 1 1 0; min-width: 0;');
  });

  it('FIX-UI-DATATABLE-CARD-LONG-VALUE-CLIP: a card value never runs past its card; a word too long for it ends in «…»', () => {
    // A flex item never shrinks below its longest word (`min-width: auto`): a 54-character email ran
    // past the card's right edge and ion-card cut it with no «…» (Hub: Staff › Members at 375 px). The
    // value may shrink; its default text wraps between words as before and clips a word that does not
    // fit with «…»; a tap unfolds it, breaking the word anywhere (the table's #217). Its own
    // `overflow-wrap`: Ionic's `body` breaks a long word at the box edge, which split the email into
    // «…clips.e2» / «e@example.com» with no sign (measured in Chromium, as StatusPill's label).
    expect(rule('.data-table__field-value')).toBe('font-weight: 500; text-align: right; color: var(--color); min-width: 0;');
    expect(rule('.data-table__field-text')).toBe('display: block; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal;');
    expect(rule('.data-table__field-text--unfolded')).toBe('overflow-wrap: anywhere;');
  });

  it('a card title wraps (two lines at most, the whole text in the page), never «…» on one line', () => {
    // The whole rule: as an addition the Lit parity no longer checks it, so its weight, its share of
    // the head and the clamp's box are pinned here (no `white-space: nowrap`, no `text-overflow: ellipsis`).
    expect(rule('.data-table__card-title')).toBe(
      'flex: 1; min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; font-weight: 600;',
    );
  });
});
