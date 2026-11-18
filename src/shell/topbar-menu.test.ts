import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';

import { TOPBAR_MENU_KEY, type TopbarMenu, useTopbarMenu } from './topbar-menu';

let seen: TopbarMenu | undefined;
/** A piece of the bar that keeps what it is given. */
const Piece = defineComponent({
  setup() {
    seen = useTopbarMenu();
    return () => null;
  },
});

describe('useTopbarMenu', () => {
  it('is undefined for a piece painted in the bar itself', () => {
    seen = { closeThen: () => undefined };
    mount(Piece);
    expect(seen).toBeUndefined();
  });

  it('gives a piece listed in the bar menu that menu, to close it before acting', () => {
    const menu: TopbarMenu = { closeThen: () => undefined };
    mount(Piece, { global: { provide: { [TOPBAR_MENU_KEY as symbol]: menu } } });
    expect(seen).toBe(menu);
  });
});
