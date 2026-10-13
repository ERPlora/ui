import { mount } from '@vue/test-utils';
import { createApp, defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';

import { provideShellConfig, useShellConfig } from './shell-config';

const Probe = defineComponent({
  setup() {
    const config = useShellConfig();
    return () => h('p', config.homePath);
  },
});

describe('shell config', () => {
  it('defaults to home "/" when nothing provided it', () => {
    expect(mount(Probe).text()).toBe('/');
  });

  it('is provided app-wide by createShell', () => {
    const app = createApp(Probe);
    provideShellConfig({ homePath: '/demo/items' }, app);
    const el = document.createElement('div');
    app.mount(el);
    expect(el.textContent).toBe('/demo/items');
    app.unmount();
  });
});
