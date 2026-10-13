// Behaviour spec of EmptyState, the Vue port of OutfitKit's `ok-empty-state` (ERPlora/outfitkit
// origin/main `src/components/ok-empty-state/ok-empty-state.ts`, which had no tests of its own): a
// centred "nothing here" with a large muted icon, a heading, a muted message, extra content (default
// slot) and an action under the text (`action` slot).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { h } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { ionIconSrc, resolveIcon } from '../../shell/icons';
import EmptyState from './EmptyState.vue';
import * as barrel from './index';

const HERE = dirname(fileURLToPath(import.meta.url));

type Props = InstanceType<typeof EmptyState>['$props'];

const mountEmpty = (props: Props = {}, slots: Record<string, () => unknown> = {}) => mount(EmptyState, { props, slots });

const iconOf = (el: Element): string | undefined => (el as HTMLElement & { icon?: string }).icon;

describe('EmptyState', () => {
  it('is exported from its folder', () => {
    expect(barrel.EmptyState).toBe(EmptyState);
  });

  it('renders the same DOM as ok-empty-state: root, centred wrap, muted icon, action container', () => {
    const wrapper = mountEmpty();
    const root = wrapper.get('.empty-state');
    expect(root.element).toBe(wrapper.element);
    const wrap = root.get(':scope > .wrap');
    const icon = wrap.get(':scope > ion-icon');
    expect(icon.attributes('aria-hidden')).toBe('true');
    expect(wrap.get(':scope > .action').element.childElementCount).toBe(0);
  });

  it('defaults to the file-tray icon, which is baked so it paints offline', () => {
    expect(iconOf(mountEmpty().get('ion-icon').element)).toBe(ionIconSrc('file-tray-outline'));
    expect(resolveIcon('file-tray-outline')).toBeDefined();
  });

  it('the icon really paints inline in ion-icon, without fetching anything (no network for icons)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const wrapper = mount(EmptyState, { props: { icon: 'mdi:cart' }, attachTo: document.body });
    const icon = wrapper.get('ion-icon').element;
    await vi.waitFor(() => expect(icon.shadowRoot?.querySelector('.icon-inner svg')).not.toBeNull());
    expect(fetchSpy).not.toHaveBeenCalled();
    wrapper.unmount();
    fetchSpy.mockRestore();
  });

  it('the icon prop replaces it, from any icon set', () => {
    expect(iconOf(mountEmpty({ icon: 'help-circle-outline' }).get('ion-icon').element)).toBe(
      ionIconSrc('help-circle-outline'),
    );
    expect(iconOf(mountEmpty({ icon: 'mdi:cart' }).get('ion-icon').element)).toBe(ionIconSrc('mdi:cart'));
  });

  it('shows the heading (h2) and the message (p) only when given', () => {
    const bare = mountEmpty();
    expect(bare.find('.heading').exists()).toBe(false);
    expect(bare.find('.message').exists()).toBe(false);
    const full = mountEmpty({ heading: 'No items yet', message: 'Create the first one.' });
    expect(full.get('.wrap > h2.heading').text()).toBe('No items yet');
    expect(full.get('.wrap > p.message').text()).toBe('Create the first one.');
  });

  it('extra content goes after the text and the action goes in its container, in that order', () => {
    const wrapper = mountEmpty(
      { heading: 'Nothing', message: 'Really nothing' },
      { default: () => h('span', { class: 'extra' }, 'More'), action: () => h('button', { class: 'go' }, 'Go') },
    );
    const children = [...wrapper.get('.wrap').element.children].map((el) =>
      el.tagName === 'ION-ICON' ? 'ion-icon' : el.className,
    );
    expect(children).toEqual(['ion-icon', 'heading', 'message', 'extra', 'action']);
    expect(wrapper.get('.action > button.go').text()).toBe('Go');
  });

  it('passes attributes such as data-testid to its root, like the host element did', () => {
    const wrapper = mount(EmptyState, { attrs: { 'data-testid': 'demo-items-empty' } });
    expect(wrapper.get('[data-testid="demo-items-empty"]').element).toBe(wrapper.element);
  });
});

describe('EmptyState styles', () => {
  const source = readFileSync(join(HERE, 'EmptyState.vue'), 'utf8');
  const style = /<style scoped>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '';

  it('are scoped and read our --ep-* tokens, never OutfitKit --ok-* ones', () => {
    expect(style).toContain('.empty-state');
    expect(style).not.toMatch(/--ok-/);
    expect(style).toMatch(/var\(--ep-color-medium,/);
  });

  it('the heading does not take the global h2 type of the shell (it lived in a shadow root)', () => {
    const heading = /\.heading\s*\{([^}]*)\}/.exec(style)?.[1] ?? '';
    expect(heading).toMatch(/line-height:\s*inherit/);
    expect(heading).toMatch(/letter-spacing:\s*inherit/);
  });
});
