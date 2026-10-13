import { expect, it } from 'vitest';

it('importing the boot module hooks ion-input so fill forces md', async () => {
  await import('./ionic-fill.boot');
  customElements.define('ion-input', class extends HTMLElement {});
  const el = document.createElement('ion-input');
  el.setAttribute('fill', 'outline');
  document.body.appendChild(el);
  expect(el.getAttribute('mode')).toBe('md');
});
