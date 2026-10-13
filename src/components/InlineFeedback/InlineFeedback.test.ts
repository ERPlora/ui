// Behaviour spec of InlineFeedback, the Vue port of OutfitKit's `ok-inline-feedback`
// (ERPlora/outfitkit origin/main `src/components/ok-inline-feedback/ok-inline-feedback.ts`, which
// had no tests of its own): a persistent banner in the flow of the content, with a tone, an
// optional heading, a body (default slot), actions (`actions` slot) and an optional close button.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { createCommentVNode, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { createShellI18n } from '../../shell/i18n';
import { ionIconSrc, resolveIcon } from '../../shell/icons';
import InlineFeedback from './InlineFeedback.vue';
import * as barrel from './index';

const HERE = dirname(fileURLToPath(import.meta.url));

type Props = InstanceType<typeof InlineFeedback>['$props'];

function mountFeedback(props: Props = {}, slots: Record<string, () => unknown> = {}, locale = 'en') {
  return mount(InlineFeedback, {
    props,
    slots: { default: () => 'Something to say', ...slots },
    global: { plugins: [createShellI18n({ locale })] },
  });
}

const iconOf = (el: Element): string | undefined => (el as HTMLElement & { icon?: string }).icon;

const DEFAULT_ICONS = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
  neutral: 'information-circle',
} as const;

describe('InlineFeedback', () => {
  it('is exported from its folder', () => {
    expect(barrel.InlineFeedback).toBe(InlineFeedback);
  });

  it('renders the same DOM as ok-inline-feedback: root, status box, tone icon, body', () => {
    const wrapper = mountFeedback();
    const root = wrapper.get('.inline-feedback');
    expect(root.element).toBe(wrapper.element);
    expect(root.attributes('data-tone')).toBe('info');
    expect(root.attributes('hidden')).toBeUndefined();
    const box = root.get(':scope > .box');
    expect(box.attributes('role')).toBe('status');
    const icon = box.get(':scope > ion-icon.icon');
    expect(icon.attributes('aria-hidden')).toBe('true');
    expect(iconOf(icon.element)).toBe(ionIconSrc('information-circle'));
    expect(box.get('.content > .row > .text > .body').text()).toBe('Something to say');
  });

  it.each(Object.entries(DEFAULT_ICONS))('tone %s paints its colour and its default icon', (tone, icon) => {
    const root = mountFeedback({ tone: tone as Props['tone'] }).get('.inline-feedback');
    expect(root.attributes('data-tone')).toBe(tone);
    expect(iconOf(root.get('ion-icon.icon').element)).toBe(ionIconSrc(icon));
  });

  it('every default icon is baked, so it paints offline (no network for icons under the CSP)', () => {
    for (const name of [...Object.values(DEFAULT_ICONS), 'close']) expect(resolveIcon(name), name).toBeDefined();
  });

  it('the tone icon and the close icon really paint inline, without fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const wrapper = mount(InlineFeedback, {
      props: { tone: 'warning', dismissible: true },
      attachTo: document.body,
      global: { plugins: [createShellI18n()] },
    });
    for (const icon of wrapper.findAll('ion-icon')) {
      await vi.waitFor(() => expect(icon.element.shadowRoot?.querySelector('.icon-inner svg')).not.toBeNull());
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    wrapper.unmount();
    fetchSpy.mockRestore();
  });

  it('the icon prop replaces the tone icon, from any icon set', () => {
    const wrapper = mountFeedback({ tone: 'danger', icon: 'mdi:cart' });
    expect(iconOf(wrapper.get('ion-icon.icon').element)).toBe(ionIconSrc('mdi:cart'));
  });

  it('shows the heading only when there is one', () => {
    expect(mountFeedback().find('.heading').exists()).toBe(false);
    const heading = mountFeedback({ heading: 'Could not load' }).get('.text > .heading');
    expect(heading.text()).toBe('Could not load');
  });

  it('places the actions slot to the right of the text', () => {
    const wrapper = mountFeedback({}, { actions: () => h('button', { class: 'retry' }, 'Retry') });
    const actions = wrapper.get('.row > .actions');
    expect(actions.classes()).not.toContain('empty');
    expect(actions.get('button.retry').text()).toBe('Retry');
  });

  it('collapses the actions container when nothing is slotted, also when the slot renders nothing', () => {
    expect(mountFeedback().get('.actions').classes()).toContain('empty');
    expect(mountFeedback({}, { actions: () => [] }).get('.actions').classes()).toContain('empty');
    const onlyAComment = mountFeedback({}, { actions: () => [createCommentVNode('v-if', true)] });
    expect(onlyAComment.get('.actions').classes()).toContain('empty');
  });

  it('has no close button unless dismissible', () => {
    expect(mountFeedback().find('button.close').exists()).toBe(false);
  });

  it('the close button is labelled in the user language and has the close icon', () => {
    const close = mountFeedback({ dismissible: true }).get('.box > button.close');
    // Light DOM now: inside a <form> (the demo's item modal) a default button would submit it.
    expect(close.attributes('type')).toBe('button');
    expect(close.attributes('aria-label')).toBe('Dismiss');
    const icon = close.get('ion-icon');
    expect(icon.attributes('aria-hidden')).toBe('true');
    expect(iconOf(icon.element)).toBe(ionIconSrc('close'));
    expect(mountFeedback({ dismissible: true }, {}, 'es').get('button.close').attributes('aria-label')).toBe('Cerrar');
  });

  it('closing hides the banner by itself and tells the parent (dismiss + update:hidden)', async () => {
    const wrapper = mountFeedback({ dismissible: true });
    await wrapper.get('button.close').trigger('click');
    expect(wrapper.get('.inline-feedback').attributes('hidden')).toBeDefined();
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
    expect(wrapper.emitted('update:hidden')).toEqual([[true]]);
  });

  it('v-model:hidden: the parent hides it, and can show it again after a close', async () => {
    const wrapper = mountFeedback({
      dismissible: true,
      hidden: true,
      'onUpdate:hidden': (value: boolean) => wrapper.setProps({ hidden: value }),
    });
    expect(wrapper.get('.inline-feedback').attributes('hidden')).toBeDefined();
    await wrapper.setProps({ hidden: false });
    expect(wrapper.get('.inline-feedback').attributes('hidden')).toBeUndefined();
    await wrapper.get('button.close').trigger('click');
    expect(wrapper.props('hidden')).toBe(true);
    await wrapper.setProps({ hidden: false });
    expect(wrapper.get('.inline-feedback').attributes('hidden')).toBeUndefined();
  });

  it('passes attributes such as data-testid to its root, like the host element did', () => {
    const wrapper = mount(InlineFeedback, {
      attrs: { 'data-testid': 'demo-items-error' },
      global: { plugins: [createShellI18n()] },
    });
    expect(wrapper.get('[data-testid="demo-items-error"]').element).toBe(wrapper.element);
  });
});

describe('InlineFeedback styles', () => {
  const source = readFileSync(join(HERE, 'InlineFeedback.vue'), 'utf8');
  const style = /<style scoped>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '';
  const theme = readFileSync(join(HERE, '../../shell/theme/variables.css'), 'utf8');
  const values = (name: string): string[] =>
    [...theme.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim());

  it('are scoped and read our --ep-* tokens, never OutfitKit --ok-* ones', () => {
    expect(style).toContain('.inline-feedback');
    expect(style).not.toMatch(/--ok-/);
    expect(style).toMatch(/var\(--ep-radius,/);
  });

  it('reads the theme value of the --ep-* tokens the shell defines and falls back for the rest (same look)', () => {
    const tokens = new Set([...style.matchAll(/var\((--ep-[a-z0-9-]+)/g)].map((m) => m[1]));
    for (const token of tokens) {
      if (!values(token).length) expect(style, `${token} has no theme value: it needs its fallback`).toContain(`var(${token},`);
    }
    // The 14px radius the shell gave OutfitKit's element (PLAN §16.11: --ep-* keep those values).
    expect(values('--ep-radius')).toEqual(['14px']);
  });
});
