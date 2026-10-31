// Combo — an ion-input with a searchable dropdown (hub-next apps/tax/UI-REQUESTS.md: the `ok-combo`
// of today, for the 249 countries of a tax rule and the categories, which the server pages): the
// options as a listbox in an ion-popover, filtered while typing (static `options`) or asked for
// (`search(query)`, debounced 150 ms, with its loading, empty and error states), arrow keys + Enter,
// Escape, `v-model` of the chosen `{ id, label, hint? }`, clearable, and «Create …» when allowed.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import HubIcon from '../../shell/HubIcon.vue';
import Combo from './Combo.vue';
import type { ComboOption } from './types';

/** `ion-popover` presents itself only in a real browser: the stub shows its content while open. */
const PopoverStub = defineComponent({
  name: 'IonPopover',
  inheritAttrs: false,
  props: { isOpen: Boolean, event: { type: null, default: undefined } },
  emits: ['didDismiss', 'willPresent'],
  setup(props, { slots, attrs }) {
    return () => (props.isOpen ? h('div', { ...attrs, 'data-stub': 'ion-popover' }, slots.default?.()) : null);
  },
});

const COUNTRIES: ComboOption[] = [
  { id: 'ES', label: 'España', hint: 'ES' },
  { id: 'FR', label: 'Francia', hint: 'FR' },
  { id: 'PT', label: 'Portugal', hint: 'PT' },
  { id: 'DE', label: 'Alemania', hint: 'DE' },
];

type Wrapper = ReturnType<typeof mountCombo>;
type El = HTMLElement & Record<string, unknown>;

function mountCombo(props: Record<string, unknown> = {}, locale = 'en') {
  return mount(Combo, {
    props: { label: 'Country', options: COUNTRIES, testid: 'country', ...props },
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })], stubs: { IonPopover: PopoverStub } },
  });
}

/** Lets Vue render and Ionic's ion-input load (it renders its native input asynchronously). */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await flushPromises();
  }
}

const field = (w: Wrapper) => w.get('ion-input[data-testid="country"]');
const native = (w: Wrapper) => field(w).element.querySelector('input') as HTMLInputElement;
const popover = (w: Wrapper) => w.find('[data-stub="ion-popover"]');
const options = (w: Wrapper) => popover(w).findAll('[role="option"]');
/** Stencil's slot patch hides `textContent` of ion-label under happy-dom: read its markup. */
const labelText = (el: Element) => el.innerHTML.replace(/<!--[\s\S]*?-->/g, '').trim();
/** The options' labels, without their hints. */
const optionLabels = (w: Wrapper) => options(w).map((o) => labelText(o.get('ion-label').element).replace(/<p[\s>][\s\S]*<\/p>/, '').trim());

async function typeIn(w: Wrapper, value: string) {
  field(w).element.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
  await settle();
}
async function key(w: Wrapper, k: string) {
  native(w).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  await settle();
}
/** Presses a key in the field and tells what the page around the combo saw of it: whether its
 *  default was prevented, and whether it reached `document.body` (where a FormModal's Enter lands). */
async function pressFromPage(w: Wrapper, k: string): Promise<{ prevented: boolean; reachedPage: boolean }> {
  let reachedPage = false;
  const listen = () => (reachedPage = true);
  document.body.addEventListener('keydown', listen);
  const press = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  native(w).dispatchEvent(press);
  document.body.removeEventListener('keydown', listen);
  await settle();
  return { prevented: press.defaultPrevented, reachedPage };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('Combo: the field', () => {
  it('is an ion-input in md with the outline fill, its label floating, and the chosen option as its text', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0], placeholder: 'Pick a country' });
    await settle();
    const input = field(w).element as El;
    expect(field(w).attributes('mode')).toBe('md');
    expect(input.fill).toBe('outline');
    expect(input.label).toBe('Country');
    expect(input.labelPlacement).toBe('floating');
    expect(input.placeholder).toBe('Pick a country');
    expect(input.value).toBe('España');
  });

  it('is a combobox for assistive tech: role, list autocomplete, the listbox it controls, collapsed', async () => {
    const w = mountCombo();
    await settle();
    const input = native(w);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-controls')).toMatch(/^ep-combo-.+-listbox$/);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('shows the error text of the form under the field', async () => {
    const w = mountCombo({ errorText: 'Pick a country' });
    await settle();
    expect((field(w).element as El).errorText).toBe('Pick a country');
    // Ionic paints the error text only on an invalid, touched field.
    expect(field(w).classes()).toEqual(expect.arrayContaining(['ion-invalid', 'ion-touched']));
    const fine = mountCombo();
    await settle();
    expect(field(fine).classes()).not.toContain('ion-invalid');
  });
});

describe('Combo: static options', () => {
  it('a click opens every option, in order, each with its hint', async () => {
    const w = mountCombo();
    await settle();
    expect(popover(w).exists()).toBe(false);
    await field(w).trigger('click');
    await settle();
    expect(popover(w).exists()).toBe(true);
    expect(optionLabels(w)).toEqual(['España', 'Francia', 'Portugal', 'Alemania']);
    expect(options(w)[0].get('ion-label p').element.innerHTML.trim()).toBe('ES');
    expect(native(w).getAttribute('aria-expanded')).toBe('true');
    const listbox = popover(w).get('[role="listbox"]');
    expect(listbox.attributes('id')).toBe(native(w).getAttribute('aria-controls'));
    expect(listbox.attributes('aria-label')).toBe('Country');
  });

  it('opens under the field, as wide as it, without taking the focus from it', async () => {
    const w = mountCombo();
    await settle();
    await field(w).trigger('click');
    await settle();
    const stub = w.getComponent(PopoverStub);
    expect((stub.props('event') as { target?: Element }).target).toBe(field(w).element);
    const attrs = popover(w).attributes();
    expect(attrs.side).toBe('bottom');
    expect(attrs.alignment).toBe('start');
    expect(attrs.size).toBe('cover');
    expect(attrs['keyboard-close']).toBe('false');
    expect(attrs['focus-trap']).toBe('false');
    expect(attrs['show-backdrop']).toBe('false');
  });

  it('typing filters by «contains», ignoring case and accents, on the label and the hint', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'espa');
    expect(optionLabels(w)).toEqual(['España']);
    await typeIn(w, 'AN');
    expect(optionLabels(w)).toEqual(['España', 'Francia', 'Alemania']);
    await typeIn(w, 'pt');
    expect(optionLabels(w)).toEqual(['Portugal']);
  });

  it('nothing found: says so (its own text when given)', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'zz');
    expect(options(w)).toHaveLength(0);
    expect(popover(w).get('[data-testid="country-empty"]').text()).toBe('No matches');
    const own = mountCombo({ emptyLabel: 'No such country' });
    await settle();
    await typeIn(own, 'zz');
    expect(popover(own).get('[data-testid="country-empty"]').text()).toBe('No such country');
  });

  it('a click on an option chooses it: v-model, its label in the field, closed', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'port');
    await options(w)[0].trigger('click');
    await settle();
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[2]]]);
    expect((field(w).element as El).value).toBe('Portugal');
    expect(popover(w).exists()).toBe(false);
    expect(native(w).getAttribute('aria-expanded')).toBe('false');
  });

  // Measured in Chrome: Ionic 8's present() blurs the focused element before any overlay shows, so
  // the next keys went to <body>. The field takes the focus back as the popover is about to show.
  it('keeps the focus in the field when Ionic presents the popover (it blurs whatever had it)', async () => {
    const w = mountCombo();
    await settle();
    native(w).focus();
    await field(w).trigger('click');
    await settle();
    native(w).blur();
    expect(document.activeElement).not.toBe(native(w));
    w.getComponent(PopoverStub).vm.$emit('willPresent');
    await settle();
    expect(document.activeElement).toBe(native(w));
  });

  it('a press on an option keeps the focus in the field (the click still lands)', async () => {
    const w = mountCombo();
    await settle();
    await field(w).trigger('click');
    await settle();
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    options(w)[1].element.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
  });

  it('follows the v-model the page sets', async () => {
    const w = mountCombo({ modelValue: null });
    await settle();
    await w.setProps({ modelValue: COUNTRIES[1] });
    await settle();
    expect((field(w).element as El).value).toBe('Francia');
  });
});

describe('Combo: the keyboard', () => {
  it('ArrowDown opens; the arrows move the highlight (wrapping), told by aria-activedescendant', async () => {
    const w = mountCombo();
    await settle();
    await key(w, 'ArrowDown');
    expect(popover(w).exists()).toBe(true);
    const active = () => options(w).findIndex((o) => o.classes().includes('combo__option--active'));
    expect(active()).toBe(0);
    expect(native(w).getAttribute('aria-activedescendant')).toBe(options(w)[0].attributes('id'));
    expect(options(w)[0].attributes('aria-selected')).toBe('true');
    expect(options(w)[1].attributes('aria-selected')).toBe('false');
    await key(w, 'ArrowDown');
    expect(active()).toBe(1);
    await key(w, 'ArrowUp');
    await key(w, 'ArrowUp');
    expect(active()).toBe(3);
    await key(w, 'ArrowDown');
    expect(active()).toBe(0);
    expect(native(w).getAttribute('aria-activedescendant')).toBe(options(w)[0].attributes('id'));
  });

  it('Enter chooses the highlighted option (the first match while typing), and does not submit the form around it', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'a');
    await key(w, 'ArrowDown');
    const outside = vi.fn();
    document.body.addEventListener('keydown', outside);
    await key(w, 'Enter');
    expect(outside).not.toHaveBeenCalled();
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[1]]]);
    expect(popover(w).exists()).toBe(false);
    // Closed, Enter is the form's again.
    await key(w, 'Enter');
    expect(outside).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('keydown', outside);
  });

  // FIX-UI-COMBO-ENTER-WHILE-SEARCHING-SUBMITS: an open list with nothing to choose let Enter through,
  // and the FormModal around it saved. Open, Enter is always the combo's (WAI-ARIA APG, Headless UI,
  // React Aria, Downshift, Tom Select…); with no option to take, it does nothing and the list stays.
  it('Enter on an open list with nothing to choose (no matches) stays here: no submit, the list stays open', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'zz');
    expect(popover(w).find('[data-testid="country-empty"]').exists()).toBe(true);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(popover(w).exists()).toBe(true);
    expect((field(w).element as El).value).toBe('zz');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(w.emitted('create')).toBeUndefined();
  });

  it('Enter on a closed list is the form’s: it reaches the page around the combo, untouched', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    expect(popover(w).exists()).toBe(false);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: false, reachedPage: true });
    expect(popover(w).exists()).toBe(false);
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('Escape closes and puts back the chosen option’s label; it does not reach the dialog around it', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'fra');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const outside = vi.fn();
    document.body.addEventListener('keydown', outside);
    native(w).dispatchEvent(escape);
    await settle();
    expect(escape.defaultPrevented).toBe(true);
    expect(outside).not.toHaveBeenCalled();
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe('España');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('Tab closes it and moves on (puts back the chosen label)', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'fra');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    native(w).dispatchEvent(tab);
    await settle();
    expect(tab.defaultPrevented).toBe(false);
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe('España');
  });

  it('a dismissal of the popover (a tap outside) closes it the same way', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'fra');
    w.getComponent(PopoverStub).vm.$emit('didDismiss');
    await settle();
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe('España');
  });
});

describe('Combo: clearable', () => {
  it('a Clear button while something is chosen: empties the v-model and the field', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    const clear = w.get('[data-testid="country-clear"]');
    expect(clear.isVisible()).toBe(true);
    expect(clear.attributes('slot')).toBe('end');
    // ion-button hands its aria-label to its native button.
    expect(clear.element.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe('Clear');
    expect(clear.getComponent(HubIcon).props('name')).toBe('ion:close-circle-outline');
    await clear.trigger('click');
    await settle();
    expect(w.emitted('update:modelValue')).toEqual([[null]]);
    expect((field(w).element as El).value).toBe('');
  });

  it('no Clear without a choice, when not clearable, or disabled', async () => {
    for (const props of [{ modelValue: null }, { modelValue: COUNTRIES[0], clearable: false }, { modelValue: COUNTRIES[0], disabled: true }]) {
      const w = mountCombo(props);
      await settle();
      expect(w.get('[data-testid="country-clear"]').isVisible(), JSON.stringify(props)).toBe(false);
    }
  });

  it('disabled: the field is disabled and nothing opens', async () => {
    const w = mountCombo({ disabled: true });
    await settle();
    expect((field(w).element as El).disabled).toBe(true);
    await field(w).trigger('click');
    await key(w, 'ArrowDown');
    expect(popover(w).exists()).toBe(false);
  });
});

describe('Combo: «Create …» (allowCreate)', () => {
  it('offers to create what was typed, last; choosing it emits create with the text and keeps it in the field', async () => {
    const w = mountCombo({ allowCreate: true });
    await settle();
    await typeIn(w, ' Andorra ');
    expect(options(w)).toHaveLength(1);
    const create = popover(w).get('[data-testid="country-create"]');
    expect(create.attributes('role')).toBe('option');
    expect(labelText(create.get('ion-label').element)).toBe('Create “Andorra”');
    await key(w, 'Enter');
    expect(w.emitted('create')).toEqual([['Andorra']]);
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe(' Andorra ');
  });

  it('not for an empty text nor one that names an option already', async () => {
    const w = mountCombo({ allowCreate: true });
    await settle();
    await typeIn(w, 'francia');
    expect(popover(w).find('[data-testid="country-create"]').exists()).toBe(false);
    await typeIn(w, '  ');
    expect(popover(w).find('[data-testid="country-create"]').exists()).toBe(false);
  });

  it('speaks Spanish', async () => {
    const w = mountCombo({ allowCreate: true }, 'es');
    await settle();
    await typeIn(w, 'Andorra');
    expect(labelText(popover(w).get('[data-testid="country-create"] ion-label').element)).toBe('Crear «Andorra»');
    await typeIn(w, 'zz-nada');
    const empty = mountCombo({}, 'es');
    await settle();
    await typeIn(empty, 'zz');
    expect(popover(empty).get('[data-testid="country-empty"]').text()).toBe('Sin coincidencias');
  });
});

describe('Combo: asking the server (search)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  it('waits 150 ms after the last key, asks once with the text, and paints the answer', async () => {
    const search = vi.fn((query: string) => Promise.resolve(COUNTRIES.filter((c) => c.label.toLowerCase().includes(query))));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'f');
    await typeIn(w, 'fr');
    vi.advanceTimersByTime(149);
    expect(search).not.toHaveBeenCalled();
    expect(popover(w).find('[data-testid="country-loading"]').exists()).toBe(true);
    expect(popover(w).get('[role="listbox"]').attributes('aria-busy')).toBe('true');
    vi.advanceTimersByTime(1);
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('fr');
    expect(optionLabels(w)).toEqual(['Francia']);
    expect(popover(w).find('[data-testid="country-loading"]').exists()).toBe(false);
  });

  it('opening asks with an empty text (the first page of the server)', async () => {
    const search = vi.fn(() => Promise.resolve(COUNTRIES.slice(0, 2)));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await field(w).trigger('click');
    vi.advanceTimersByTime(150);
    await settle();
    expect(search).toHaveBeenCalledWith('');
    expect(optionLabels(w)).toEqual(['España', 'Francia']);
  });

  it('an older answer that arrives late never replaces a newer one', async () => {
    let answerFirst: (options: ComboOption[]) => void = () => {};
    const search = vi
      .fn<(query: string) => Promise<ComboOption[]>>()
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockImplementationOnce(() => Promise.resolve([COUNTRIES[2]]));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'p');
    vi.advanceTimersByTime(150);
    await typeIn(w, 'po');
    vi.advanceTimersByTime(150);
    await settle();
    answerFirst([COUNTRIES[0]]);
    await settle();
    expect(optionLabels(w)).toEqual(['Portugal']);
  });

  it('a failed search says so and offers to retry', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const search = vi.fn<(query: string) => Promise<ComboOption[]>>().mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([COUNTRIES[3]]);
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'al');
    vi.advanceTimersByTime(150);
    await settle();
    expect(popover(w).get('[data-testid="country-error"]').text()).toContain('Could not load the options');
    expect(error).toHaveBeenCalled();
    await popover(w).get('[data-testid="country-retry"]').trigger('click');
    vi.advanceTimersByTime(150);
    await settle();
    expect(search).toHaveBeenLastCalledWith('al');
    expect(optionLabels(w)).toEqual(['Alemania']);
  });

  // FIX-UI-COMBO-ENTER-WHILE-SEARCHING-SUBMITS (the reviewer's probe of CLOSE-STAFF, hub#179): a role
  // typed and Enter before the server answered saved the staff member's sheet with the old role.
  it('Enter while the search is loading stays here (never submits the form) and chooses nothing, not even when the answer comes', async () => {
    let answerNow: (options: ComboOption[]) => void = () => {};
    const search = vi.fn(() => new Promise<ComboOption[]>((resolve) => (answerNow = resolve)));
    const w = mountCombo({ modelValue: COUNTRIES[3], options: undefined, search });
    await settle();
    await typeIn(w, 'sty');
    // Within the 150 ms before asking, and then with the question in flight.
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    vi.advanceTimersByTime(150);
    await settle();
    expect(search).toHaveBeenCalledWith('sty');
    expect(popover(w).find('[data-testid="country-loading"]').exists()).toBe(true);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(popover(w).exists()).toBe(true);
    expect((field(w).element as El).value).toBe('sty');
    // The answer is shown, its first option highlighted, but nothing is chosen behind the person's back.
    answerNow([COUNTRIES[0], COUNTRIES[1]]);
    await settle();
    expect(optionLabels(w)).toEqual(['España', 'Francia']);
    expect(w.emitted('update:modelValue')).toBeUndefined();
    // Enter on what the person now sees takes the highlighted option, and still not the form.
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[0]]]);
    expect(popover(w).exists()).toBe(false);
  });

  it('Enter on a failed search stays here too: no submit, the error and its Retry stay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const search = vi.fn<(query: string) => Promise<ComboOption[]>>().mockRejectedValue(new Error('503'));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'al');
    vi.advanceTimersByTime(150);
    await settle();
    expect(popover(w).find('[data-testid="country-error"]').exists()).toBe(true);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(popover(w).find('[data-testid="country-retry"]').exists()).toBe(true);
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
});

// hub#443: Ionic places the popover once, when it presents, and a list the server fills was measured
// while it only said «Loading…»: on a tablet held landscape the categories then grew down past the
// window and the last ones could not be reached. The combo places its list itself, beside the field
// and inside the window, and keeps doing it on every frame while it is open.
describe('Combo: where the list opens', () => {
  const realInnerHeight = window.innerHeight;
  /** The animation frames asked while the list is open, run by hand. */
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: realInnerHeight, configurable: true, writable: true });
    Reflect.deleteProperty(window, 'visualViewport');
  });

  /** The window's height and where the field is in it, as Chrome measures them. */
  function layout(w: Wrapper, box: { top: number; bottom: number }, height: number): void {
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true });
    vi.spyOn(field(w).element, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 16, y: box.top, width: 448, height: box.bottom - box.top }),
    );
  }
  /** How tall the list would be with room for all of it (what its options and states measure). */
  function listHeight(w: Wrapper, px: number): void {
    vi.spyOn(popover(w).get('.combo__body').element as HTMLElement, 'offsetHeight', 'get').mockReturnValue(px);
  }
  async function frame(): Promise<void> {
    const pending = frames.splice(0);
    for (const cb of pending) cb(performance.now());
    await settle();
  }
  const placed = (w: Wrapper) => {
    const el = popover(w).element as HTMLElement;
    return {
      side: el.getAttribute('side'),
      maxHeight: el.style.getPropertyValue('--max-height'),
      top: el.style.getPropertyValue('--combo-top'),
      bottom: el.style.getPropertyValue('--combo-bottom'),
    };
  };

  it('under the field, a gap below it, as tall as the room left down to the window’s edge, without an arrow', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 100, bottom: 156 }, 800);
    await field(w).trigger('click');
    await settle();
    // 8 px of gap under the field and 8 px of edge: 800 − 156 − 16 = 628.
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '628px', top: '164px', bottom: 'auto' });
    expect(popover(w).attributes('arrow')).toBe('false');
  });

  it('over the field when the room under it is short and there is more over it (a tablet held landscape)', async () => {
    const w = mountCombo();
    await settle();
    // Measured at 1280×800 on «New menu» › «VAT category»: the field ends 154 px above the window's edge.
    layout(w, { top: 567, bottom: 646 }, 800);
    await field(w).trigger('click');
    await settle();
    expect(placed(w)).toEqual({ side: 'top', maxHeight: '551px', top: 'auto', bottom: '241px' });
  });

  it('over the field it ends a gap above it, so the floating label drawn on the field’s top border stays readable', async () => {
    const w = mountCombo();
    await settle();
    // Measured at 1280×800: the label «VAT category» starts 6 px above the field’s box (567); a list ending
    // at the box covered half of it.
    layout(w, { top: 567, bottom: 646 }, 800);
    await field(w).trigger('click');
    await settle();
    const { side, bottom } = placed(w);
    expect(side).toBe('top');
    const listEnd = 800 - parseFloat(bottom);
    expect(listEnd, 'the list ends at least 6 px above the field').toBeLessThanOrEqual(567 - 6);
  });

  it('a list that grows past the room under the field moves over it when there is more room there', async () => {
    const search = vi.fn(() => Promise.resolve(COUNTRIES));
    const w = mountCombo({ options: undefined, search });
    await settle();
    layout(w, { top: 420, bottom: 476 }, 800);
    await field(w).trigger('click');
    await settle();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '308px', top: '484px', bottom: 'auto' });
    // The answer comes, taller than the room under the field (308 px) and there are 404 px over it.
    listHeight(w, 500);
    await frame();
    expect(placed(w)).toEqual({ side: 'top', maxHeight: '404px', top: 'auto', bottom: '388px' });
    // Typing narrows it: it fits where it is now, so it stays there (it does not jump under the field).
    listHeight(w, 64);
    await frame();
    expect(placed(w).side).toBe('top');
  });

  it('a list that fits under the field stays there, whatever the room over it', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 420, bottom: 476 }, 800);
    await field(w).trigger('click');
    await settle();
    listHeight(w, 300);
    await frame();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '308px', top: '484px', bottom: 'auto' });
  });

  it('follows the field and the window while it is open (the keyboard shows up, the form scrolls)', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 100, bottom: 156 }, 800);
    await field(w).trigger('click');
    await settle();
    // The on-screen keyboard covers the lower 360 px (the visual viewport) and the form scrolls the field up.
    Object.defineProperty(window, 'visualViewport', { value: { offsetTop: 0, height: 440 }, configurable: true });
    layout(w, { top: 60, bottom: 116 }, 800);
    await frame();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '308px', top: '124px', bottom: 'auto' });
    // The keyboard goes away and the form scrolls back: the next frame follows again.
    Reflect.deleteProperty(window, 'visualViewport');
    layout(w, { top: 100, bottom: 156 }, 800);
    await frame();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '628px', top: '164px', bottom: 'auto' });
  });

  it('stops following once closed', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 100, bottom: 156 }, 800);
    const measured = vi.mocked(field(w).element.getBoundingClientRect);
    await field(w).trigger('click');
    await settle();
    const atOpen = measured.mock.calls.length;
    await frame();
    expect(measured.mock.calls.length, 'a frame while open measures the field again').toBeGreaterThan(atOpen);
    await key(w, 'Escape');
    await frame();
    const atClose = measured.mock.calls.length;
    await frame();
    await frame();
    expect(measured.mock.calls.length, 'no frame measures it once closed').toBe(atClose);
  });
});
