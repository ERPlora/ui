// «Visually identical» to the Lit table as a mechanical check: EVERY rule of its stylesheet (a verbatim
// copy in `__tests__/lit-styles.css`) is either ported to a DataTable rule with the SAME declarations in
// the same order, or listed below as dropped with its reason; and every DataTable rule is either a port
// or listed as an addition with its reason. A declaration changed, added or lost fails here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  actionsSource,
  cardSource,
  identitySource,
  listSource,
  pagerSource,
  panelSource,
  rowSource,
  stateSource,
  tableSource as source,
} from './__tests__/part-sources';

// From disk: Vitest's CSS handling empties a `.css?raw` import.
const litCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__tests__/lit-styles.css'), 'utf8');
/** The scoped sheet the table's parts share (`<style scoped src="./controls.css">`). */
const controlsCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'controls.css'), 'utf8');

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
  // The phone sheet's insets the table measures and publishes (`useFilterSheet`).
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
  '.gcell > span': '.data-table__cell > .data-table__text',
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
  '.ractions': '.data-table__card-actions',
  '.ractions .actions': '.data-table__card-actions .data-table__actions',
  '.actions': '.data-table__actions',
  '.actions ion-button': '.data-table__actions ion-button',
  '.sr-only': '.data-table__sr-only',
  '@media (pointer: coarse), (max-width: 834px) || .add-btn': '@media (pointer: coarse), (max-width: 834px) || .data-table__add-button',
  '@media (pointer: coarse), (max-width: 834px) || .pager .nav ion-button': '@media (pointer: coarse), (max-width: 834px) || .data-table__pager-nav ion-button',
  '.actions ion-spinner': '.data-table__actions ion-spinner',
  '.pager': '.data-table__pager',
  '.pager .left': '.data-table__pager-info',
  '.pager .strong': '.data-table__pager-count',
  '.psize': '.data-table__pager-size',
  '.pager .nav': '.data-table__pager-nav',
  '.pnum': '.data-table__page',
  '.pnum:hover': '.data-table__page:hover',
  '.pnum.on': '.data-table__page.data-table__page--current',
  '.pgap': '.data-table__page-gap',
  'ion-button': 'ion-button',
  '.tk-filter': '.data-table__filter',
  // The filters panel (`filterable`): the funnel with its count, and its drawer inside the table.
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
  'its one-line «…» cut card titles that fit in two lines; `.data-table__card-title` wraps instead',
  '.rcard-head .rc-title',
);
drop(
  'status, description and icon-led metadata replace the label/value rows',
  '.rrow',
  '.rrow .rk',
  '.rrow .rv',
);
drop(
  'Ionic skeletons replace the spinner, and 44px targets apply at every width instead of a touch-only override',
  '.loading-state ion-spinner',
  '@media (pointer: coarse), (max-width: 834px) || .actions ion-button',
  '@media (pointer: coarse), (max-width: 834px) || .load-error ion-button',
);
drop(
  'filters panel: its scrim is never painted, the panel pushes the list from 834 px and is a whole sheet below (the Lit table kept it for a browser without media queries)',
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
drop('the next rows load at the end of the scroll (`ion-infinite-scroll`): there is no «Load more» button', '.pager .load-more');
drop(
  'the library’s EmptyState and InlineFeedback paint the empty list and the failed load; the table gives them room',
  '.empty',
  '.load-error',
  '.loading-state',
  '.load-error .load-error-title',
  '.load-error .empty-ic',
  '.load-error ion-button',
  '.empty .empty-ic, .load-error .empty-ic',
);
drop('a row action hidden for the row is not there: no invisible stand-in keeps its place', '.actions .action-gap');
drop('never painted by the Lit render either (dead CSS in the original)', '.panel', '.vsep', '.pager .nav .pp');
drop(
  'the list/cards switch is an ion-segment, not a bordered box of square tool buttons (the only ones)',
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
  '.data-table__view-segment': 'the list/cards ion-segment, at its own width in the toolbar',
  '.data-table__view-segment ion-segment-button': 'icon-only segment buttons, as tall as the toolbar controls',
  '@media (pointer: coarse), (max-width: 834px) || .data-table__view-segment ion-segment-button':
    'the segment buttons reach 44px on touch, like every other table control',
  '@media (min-width: 641px) and (max-width: 1024px) || .data-table__search':
    'without the spacer the line breaks at the search minimum, so at 820px the funnel no longer drops alone to a second line (measured in the Hub)',
  '.data-table__bar-main > :slotted(ion-select)':
    'a filter select the page puts in the `filters` (or `toolbar`) slot is boxed like the table’s own selects',
  '.data-table__actions .data-table__action--labelled':
    'a `showLabel` row action: its icon and its text side by side',
  '.data-table__action--labelled > [slot="start"]': 'the gap between a labelled action’s icon (or spinner) and its text',
  '.data-table__filters': 'column filters: the row of controls under the toolbar, wrapping',
  '.data-table__filter-range': 'column filters: the From and To of a range, side by side',
  '.data-table__filter-range .data-table__filter': 'column filters: each end of a range is a short number box',
  '.data-table__search :deep(.searchbar-input)':
    'the search box’s example text ends in «…» where the box is short of it (cut with no sign at 820px, measured in Chromium)',
  '.data-table__filter-range--date .data-table__filter':
    'each end of a date range is as wide as a date field (the calendar icon covered the last character, measured in Chromium)',
  '.data-table__filter-range-label':
    'the column heading a range in the row (its ends alone said only «From» / «To»; the Lit inline date range had no name on screen either)',
  '.data-table__filters-clear': 'column filters: «Clear filters», an ion-chip in the row, at its font size',
  '.data-table__drawer-range > ion-input':
    'the two ends of a range share the 360px panel (two date fields reached 21px past it, measured in Chromium)',
  '.data-table__pager--phone-pages':
    'a phone past `maxWindow` pages; its footer wraps the nav to a line of its own if the count needs it',
  '.data-table__pager--phone-pages .data-table__pager-nav': 'the nav of a paging phone stays at the end of its line',
  '.data-table__page-of': '«page / pages» between previous and next on a paging phone',
  '.data-table__card-title':
    'the card title wraps, two lines at most (Polaris, Material), instead of the Lit one-line «…»',
  '.data-table__row--data > .data-table__cell:not(.data-table__cell--actions)':
    'a data cell drops what does not fit under, instead of squeezing a chip beside a badge to its icon (measured in Chromium at 820/834 px)',
  '.data-table__field-text':
    'a card value’s own box, which ends a word too long for the card in «…» (a 54-character email ran past it, measured in Chromium)',
  '.data-table__field-text--unfolded': 'a tapped clipped card value unfolds in place, as a cell does',
  '@media (max-width: 833.98px) || .data-table__drawer-foot':
    'a sheet that reaches the screen edge keeps the safe area in its footer (a tab bar below keeps it already)',
  '@media (max-width: 640px) || .data-table--fill:not(.data-table--content-after)':
    'on a phone, with nothing after the table: it grows with its rows instead of clipping them (measured at 390px)',
  '.data-table ion-checkbox': 'a 24×24 selection box (Ionic ios paints 22)',
  '@media (pointer: coarse), (max-width: 834px) || .data-table ion-checkbox':
    'a 44×44 target on touch, without making the row taller',
  ':where(.data-table__search) ion-searchbar:focus-within, :where(.data-table__search) ion-searchbar.searchbar-has-focus':
    'the focused search box shows it (the Lit box changed 0 pixels)',
  '.data-table > .data-table__surface': 'a subtle theme border around the shared table surface',
  '.data-table > .data-table__surface > .data-table__bar, .data-table > .data-table__surface > .data-table__pager':
    'quieter toolbar and footer relief, derived from the current theme',
  '.data-table__pager-nav > ion-button.data-table__page': 'numbered pages are Ionic buttons with 44px touch targets',
  '.data-table__pager-nav > ion-button.data-table__page.data-table__page--current': 'the current Ionic page button uses the primary tint',
  '.data-table > .data-table__surface > .data-table__pager > .data-table__pager-info > .data-table__pager-size':
    'the standalone rows-per-page control is Ionic too',
  '.data-table__cell--header > span': 'only header text is clipped; slotted status content can wrap',
  '.data-table__cell > :deep(span)': 'slotted content can shrink without hiding its status text',
  '@media (prefers-reduced-motion: reduce) || .data-table__row--data:hover, .data-table__row--data:active':
    'row motion is disabled with reduced motion in its own component',
  '.data-table__actions .data-table__action--main': 'the card’s main action reads as such',
  '.data-table__empty, .data-table__error, .data-table__loading': 'the table gives the library’s notices their room',
  '.data-table__loading': 'the skeletons sit centred under their label',
  '.data-table__empty ion-button, .data-table__error ion-button': 'the empty and failed states’ actions have a 44px target',
  '.data-table__loading-label': 'the skeleton loading state keeps its visible loading label',
  '.data-table__skeletons': 'loading placeholders follow the responsive card grid',
  '.data-table__skeleton-card': 'a loading placeholder preserves the card shape',
  '.data-table__skeleton-icon': 'the placeholder icon matches the tiled card icon',
  '.data-table__skeleton-lines': 'placeholder lines occupy the card content',
  '.data-table__skeleton-lines ion-skeleton-text': 'Ionic skeletons paint the placeholder lines',
  '.data-table__card-status': 'the status sits under the card heading without a field label',
  '.data-table__card-description': 'the description is a full-width paragraph',
  '.data-table__card-meta': 'secondary values form discreet icon-led lines',
  '.data-table__card-meta-icon': 'metadata uses the baked icon of its column',
  '.data-table__card-meta-label': 'the field name remains available to assistive technology',
  '.data-table__card-meta-value': 'metadata text can shrink and unfold without clipping',
  '.data-table__card-actions :deep(.data-table__action--main)': 'the card’s main action takes the available width',
  '.data-table__identity': 'the shared identity cell aligns its icon and text',
  '.data-table__identity-icon': 'the identity icon uses the theme tile',
  '.data-table__identity-text': 'the identity text can shrink around its icon',
  '.data-table__identity-title': 'the identity name wraps in the theme text colour',
  '.data-table__identity-subtitle': 'the second line uses the accessible muted token',
  '.data-table__cell-note': 'why a cell’s switch cannot change sits under it, from the cell’s start edge',
  '.data-table__cell-note--danger': 'a failure note reads in the danger text token',
  '.data-table__card-note--danger, .data-table__card-note--danger .data-table__card-meta-icon, .data-table__card-note--danger .data-table__card-meta-value':
    'a failure note on a card reads in the danger text token',
};

/** Declarations a port carries on top of its Lit rule, with why. */
const EXTRA: Record<string, string[]> = {
  '.data-table': [
    // The phone filters sheet's insets and safe area (useFilterSheet): the Lit host set them inline.
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
  '.data-table__actions ion-button': ['min-width: 44px', 'min-height: 44px', 'margin: 0'],
};

// The focused presentation deliberately changes these declarations; every other port stays verbatim.
const RESTYLED: Record<string, string[]> = {
  ':where(.data-table__search) ion-searchbar': ['--background: var(--background)', '--border-radius: 10px', 'padding: 0', 'min-height: 44px'],
  '.data-table__add-button': ['min-height: 44px', '--border-radius: 10px', '--padding-start: 0.9rem', '--padding-end: 1rem', 'margin: 0', 'font-weight: 600'],
  '.data-table__columns-select': ['min-width: 6.5rem', 'max-width: 9rem', 'min-height: 44px', 'font-size: 13px', 'background: var(--background)', 'color: var(--color)', 'border: 1px solid var(--control-border)', 'border-radius: 10px', '--padding-start: 0.6rem', '--padding-end: 0.4rem', '--padding-top: 0.3rem', '--padding-bottom: 0.3rem'],
  '.data-table__page-size-select': ['min-width: 4.25rem', 'max-width: 5.5rem', 'min-height: 44px', 'font-size: 13px', 'background: var(--background)', 'color: var(--color)', 'border: 1px solid var(--control-border)', 'border-radius: 10px', '--padding-start: 0.6rem', '--padding-end: 0.4rem', '--padding-top: 0.35rem', '--padding-bottom: 0.35rem'],
  '.data-table__filter': ['min-width: 8.5rem', 'max-width: 13rem', 'min-height: 44px', 'font-size: 13px', 'background: var(--background)', 'color: var(--color)', 'border: 1px solid var(--control-border)', 'border-radius: 10px', '--padding-start: 0.7rem', '--padding-end: 0.5rem', '--padding-top: 0.35rem', '--padding-bottom: 0.35rem'],
  '.data-table__filter-button': ['position: relative', '--padding-start: 0', '--padding-end: 0', '--border-radius: 10px', 'width: 44px', 'height: 44px', 'margin: 0'],
  '.data-table__card-icon': ['display: inline-grid', 'place-items: center', 'flex: none', 'width: 44px', 'height: 44px', 'border-radius: var(--ep-radius-sm)', 'color: var(--ep-primary-text)', 'background: var(--ep-primary-tint)', 'font-size: 22px'],
  '.data-table__row--data': ['min-height: 80px', 'background: var(--background)', 'border-bottom: 1px solid var(--border-color-soft)', 'padding-top: 0.75rem', 'padding-bottom: 0.75rem', 'transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease), box-shadow var(--ep-transition, 150ms ease), transform 120ms ease'],
  '.data-table__card-body': ['display: flex', 'flex: 1 1 auto', 'flex-direction: column', 'gap: 0.75rem'],
  // A table that fills its page and ends after its last whole row keeps its pager at the bottom.
  '.data-table__pager': ['display: flex', 'align-items: center', 'justify-content: space-between', 'gap: 0.75rem', 'margin-top: auto', 'padding: 0.55rem 1rem', 'border-top: 1px solid var(--border-color)', 'background: var(--header-background)', 'font-size: 12.5px', 'color: var(--color-muted)'],
  // Cards of a grid row are as tall as the tallest, with their footers on one line, and wide enough for a head with a switch.
  '.data-table__cards': ['display: grid', 'grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr))', 'gap: 0.75rem', 'padding: 1rem', 'grid-auto-rows: max-content', 'align-content: start', 'align-items: stretch'],
  'ion-card.data-table__card': ['display: flex', 'flex-direction: column', 'margin: 0'],
  '.data-table__card-actions': ['display: flex', 'justify-content: flex-end', 'gap: 0.25rem', 'padding: 0.75rem', 'border-top: 1px solid var(--border-color-soft)'],
  '.data-table__card-actions .data-table__actions': ['width: 100%', 'flex-wrap: nowrap'],
};

const LIT = parse(litCss);
const scoped = [source, cardSource, listSource, actionsSource, stateSource, identitySource, pagerSource, panelSource, rowSource]
  .map((input) => input.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '')
  .concat(controlsCss)
  .join('\n');
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

  it('ported rules keep the Lit declarations except for the listed focused restyling', () => {
    const mismatches: string[] = [];
    for (const [lit, vue] of Object.entries(PORTED)) {
      const from = LIT.get(lit);
      const to = VUE.get(vue);
      if (!from) mismatches.push(`no Lit rule «${lit}»`);
      if (!to) mismatches.push(`no DataTable rule «${vue}» (port of «${lit}»)`);
      if (!from || !to) continue;
      const extras = EXTRA[vue] ?? [];
      const expected = RESTYLED[vue] ?? from.declarations.map(resolveOkTokens);
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

  it('the toolbar selects keep the Lit layout with 44px targets and an ion-segment', () => {
    const body = (k: string) => VUE.get(k)?.declarations.join('; ');
    expect(VUE.has('.data-table__view-switch')).toBe(false);
    expect(VUE.has('.data-table__tool-button')).toBe(false);
    expect(body('.data-table__columns-select')).toBe(
      'min-width: 6.5rem; max-width: 9rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem',
    );
    expect(body('.data-table__page-size-select')).toBe(
      'min-width: 4.25rem; max-width: 5.5rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem',
    );
  });
});
