import { expect, it } from 'vitest';

it('importing the boot module localizes ion-select buttons', async () => {
  await import('./ionic-select-text.boot');
  document.documentElement.lang = 'es';
  customElements.define(
    'ion-select',
    class extends HTMLElement {
      cancelText = 'Cancel';
      okText = 'OK';
      async open(): Promise<void> {}
    },
  );
  const el = document.createElement('ion-select') as HTMLElement & { cancelText: string; open(): Promise<void> };
  document.body.appendChild(el);
  await el.open();
  expect(el.cancelText).toBe('Cancelar');
});
