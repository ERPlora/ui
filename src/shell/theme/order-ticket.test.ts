// CSS is not applied under happy-dom, so these read the rules of order-ticket.css themselves.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { compiledComponentCss } from '../../components/__tests__/themeContrast';
import {
  contentCardFaults,
  outweighs,
  pixels,
  rules,
  rulesFor,
  selectorsOf,
  specificity,
  themeSheet,
  valueOf,
} from './__tests__/sheetRules';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = themeSheet('order-ticket.css');

const TICKET = '.ep-order-ticket';
const STEPS = '.ep-order-ticket-steps';
/** The blocks of the sheet: the ticket, the popover of its secondary steps and the colour dot of a station. */
const BLOCKS = [TICKET, '.ep-station-dot'];
/** The ion-list of a menu, made heavier by polish.css (`ion-list.list-md`) than Ionic's own mode class. */
const POLISHED_LIST: [number, number] = specificity('ion-list.list-md');
const DONE = ['ready', 'served', 'voided', 'cancelled'];

/** The selectors of `css` that style what is inside `block`. */
const inside = (block: string): string[] => selectorsOf(css).filter((selector) => selector.startsWith(`${block} `));

describe('order-ticket.css: the visual language of an order ticket', () => {
  it('styles nothing but its own blocks', () => {
    const selectors = selectorsOf(css);
    expect(selectors.length).toBeGreaterThan(30);
    expect(selectors.filter((selector) => !BLOCKS.some((block) => selector.startsWith(block)))).toEqual([]);
  });

  it('gives every part of the ticket the weight of its block on top of its own, so no mode class of Ionic wins', () => {
    const parts = selectorsOf(css).filter((selector) => selector.includes('__') || selector.includes(' '));
    expect(parts.length).toBeGreaterThan(25);
    expect(inside(STEPS).length).toBeGreaterThan(0);
    expect(parts.filter((selector) => !outweighs(specificity(selector), POLISHED_LIST))).toEqual([]);
  });

  it('keeps the destination above the waiter when Ionic label styles load later', () => {
    const title = selectorsOf(css).find((selector) => selector.endsWith('.ep-order-ticket__title'));
    expect(title).toBeDefined();
    expect(outweighs(specificity(title!), specificity('.item .sc-ion-label-ios-h'))).toBe(true);
    expect(valueOf(css, title!, 'display')).toBe('flex');
    expect(valueOf(css, title!, 'flex-direction')).toBe('column');
  });

  it('keeps a menu’s name apart from its count of dishes when Ionic label styles load later', () => {
    const label = selectorsOf(css).find((selector) => selector.endsWith('.ep-order-ticket__menu-label'));
    expect(label).toBeDefined();
    expect(outweighs(specificity(label!), specificity('.item .sc-ion-label-ios-h'))).toBe(true);
    expect(valueOf(css, label!, 'display')).toBe('flex');
    expect(valueOf(css, label!, 'justify-content')).toBe('space-between');
  });

  it('sizes its status pills over StatusPill’s own sizes, whatever order the two sheets load in', () => {
    const pill = selectorsOf(css).filter((selector) => selector.endsWith('__pill'));
    expect(pill).toHaveLength(1);
    const own = rules(compiledComponentCss(join(HERE, '../../components/StatusPill/StatusPill.vue')))
      .filter((rule) => /(^|;)\s*(padding|font-size|font-weight)\s*:/.test(rule.body))
      .flatMap((rule) => rule.selectors)
      // The ticket never asks the pill for a size of its own.
      .filter((selector) => !selector.includes('[data-size'));
    expect(own.length).toBeGreaterThan(0);
    for (const selector of own) expect(outweighs(specificity(pill[0]), specificity(selector)), selector).toBe(true);
  });

  it('says how long a ticket waits in the stripe on top: green, amber or red', () => {
    expect(valueOf(css, `${TICKET} .ep-order-ticket__card`, 'border-top')).toBe('6px solid var(--order-ticket-sem)');
    const stripe = (sem: string) =>
      rulesFor(css, `${TICKET}[data-sem='${sem}']`)
        .map((rule) => /--order-ticket-sem:\s*([^;]+)/.exec(rule.body)?.[1].trim())
        .find(Boolean);
    expect([stripe('ok'), stripe('warning'), stripe('critical')]).toEqual([
      'var(--ion-color-success)',
      'var(--ion-color-warning)',
      'var(--ion-color-danger)',
    ]);
    expect(valueOf(css, `${TICKET}[data-sem='warning'] .ep-order-ticket__timer`, 'color')).toBe('var(--ep-warning-text)');
    expect(valueOf(css, `${TICKET}[data-sem='critical'] .ep-order-ticket__timer`, 'color')).toBe('var(--ep-danger-text)');
  });

  it('is an opaque content card: no glass, and colours only from the theme', () => {
    expect(contentCardFaults(css)).toEqual([]);
  });

  it('strikes the name of a dish once it is done or will not be cooked, and colours its state icon', () => {
    const struck = rules(css).find((rule) => rule.selectors.some((s) => s.endsWith('.ep-order-ticket__name') && s.includes('data-status')));
    expect(struck?.body).toContain('text-decoration: line-through');
    for (const status of DONE) expect(struck?.selectors.join(','), status).toContain(`[data-status='${status}']`);
    const icon = (status: string) =>
      rules(css).find((rule) => rule.selectors.some((s) => s.endsWith('__state') && s.includes(`[data-status='${status}']`)))?.body;
    expect(icon('ready')).toContain('var(--ep-success-text)');
    expect(icon('cancelled')).toContain('var(--ep-danger-text)');
  });

  it('marks an allergy inline with the danger tint and text that wraps', () => {
    const notice = `${TICKET} .ep-order-ticket__allergy`;
    expect(valueOf(css, notice, 'display')).toBe('flex');
    expect(valueOf(css, notice, 'color')).toBe('var(--ep-danger-text)');
    expect(valueOf(css, notice, 'background')).toContain('var(--ep-danger-tint)');
    expect(valueOf(css, `${notice} strong`, 'overflow-wrap')).toBe('anywhere');
    expect(valueOf(css, `${notice}-contains`, 'display')).toBe('block');
    expect(valueOf(css, `${notice}-contains`, 'overflow-wrap')).toBe('anywhere');
  });

  it('keeps every target of a cook’s finger at least 48 px', () => {
    expect(valueOf(css, `${TICKET} .ep-order-ticket__headline`, '--min-height')).toBe('var(--ep-touch-lg)');
    for (const [selector, property] of [
      [`${TICKET} .ep-order-ticket__dish`, '--min-height'],
      [`${TICKET} .ep-order-ticket__menu`, '--min-height'],
      [`${TICKET} .ep-order-ticket__foot ion-button`, 'min-height'],
      [`${STEPS} .ep-order-ticket-steps__list ion-item`, '--min-height'],
    ]) {
      expect(pixels(valueOf(css, selector, property)), selector).toBeGreaterThanOrEqual(48);
    }
  });

  it('rings the focused row of the ticket and of its steps', () => {
    const ring = rules(css).find((rule) => rule.selectors.every((s) => s.endsWith('.ion-focused::part(native)')));
    expect(ring?.body).toContain('outline: 3px solid var(--ion-color-primary)');
    expect(ring?.selectors).toHaveLength(4);
  });
});
