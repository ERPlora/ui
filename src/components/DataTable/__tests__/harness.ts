// Test harness of the DataTable: mounts it with the shell's i18n, the row-menu popover stubbed
// (Ionic overlays only present in a real browser) and a controllable viewport.
import { mount, type VueWrapper } from '@vue/test-utils';
import { vi } from 'vitest';
import { type Component, defineComponent, h, nextTick } from 'vue';

import { createShellI18n } from '../../../shell/i18n';
import DataTable from '../DataTable.vue';

/** `ion-popover` presents itself only in a real browser: the stub shows its content while open. */
export const PopoverStub = defineComponent({
  name: 'IonPopover',
  inheritAttrs: false,
  props: { isOpen: Boolean, event: { type: null, default: undefined } },
  emits: ['didDismiss'],
  setup(props, { slots, attrs }) {
    return () => (props.isOpen ? h('div', { ...attrs, 'data-stub': 'ion-popover' }, slots.default?.()) : null);
  },
});

type MediaListener = (e: { matches: boolean }) => void;
let mediaListeners: MediaListener[] = [];

/** happy-dom lays nothing out: the viewport is what this stub says (`true` = phone). */
export function viewport(mobile: boolean): void {
  mediaListeners = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: mobile,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: MediaListener) => mediaListeners.push(listener),
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

/**
 * happy-dom's `ResizeObserver` never reports anything. This one reports when the test says the
 * observed boxes changed size (`fire`), as the browser does after a layout: every observer that
 * still watches something gets one entry per target. Install it with `mockResizeObserver()`.
 */
export class ResizeObserverMock {
  static readonly live = new Set<ResizeObserverMock>();
  private readonly targets = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.live.add(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  /** Reports every observed target as resized (no-op when it watches nothing). */
  fire(): void {
    if (!this.targets.size) return;
    const entries = [...this.targets].map((target) => ({ target }) as ResizeObserverEntry);
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

/** Stubs `ResizeObserver`; `fire()` reports a resize of every observed box, in creation order. */
export function mockResizeObserver(): { fire: () => void } {
  ResizeObserverMock.live.clear();
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  return { fire: () => [...ResizeObserverMock.live].forEach((observer) => observer.fire()) };
}

/** Fires the breakpoint `change` the browser would send when the window crosses it. */
export function crossBreakpoint(matches: boolean): void {
  for (const listener of mediaListeners) listener({ matches });
}

/** Width of the table's box (the host and its scroller) that `playBackLayout` plays back. */
let box = 900;
let boxObservers: { fire: () => void } = { fire: () => {} };

/**
 * happy-dom lays nothing out. This plays a layout back on a wide screen: the table and its scroller are as
 * wide as the box (900px until a test says otherwise), every element is `button` px square, and an element's
 * `scrollWidth` is what `scrollWidth` answers for it in the box it has. `clearLayout()` undoes it.
 */
export function playBackLayout(button: number, scrollWidth: (el: Element, box: number) => number): void {
  viewport(false);
  box = 900;
  boxObservers = mockResizeObserver();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('data-table') || this.classList.contains('data-table__scroll') ? box : 0;
  });
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    return scrollWidth(this, box);
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width: button, height: button, top: 0, left: 0, right: button, bottom: button, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
}

/** The box is `width` px for the table mounted next, which measures it as it mounts. */
export function setBoxWidth(width: number): void {
  box = width;
}

/** The table's box takes `width` px (a side menu opening, a window resize…) and the table hears it. */
export async function resize(width: number): Promise<void> {
  box = width;
  boxObservers.fire();
  await settle();
}

/** Undoes the globals a test stubbed and empties the page. */
export function clearPage(): void {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
}

/** Undoes `playBackLayout`, with every other mock of the test, and empties the page. */
export function clearLayout(): void {
  vi.restoreAllMocks();
  clearPage();
}

/** The widest actions cell of the list: its buttons, `button` px each. */
export function actionButtonsWidth(scroll: Element, button: number): number {
  let buttons = 0;
  for (const cell of scroll.querySelectorAll('.data-table__row--data .data-table__actions')) {
    buttons = Math.max(buttons, [...cell.children].filter((el) => el.tagName === 'ION-BUTTON').length);
  }
  return buttons * button;
}

/** What a row needs for the template its head paints: each track at its minimum plus the side padding, never less than the box. */
export function templateWidth(scroll: Element, pad: number, trackMin: (track: string) => number): number {
  const head = scroll.querySelector<HTMLElement>('.data-table__row--head');
  const tracks = (head?.style.gridTemplateColumns ?? '').split(' ').filter(Boolean);
  return Math.max(pad + tracks.reduce((sum, track) => sum + trackMin(track), 0), box);
}

/** A text of a data cell or of a header is as wide as its characters, whatever its box; anything else is `undefined`. */
export function cellTextWidth(el: Element, char: number): number | undefined {
  if (el.tagName !== 'SPAN' || !el.parentElement?.matches('.data-table__cell:not(.data-table__cell--actions)')) return undefined;
  return (el.textContent?.trim().length ?? 0) * char;
}

export interface MountOptions {
  locale?: 'en' | 'es';
  slots?: Record<string, unknown>;
  attachTo?: HTMLElement;
  i18n?: boolean;
}

export type Table = VueWrapper;

export function mountTable(props: Record<string, unknown>, options: MountOptions = {}): Table {
  return mount(DataTable as unknown as Component, {
    props,
    slots: options.slots as never,
    attachTo: options.attachTo,
    global: {
      plugins: options.i18n === false ? [] : [createShellI18n({ locale: options.locale ?? 'en' })],
      stubs: { IonPopover: PopoverStub },
    },
  });
}

export interface PartOptions {
  locale?: 'en' | 'es';
  slots?: Record<string, string>;
}

/** A part of the table on its own, on the page, with the props it takes at rest and the ones a test turns on. */
export function mountPart(part: Component, atRest: Record<string, unknown>, props: Record<string, unknown> = {}, options: PartOptions = {}): Table {
  return mount(part, {
    props: { ...atRest, ...props },
    slots: options.slots,
    global: { plugins: [createShellI18n({ locale: options.locale ?? 'en' })] },
    attachTo: document.body,
  });
}

/** Lets Vue render and the post-render measurements land (a measurement may schedule one more). */
export async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** Collapsed whitespace text of an element. */
export const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The data rows of the list view. */
export const dataRows = (t: Table): HTMLElement[] =>
  [...t.element.querySelectorAll('.data-table__row--data')] as HTMLElement[];

/** The cards of the card view. */
export const cards = (t: Table): HTMLElement[] => [...t.element.querySelectorAll('.data-table__card')] as HTMLElement[];

/** Every element carrying the hook. */
export const byTestId = (t: Table, id: string): HTMLElement[] =>
  [...t.element.querySelectorAll(`[data-testid="${id}"]`)] as HTMLElement[];

/** What the person does in the search box: Ionic writes the value, then emits `ionInput`. */
export async function type(t: Table, value: string): Promise<void> {
  const bar = t.element.querySelector('ion-searchbar') as HTMLElement & { value?: string };
  bar.value = value;
  bar.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
  await settle();
}

/** Ionic's `ionChange` of a control (checkbox, select). */
export async function ionChange(el: Element, detail: Record<string, unknown> = {}): Promise<void> {
  el.dispatchEvent(new CustomEvent('ionChange', { detail }));
  await settle();
}

/** A click as the browser sends it. */
export async function click(el: Element | null | undefined): Promise<void> {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
}

/** A text clipped by its box (380px of text in 90px), or one that fits in it. */
export function clip(el: HTMLElement, clipped: boolean): void {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (clipped ? 380 : 90) });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 90 });
}

/** A tap with a finger or a click with a mouse, as the browser sends them. */
export async function tap(el: HTMLElement, pointerType: 'touch' | 'mouse'): Promise<void> {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType }));
  await click(el);
}

/** Three records with a name and a total, for the tests that only need a table on screen. */
export const ROWS = [
  { id: '1', name: 'Ana', total: '10,00 €' },
  { id: '2', name: 'Luis', total: '20,00 €' },
  { id: '3', name: 'Marta', total: '30,00 €' },
];
