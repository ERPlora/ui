import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mount } from '@vue/test-utils';
import { parse } from 'vue/compiler-sfc';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { unnamedButtons, unnamedIcons } from '../testing/a11y';
import AppTopbar from './AppTopbar.vue';
import { createShellI18n } from './i18n';

let router: Router;

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/demo/items', component: { template: '<div />' } },
    ],
  });
  await router.push('/');
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '');
});

function mountTopbar(props: Record<string, unknown>, locale = 'en', slots = {}) {
  return mount(AppTopbar, {
    props: { title: 'Items', ...props },
    slots,
    global: { plugins: [router, createShellI18n({ locale })] },
  });
}

describe('AppTopbar', () => {
  it('is the flat shell header with the screen title as its level-1 heading (hub#794)', () => {
    const wrapper = mountTopbar({});
    expect(wrapper.get('ion-header').classes()).toEqual(expect.arrayContaining(['ion-no-border', 'app-topbar']));
    const title = wrapper.get('ion-title');
    expect(title.text()).toBe('Items');
    expect(title.attributes('role')).toBe('heading');
    expect(title.attributes('aria-level')).toBe('1');
  });

  it('says the section after the title, muted, inside the same heading («Billing · Invoices»)', () => {
    const title = mountTopbar({ title: 'Billing', section: 'Invoices' }).get('ion-title');
    const section = title.get('.topbar-section');
    expect(section.text()).toBe('Invoices');
    expect(title.text().replace(/\s+/g, ' ')).toBe('Billing Invoices');
    expect(mountTopbar({ title: 'Billing' }).find('.topbar-section').exists()).toBe(false);
  });

  it('drops the heading role when the view paints its own <h1>', () => {
    const title = mountTopbar({ titleIsHeading: false }).get('ion-title');
    expect(title.attributes('role')).toBeUndefined();
    expect(title.attributes('aria-level')).toBeUndefined();
  });

  it('always shows the menu button (auto-hide off, hub#1831), labelled in the user language', () => {
    const en = mountTopbar({}).get('ion-buttons[slot="start"] ion-menu-button');
    expect(en.classes()).toContain('menu-toggle');
    expect((en.element as HTMLElement & { autoHide?: boolean }).autoHide).toBe(false);
    expect(en.attributes('aria-label')).toBe('Open menu');
    expect(mountTopbar({}, 'es').get('ion-menu-button').attributes('aria-label')).toBe('Abrir menú');
  });

  it('has no back button on a top-level screen', () => {
    expect(mountTopbar({}).find('[data-testid="topbar-back"]').exists()).toBe(false);
  });

  it('back button: goes to backHref on a deep link (no history inside the app)', async () => {
    const wrapper = mountTopbar({ backHref: '/demo/items' });
    const back = wrapper.get('[data-testid="topbar-back"]');
    expect(back.attributes('aria-label')).toBe('Back');
    expect((back.get('ion-icon').element as HTMLElement & { name?: string }).name).toBe('arrow-back-outline');
    await back.trigger('click');
    await router.isReady();
    await new Promise((r) => setTimeout(r));
    expect(router.currentRoute.value.path).toBe('/demo/items');
  });

  // R-03 (UX audit 2, 2026-10-14): the arrow was an unnamed `role="img"` inside the named button.
  it('back button: named by the button, its arrow decorative; nothing in the bar goes unnamed', () => {
    const wrapper = mountTopbar({ backHref: '/demo/items' });
    expect(wrapper.get('[data-testid="topbar-back"] ion-icon').attributes('aria-hidden')).toBe('true');
    expect(unnamedIcons(wrapper.element)).toEqual([]);
    expect(unnamedButtons(wrapper.element)).toEqual([]);
  });

  it('back button: goes back in history when there is a previous screen', async () => {
    window.history.replaceState({ back: '/' }, '');
    const back = vi.spyOn(router, 'back').mockImplementation(() => {});
    const push = vi.spyOn(router, 'push');
    await mountTopbar({ backHref: '/demo/items' }).get('[data-testid="topbar-back"]').trigger('click');
    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it('renders the view actions at the end of the toolbar', () => {
    const wrapper = mountTopbar({}, 'en', { actions: '<button class="new-item">New</button>' });
    expect(wrapper.find('ion-buttons[slot="end"] .new-item').exists()).toBe(true);
  });
});

// PoC issue C: at 390 px a long title covered the menu button and «Mark done»/«Delete». In ios
// Ionic lays the title `position: absolute` across the WHOLE toolbar and keeps it off the buttons
// with `padding: 0 90px`, which Tailwind's preflight wipes. Layout is not computed under happy-dom,
// so these check the component's own (scoped) rules and that they reach the rendered elements.
describe('AppTopbar: a long title never covers the buttons', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'AppTopbar.vue'), 'utf8');
  const styles = parse(source).descriptor.styles;
  const css = styles
    .map((style) => style.content)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /** Declarations of `selector` in the component's styles, whitespace-normalised. */
  function declarations(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    const block = new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    return block.replace(/\s+/g, ' ').trim();
  }

  it('puts the ios title back in the toolbar row, between the start and end buttons', () => {
    // Its own `.toolbar-title` already cuts with an ellipsis (nowrap + hidden + text-overflow):
    // inside the row, the room left between the buttons is all it gets.
    expect(declarations('.app-topbar ion-title.ios')).toContain('position: relative;');
    expect(declarations('.app-topbar ion-title.ios')).toContain('padding-inline: 4px;');
  });

  it('gives both button groups the same share of the row, so the title stays centred while it fits', () => {
    const buttons = declarations('.app-topbar ion-toolbar.ios > ion-buttons');
    expect(buttons).toContain('flex: 1 1 0;');
    // Never squeezed: a long title gives way, the buttons keep their labels on one line.
    expect(buttons).toContain('min-width: max-content;');
    expect(declarations(".app-topbar ion-toolbar.ios > ion-buttons[slot='end']")).toContain(
      'justify-content: flex-end;',
    );
  });

  it('scopes the rules to this component, and they reach the rendered title and button groups', () => {
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.every((style) => style.scoped)).toBe(true);
    const wrapper = mountTopbar({ title: 'A very long item name that does not fit on a phone at all' });
    const scope = (element: Element) => element.getAttributeNames().filter((name) => name.startsWith('data-v-'));
    const [id] = scope(wrapper.get('ion-header').element);
    expect(id).toBeDefined();
    expect(scope(wrapper.get('ion-title').element)).toContain(id);
    for (const group of wrapper.findAll('ion-buttons')) expect(scope(group.element)).toContain(id);
  });
});
