// «Visually identical» as a mechanical check: EVERY rule of the Lit original's stylesheet
// (`__tests__/lit-styles.css`, verbatim from ERPlora/outfitkit origin/main) is either ported to a
// DataTable rule with the SAME declarations in the same order, or listed below as dropped with its
// reason; and every DataTable rule is either a port or listed as an addition with its reason.
// Nothing is assumed beyond the ported CSS: a declaration changed, added or lost fails here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import source from './DataTable.vue?raw';

// From disk: Vitest's CSS handling empties a `.css?raw` import.
const litCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__tests__/lit-styles.css'), 'utf8');

interface Rule {
  media: string;
  selector: string;
  declarations: string[];
}

/** Rules of a stylesheet (comments out, `@keyframes` skipped), keyed by `media || selector`. */
function parse(css: string): Map<string, Rule> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = new Map<string, Rule>();
  const stack: string[] = [];
  let buffer = '';
  for (const ch of text) {
    if (ch === '{') {
      stack.push(buffer.replace(/\s+/g, ' ').trim());
      buffer = '';
    } else if (ch === '}') {
      const prelude = stack.pop() ?? '';
      if (!prelude.startsWith('@') && !stack.some((p) => p.startsWith('@keyframes'))) {
        const media = stack.filter((p) => p.startsWith('@media')).join(' ');
        const declarations = buffer
          .split(';')
          .map((d) => d.replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        rules.set(key(media, prelude), { media, selector: prelude, declarations });
      }
      buffer = '';
    } else buffer += ch;
  }
  return rules;
}
const key = (media: string, selector: string) => (media ? `${media} || ${selector}` : selector);

/** What an --ok-* token paints in the shell: the shell defines none of them, so the Lit fallback
 *  paints, except the ones mirrored by an --ion-* (font) or kept as our --ep-* (with the fallback). */
const OK_TOKENS: Record<string, string> = {
  font: '--ion-font-family',
  transition: '--ep-transition',
  'tap-min': '--ep-tap-min',
  // The phone sheet's insets the table measures and publishes (`useFilterSheet`, outfitkit#197).
  'sheet-top': '--data-table-sheet-top',
  'sheet-bottom': '--data-table-sheet-bottom',
};
function resolveOkTokens(declaration: string): string {
  let out = declaration;
  for (let at = out.indexOf('var(--ok-'); at !== -1; at = out.indexOf('var(--ok-')) {
    const name = out.slice(at + 9).match(/^[a-z0-9-]+/)?.[0] ?? '';
    let depth = 0;
    let end = at;
    for (; end < out.length; end++) {
      if (out[end] === '(') depth++;
      if (out[end] === ')' && --depth === 0) break;
    }
    const fallback = out.slice(at + 9 + name.length, end).replace(/^\s*,\s*/, '');
    const replacement = OK_TOKENS[name] ? `var(${OK_TOKENS[name]}, ${fallback})` : fallback;
    out = out.slice(0, at) + replacement + out.slice(end + 1);
  }
  return out;
}

/** Lit rule → DataTable rule (`:host` → `.data-table`, classes → `data-table__*`). */
const PORTED: Record<string, string> = {
  'ion-searchbar input::-webkit-search-cancel-button': '.data-table__search :deep(input::-webkit-search-cancel-button)',
  ':host': '.data-table',
  '*': '*',
  '.card': '.data-table__surface',
  ':host([fill])': '.data-table--fill',
  ':host([fill]) .card': '.data-table--fill .data-table__surface',
  ':host([fill]) .bar, :host([fill]) .panel, :host([fill]) .pager': '.data-table--fill .data-table__bar, .data-table--fill .data-table__pager',
  ':host([fill]) .scroll, :host([fill]) .cards-grid': '.data-table--fill .data-table__scroll, .data-table--fill .data-table__cards',
  ':host([fill]) .empty, :host([fill]) .load-error, :host([fill]) .loading-state':
    '.data-table--fill .data-table__empty, .data-table--fill .data-table__error, .data-table--fill .data-table__loading',
  '@media (max-width: 640px) || :host([fill]) .card': '@media (max-width: 640px) || .data-table--fill .data-table__surface',
  '@media (max-width: 640px) || :host([fill]) .scroll, :host([fill]) .cards-grid':
    '@media (max-width: 640px) || .data-table--fill .data-table__scroll, .data-table--fill .data-table__cards',
  '@media (max-width: 640px) || :host([fill]) .cards-grid': '@media (max-width: 640px) || .data-table--fill .data-table__cards',
  '@media (max-width: 640px) || :host([fill][content-after])': '@media (max-width: 640px) || .data-table--fill.data-table--content-after',
  '.bar': '.data-table__bar',
  '.bar-main': '.data-table__bar-main',
  '.bar-main > ion-button': '.data-table__bar-main > ion-button',
  '.tk-spacer': '.data-table__spacer',
  '@media (max-width: 1024px) || .tk-spacer': '@media (max-width: 1024px) || .data-table__spacer',
  '@media (max-width: 640px) || .search': '@media (max-width: 640px) || .data-table__search',
  '.title-wrap': '.data-table__title-wrap',
  '.title': '.data-table__title',
  '.title-count': '.data-table__title-count',
  '.search': '.data-table__search',
  'ion-searchbar': ':where(.data-table__search) ion-searchbar',
  'ion-searchbar.ion-no-border': ':where(.data-table__search) ion-searchbar.ion-no-border',
  '.primary-btn': '.data-table__primary-button',
  '.add-btn': '.data-table__add-button',
  '.add-btn ion-icon': '.data-table__add-button ion-icon',
  '.tk-cols': '.data-table__columns-select',
  '.tk-psize': '.data-table__page-size-select',
  '.selbar': '.data-table__selection-bar',
  '.selbar .sel-clear': '.data-table__selection-clear',
  '.selbar .sel-clear:hover': '.data-table__selection-clear:hover',
  '.scroll': '.data-table__scroll',
  '.scroll::-webkit-scrollbar': '.data-table__scroll::-webkit-scrollbar',
  '.scroll::-webkit-scrollbar-track': '.data-table__scroll::-webkit-scrollbar-track',
  '.scroll::-webkit-scrollbar-thumb': '.data-table__scroll::-webkit-scrollbar-thumb',
  '.scroll::-webkit-scrollbar-thumb:hover': '.data-table__scroll::-webkit-scrollbar-thumb:hover',
  '.grid': '.data-table__grid',
  '.grow': '.data-table__row',
  '.ghead': '.data-table__row--head',
  '.gcell': '.data-table__cell',
  '.gcell > span': '.data-table__cell > :deep(span)',
  '.gcell > span.unfolded': '.data-table__cell > .data-table__text--unfolded',
  '.gcell.right': '.data-table__cell--right',
  '.gcell.center': '.data-table__cell--center',
  '.gcell.actions-col': '.data-table__cell--pinned',
  '.scroll.x-overflow .gcell.actions-col': '.data-table__scroll--overflow .data-table__cell--pinned',
  '.ghead .gcell.actions-col': '.data-table__row--head .data-table__cell--pinned',
  '.gh': '.data-table__cell--header',
  '.gh.sortable': '.data-table__cell--sortable',
  '@media (hover: hover) || .gh.sortable:hover': '@media (hover: hover) || .data-table__cell--sortable:hover',
  '.caret': '.data-table__caret',
  '.caret.on': '.data-table__caret--active',
  '.grow-data': '.data-table__row--data',
  '.grow-data:last-child': '.data-table__row--data:last-child',
  '@media (hover: hover) || .grow-data:hover': '@media (hover: hover) || .data-table__row--data:hover',
  '.grow-data:active': '.data-table__row--data:active',
  '.grow-data.selected': '.data-table__row--data.data-table__row--selected',
  '.grow-data.clickable': '.data-table__row--clickable',
  '.grow-data.clickable:focus-visible': '.data-table__row--clickable:focus-visible',
  '.selcb': '.data-table__select-cell',
  '.cards-grid': '.data-table__cards',
  'ion-card.rcard': 'ion-card.data-table__card',
  'ion-card.rcard.selected': '.data-table__card--selected',
  'ion-card.rcard.clickable': '.data-table__card--clickable',
  'ion-card.rcard.clickable:focus-visible': '.data-table__card--clickable:focus-visible',
  '@media (prefers-reduced-motion: reduce) || .gh.sortable:hover, .gh.sortable:active, .grow-data:hover, .grow-data:active':
    '@media (prefers-reduced-motion: reduce) || .data-table__cell--sortable:hover, .data-table__cell--sortable:active, .data-table__row--data:hover, .data-table__row--data:active',
  'ion-card-header.rcard-head': '.data-table__card-head',
  '.rcard-head .rc-icon': '.data-table__card-icon',
  'ion-card-content.rcard-body': '.data-table__card-body',
  '.rrow': '.data-table__field',
  '.rrow .rk': '.data-table__field-label',
  '.rrow .rv': '.data-table__field-value',
  '.ractions': '.data-table__card-actions',
  '.ractions .actions': '.data-table__card-actions .data-table__actions',
  '.empty': '.data-table__empty',
  '.load-error': '.data-table__error',
  '.loading-state': '.data-table__loading',
  '.loading-state ion-spinner': '.data-table__loading ion-spinner',
  '.load-error .load-error-title': '.data-table__error .data-table__error-title',
  '.load-error .empty-ic': '.data-table__error .data-table__state-icon',
  '.load-error ion-button': '.data-table__error ion-button',
  '.empty .empty-ic, .load-error .empty-ic': '.data-table__empty .data-table__state-icon, .data-table__error .data-table__state-icon',
  '.actions': '.data-table__actions',
  '.actions ion-button': '.data-table__actions ion-button',
  '.actions .action-gap': '.data-table__actions .data-table__action-gap',
  '.sr-only': '.data-table__sr-only',
  '@media (pointer: coarse), (max-width: 834px) || .actions ion-button': '@media (pointer: coarse), (max-width: 834px) || .data-table__actions ion-button',
  '@media (pointer: coarse), (max-width: 834px) || .add-btn': '@media (pointer: coarse), (max-width: 834px) || .data-table__add-button',
  '@media (pointer: coarse), (max-width: 834px) || .pager .nav ion-button': '@media (pointer: coarse), (max-width: 834px) || .data-table__pager-nav ion-button',
  '@media (pointer: coarse), (max-width: 834px) || .load-error ion-button': '@media (pointer: coarse), (max-width: 834px) || .data-table__error ion-button',
  '.actions ion-spinner': '.data-table__actions ion-spinner',
  '.pager': '.data-table__pager',
  '.pager .left': '.data-table__pager-info',
  '.pager .strong': '.data-table__pager-count',
  '.psize': '.data-table__pager-size',
  '.pager .nav': '.data-table__pager-nav',
  '.pager .load-more': '.data-table__load-more',
  '.pnum': '.data-table__page',
  '.pnum:hover': '.data-table__page:hover',
  '.pnum.on': '.data-table__page.data-table__page--current',
  '.pgap': '.data-table__page-gap',
  'ion-button': 'ion-button',
  // The inline filters' boxed control (hub-next apps/tax/UI-REQUESTS.md: column filters are back).
  '.tk-filter': '.data-table__filter',
  // The filters panel (`filterable`, PLAN-MIGRATIONS §13, 2026-10-15): the old table's funnel with its count,
  // and its drawer inside the table: two columns from 834 px, a sheet over the content area below (#75/#197).
  '.toolbtn': '.data-table__filter-button',
  '.toolbtn .badge': '.data-table__filter-button .data-table__filter-count',
  '@media (pointer: coarse), (max-width: 834px) || .toolbtn': '@media (pointer: coarse), (max-width: 834px) || .data-table__filter-button',
  '.drawer': '.data-table__drawer',
  '@media (min-width: 834px) || .card.has-panel': '@media (min-width: 834px) || .data-table__surface--panel',
  '@media (min-width: 834px) || .card.has-panel > .bar': '@media (min-width: 834px) || .data-table__surface--panel > .data-table__bar',
  '@media (min-width: 834px) || .card.has-panel > .scroll, .card.has-panel > .cards-grid, .card.has-panel > .empty, .card.has-panel > .load-error, .card.has-panel > .loading-state':
    '@media (min-width: 834px) || .data-table__surface--panel > .data-table__scroll, .data-table__surface--panel > .data-table__cards, .data-table__surface--panel > .data-table__empty, .data-table__surface--panel > .data-table__error, .data-table__surface--panel > .data-table__loading',
  '@media (min-width: 834px) || .card.has-panel > .pager': '@media (min-width: 834px) || .data-table__surface--panel > .data-table__pager',
  '@media (min-width: 834px) || .card.has-panel > .drawer': '@media (min-width: 834px) || .data-table__surface--panel > .data-table__drawer',
  '@media (max-width: 833.98px) || .drawer': '@media (max-width: 833.98px) || .data-table__drawer',
  '.drawer .dh': '.data-table__drawer-head',
  '.drawer .db': '.data-table__drawer-body',
  '.fblock': '.data-table__drawer-field',
  '.flabel': '.data-table__drawer-label',
  '.frange': '.data-table__drawer-range',
  '.df': '.data-table__drawer-foot',
  '.df .df-clear': '.data-table__drawer-foot .data-table__drawer-clear',
};

/** Lit rules NOT ported, with why: what they style is not part of this component. */
const DROPPED: Record<string, string> = {};
const drop = (reason: string, ...rules: string[]) => rules.forEach((r) => (DROPPED[r] = reason));
drop(
  'FIX-UI-DATATABLE-CLIP: its one-line «…» cut card titles that fit in two lines; `.data-table__card-title` wraps instead',
  '.rcard-head .rc-title',
);
drop(
  'filters panel: its scrim is never painted, the panel pushes the list from 834 px and is a whole sheet below (outfitkit kept it for a browser without media queries)',
  '.tk-scrim',
  '@media (min-width: 834px) || .card.has-panel > .tk-scrim',
  '@media (max-width: 833.98px) || .tk-scrim',
);
drop(
  'filters panel: one footer in both modes, «Clear» and «Apply» on a draft; no live server filters closed by «Show results»',
  '.df .df-done',
);
drop(
  'column filters: the filter row and the panel replace the old filter strip, a `date` filter is one day and a range is numeric (no date-range control nor pill)',
  '.daterange',
  '.daterange ion-input',
  '.tk-daterange',
  '.tk-daterange ion-icon',
  '.tk-daterange ion-input',
  '.tk-daterange .arr',
  '.filters-panel',
  '.filters-grow',
  '.filters-grow input, .filters-grow select',
  '.range',
);
drop('never painted by the Lit render either (dead CSS in the original)', '.panel', '.vsep', '.pager .nav .pp');
drop(
  'Ioan, 2026-10-13: the list/cards switch is an ion-segment, not a bordered box of square tool buttons (the only ones)',
  '.viewseg',
  '.viewseg ion-button',
);
drop('no effect: ion-searchbar is a scoped component, it exposes no shadow parts', 'ion-searchbar.ion-no-border::part(native)');

/** DataTable rules with no Lit twin, with why. */
const ADDED: Record<string, string> = {
  ':where(.data-table) ion-button': 'shell shield: Ionic ios host values the shadow root kept (measured)',
  ':where(.data-table) ion-button[fill="clear"]': 'shell shield: polish.css restyles clear buttons',
  ':where(.data-table) ion-button > ion-icon[slot="start"]': 'shell shield: Tailwind preflight zeroes Ionic’s slotted icon margin',
  ':where(.data-table) ion-select': 'shell shield: the select inherited the table’s --border-radius',
  ':where(.data-table) ion-card': 'shell shield: polish.css restyles ion-card',
  ':where(.data-table) ion-card-header': 'shell shield: preflight/polish.css change its padding',
  '.data-table :deep(*)': 'shell shield: the global `*` thin scrollbars never reached the shadow root',
  ':where(.data-table__search) .searchbar-input': 'shell shield: normalize.css line height on the inner input',
  ':where(.data-table__search) .searchbar-clear-button': 'shell shield: normalize/preflight font and cursor on the clear button',
  '.data-table__view-segment': 'Ioan, 2026-10-13: the list/cards ion-segment, at its own width in the toolbar',
  '.data-table__view-segment ion-segment-button': 'Ioan, 2026-10-13: icon-only segment buttons, as tall as the toolbar controls',
  '@media (pointer: coarse), (max-width: 834px) || .data-table__view-segment ion-segment-button':
    'Ioan, 2026-10-13: the segment buttons reach 44px on touch, like every other table control',
  '@media (min-width: 641px) and (max-width: 1024px) || .data-table__search':
    'APP-BASE-1: without the spacer the line breaks at the search minimum, so at 820px the funnel no longer drops alone to a second line (measured in the Hub)',
  '.data-table__bar-main > :slotted(ion-select)':
    'DEMO-F05: a filter select the page puts in the `filters` (or `toolbar`) slot is boxed like the table’s own selects',
  '.data-table__actions .data-table__action--labelled':
    'mockups/saas-panel §3b, §6.16: a `showLabel` row action, icon and text, as mock.css `.dt-labeled` paints it',
  '.data-table__action--labelled > [slot="start"]': 'mockups/saas-panel §6.16: the gap between its icon (or spinner) and its text',
  '.data-table__filters': 'column filters: the row of controls under the toolbar, wrapping (hub-next apps/tax/UI-REQUESTS.md)',
  '.data-table__filter-range': 'column filters: the From and To of a range, side by side',
  '.data-table__filter-range .data-table__filter': 'column filters: each end of a range is a short number box',
  '.data-table__filters-clear': 'column filters: «Clear filters», an ion-chip in the row, at its font size',
  '.data-table__drawer-range > ion-input':
    'FIX-UI-DATATABLE-CLIP: the two ends of a range share the 360px panel (two date fields reached 21px past it, measured in Chromium)',
  '.data-table__pager--phone-pages':
    'FIX-SAAS-SESSIONS-RESULT-TOO-BIG: a phone past `maxWindow` pages; its footer wraps the nav to a line of its own if the count needs it',
  '.data-table__pager--phone-pages .data-table__pager-nav': 'FIX-SAAS-SESSIONS-RESULT-TOO-BIG: that nav stays at the end of its line',
  '.data-table__page-of': 'FIX-SAAS-SESSIONS-RESULT-TOO-BIG: «page / pages» between previous and next on that phone',
  '.data-table__card-title':
    'FIX-UI-DATATABLE-CLIP: the card title wraps, two lines at most (Polaris, Material), instead of the Lit one-line «…»',
  '.data-table__field-text':
    'FIX-UI-DATATABLE-CARD-LONG-VALUE-CLIP: a card value’s own box, which ends a word too long for the card in «…» (a 54-character email ran past it, measured in Chromium)',
  '.data-table__field-text--unfolded': 'FIX-UI-DATATABLE-CARD-LONG-VALUE-CLIP: a tapped clipped card value unfolds in place, as a cell does (#217)',
  '@media (max-width: 833.98px) || .data-table__drawer-foot':
    'outfitkit#197: a sheet that reaches the screen edge keeps the safe area in its footer (a tab bar below keeps it already)',
  '@media (max-width: 640px) || .data-table--fill:not(.data-table--content-after)':
    '#218 on a phone, with nothing after the table: it grows with its rows instead of clipping them (measured at 390px)',
  '.data-table ion-checkbox': 'UX audit 2, R-13: a 24×24 selection box (Ionic ios paints 22)',
  '@media (pointer: coarse), (max-width: 834px) || .data-table ion-checkbox':
    'UX audit 2, R-13: a 44×44 target on touch, the row as tall as before',
  ':where(.data-table__search) ion-searchbar:focus-within, :where(.data-table__search) ion-searchbar.searchbar-has-focus':
    'UX audit 2, R-12: the focused search box shows it (the Lit box changed 0 pixels)',
};

/** Declarations a port carries on top of its Lit rule, with why. */
const EXTRA: Record<string, string[]> = {
  '.data-table': [
    // The phone filters sheet's insets and safe area (useFilterSheet, outfitkit#197): the Lit host set them inline.
    '--data-table-sheet-top: 0px',
    '--data-table-sheet-bottom: 0px',
    '--data-table-sheet-safe-bottom: env(safe-area-inset-bottom, 0px)',
    // The frame polish.css gave the Lit host.
    'box-shadow: var(--ep-shadow-sm)',
    'overflow: hidden',
  ],
  '.data-table__title': ['letter-spacing: inherit'], // polish.css `h2` never reached the shadow root
  '.data-table__selection-clear': ['padding: revert'], // normalize.css `button { padding: 0 }` neither
  // Ionic clips its native button: the count pill on the corner was cut in half (measured in Chromium).
  '.data-table__filter-button': ['--overflow: visible'],
  // A flex item never shrinks below its longest word: a long email ran past its card (FIX-UI-DATATABLE-CARD-LONG-VALUE-CLIP).
  '.data-table__field-value': ['min-width: 0'],
};

const LIT = parse(litCss);
const scoped = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '';
const weak = source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const VUE = new Map([...parse(scoped), ...parse(weak)]);

describe('DataTable stylesheet ↔ the Lit original, rule by rule', () => {
  it('the fixture is the whole Lit stylesheet (143 rules)', () => {
    expect(LIT.size).toBe(143);
  });

  it('every Lit rule is ported or dropped with a reason — never silently lost', () => {
    const unaccounted = [...LIT.keys()].filter((k) => !(k in PORTED) && !(k in DROPPED));
    expect(unaccounted).toEqual([]);
  });

  it('every ported rule has exactly the Lit declarations, in order (--ok-* resolved as the shell paints them)', () => {
    const mismatches: string[] = [];
    for (const [lit, vue] of Object.entries(PORTED)) {
      const from = LIT.get(lit);
      const to = VUE.get(vue);
      if (!from) mismatches.push(`no Lit rule «${lit}»`);
      if (!to) mismatches.push(`no DataTable rule «${vue}» (port of «${lit}»)`);
      if (!from || !to) continue;
      const extras = EXTRA[vue] ?? [];
      const expected = from.declarations.map(resolveOkTokens);
      const actual = to.declarations.filter((d) => !extras.includes(d));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push(`«${vue}»\n    Lit: ${expected.join('; ')}\n    Vue: ${actual.join('; ')}`);
      }
      for (const extra of extras) if (!to.declarations.includes(extra)) mismatches.push(`«${vue}» lost its extra «${extra}»`);
    }
    expect(mismatches.join('\n')).toBe('');
  });

  it('every DataTable rule is a port or a listed addition — nothing invented', () => {
    const ported = new Set(Object.values(PORTED));
    const invented = [...VUE.keys()].filter((k) => !ported.has(k) && !(k in ADDED));
    expect(invented).toEqual([]);
  });

  it('the toolbar selects are the Lit rules, word for word (the list/cards switch is an ion-segment now)', () => {
    const body = (k: string) => VUE.get(k)?.declarations.join('; ');
    expect(VUE.has('.data-table__view-switch')).toBe(false);
    expect(VUE.has('.data-table__tool-button')).toBe(false);
    expect(body('.data-table__columns-select')).toBe(
      'min-width: 6.5rem; max-width: 9rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem',
    );
    expect(body('.data-table__page-size-select')).toBe(
      'min-width: 4.25rem; max-width: 5.5rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem',
    );
  });
});
