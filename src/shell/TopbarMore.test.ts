import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { componentCss, declaration } from '../components/__tests__/themeContrast';
import { unnamedButtons, unnamedIcons } from '../testing/a11y';
import { IonPopoverStub } from './__tests__/ionPopoverStub';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
import TopbarMore from './TopbarMore.vue';
import { useTopbarMenu } from './topbar-menu';

/** A row that, like the assistant, acts only once the menu has gone. */
function laterRow(action: () => void) {
  return defineComponent({
    setup() {
      const menu = useTopbarMenu();
      return () => h('button', { 'data-testid': 'later', onClick: () => menu?.closeThen(action) }, 'Later');
    },
  });
}

function mountMore(rows: () => unknown[], locale = 'en') {
  return mount(TopbarMore, {
    slots: { default: rows },
    global: { plugins: [createShellI18n({ locale })], stubs: { IonPopover: IonPopoverStub } },
  });
}

const menuOf = (wrapper: ReturnType<typeof mountMore>) => wrapper.find('[data-testid="topbar-more-menu"]');

describe('TopbarMore (the bar «⋮» on a phone)', () => {
  it('is one named button with the vertical ellipsis, that says it opens a menu', () => {
    const wrapper = mountMore(() => [h('button', 'Edit')]);
    const more = wrapper.get('[data-testid="topbar-more"]');
    expect(more.attributes('aria-label')).toBe('More actions');
    expect(more.attributes('aria-haspopup')).toBe('true');
    expect(more.attributes('aria-expanded')).toBe('false');
    expect(more.getComponent(HubIcon).props('name')).toBe('ion:ellipsis-vertical');
    expect(unnamedButtons(wrapper.element)).toEqual([]);
    expect(unnamedIcons(wrapper.element)).toEqual([]);
    expect(menuOf(wrapper).exists()).toBe(false);
    expect(mountMore(() => [], 'es').get('[data-testid="topbar-more"]').attributes('aria-label')).toBe('Más acciones');
  });

  it('lists its rows in a popover, as a button group; choosing one runs it and closes the menu', async () => {
    const edit = vi.fn();
    const wrapper = mountMore(() => [h('button', { 'data-testid': 'edit', onClick: edit }, 'Edit'), h('button', 'Done')]);
    await wrapper.get('[data-testid="topbar-more"]').trigger('click');
    expect(wrapper.get('[data-testid="topbar-more"]').attributes('aria-expanded')).toBe('true');
    expect(menuOf(wrapper).element.tagName).toBe('ION-BUTTONS');
    expect(menuOf(wrapper).findAll('button').map((row) => row.text())).toEqual(['Edit', 'Done']);
    await menuOf(wrapper).get('[data-testid="edit"]').trigger('click');
    expect(edit).toHaveBeenCalledOnce();
    expect(menuOf(wrapper).exists()).toBe(false);
  });

  it('runs what a row asks with closeThen only once the menu has gone, and only once', async () => {
    const action = vi.fn();
    const wrapper = mountMore(() => [h(laterRow(action))]);
    await wrapper.get('[data-testid="topbar-more"]').trigger('click');
    await menuOf(wrapper).get('[data-testid="later"]').trigger('click');
    expect(menuOf(wrapper).exists()).toBe(false);
    await flushPromises();
    expect(action).not.toHaveBeenCalled();
    const popover = wrapper.getComponent(IonPopoverStub);
    popover.vm.$emit('didDismiss');
    expect(action).toHaveBeenCalledOnce();
    await wrapper.get('[data-testid="topbar-more"]').trigger('click');
    popover.vm.$emit('didDismiss');
    await flushPromises();
    expect(action).toHaveBeenCalledOnce();
    expect(menuOf(wrapper).exists()).toBe(false);
  });

  it('lists each row with its label at the start, as a menu (not centred like a bar button)', () => {
    // Ionic centres the label in `.button-inner`, a box as wide as the button that no `::part` reaches; a
    // `justify-content` on `native` alone changed nothing (measured at 375: «Edit» 85 px in, «Delete» 74 px
    // in). As a grid whose track does not stretch, `native` sizes that box to the label and leads with it.
    const css = componentCss(`${__dirname}/TopbarMore.vue`);
    expect(declaration(css, '.topbar-more :deep(ion-button)::part(native)', 'display')).toBe('grid');
    expect(declaration(css, '.topbar-more :deep(ion-button)::part(native)', 'justify-content')).toBe('start');
  });
});
