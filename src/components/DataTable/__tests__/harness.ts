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
