import { expect, it } from 'vitest';

it('importing the boot module hooks ion-select', async () => {
  await import('./ionic-select-interface.boot');
  let seen = '';
  customElements.define(
    'ion-select',
    class extends HTMLElement {
      interface = 'alert';
      multiple = false;
      async open(): Promise<void> {
        seen = this.interface;
      }
    },
  );
  const el = document.createElement('ion-select') as HTMLElement & { open(): Promise<void> };
  document.body.appendChild(el);
  await el.open();
  expect(seen).toBe('popover');
});
