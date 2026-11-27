// What the person has chosen, said in the footer next to the buttons («12:00 – 12:30 · 30 min»), as checkouts and
// booking forms do: at the start of the footer on a tablet or a desktop, on its own line above the buttons on a phone.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import { byTestId, mountModal, settle, unmountModals } from './__tests__/form-modal';

vi.mock('@ionic/vue', async (importOriginal) => (await import('./__tests__/ionModalStub')).ionicVueWithModalStub(importOriginal));

afterEach(unmountModals);

const SUMMARY = () => [h('p', { 'data-testid': 'chosen' }, '12:00 – 12:30 · 30 min')];

describe('FormModal: the summary slot', () => {
  it('says what is chosen in the footer, before the buttons', async () => {
    const wrapper = mountModal({ testid: 'booking' }, { summary: SUMMARY });
    await settle();
    const footer = wrapper.get('.ep-form-modal__footer').element;
    const summary = byTestId('booking-summary');
    expect(summary?.parentElement).toBe(footer);
    expect(summary?.textContent).toBe('12:00 – 12:30 · 30 min');
    expect(summary?.compareDocumentPosition(wrapper.get('.ep-form-modal__cancel').element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(footer.classList).toContain('ep-form-modal__footer--summary');
  });

  it('without it the footer is as it was: only the buttons', async () => {
    const wrapper = mountModal({ testid: 'plain' });
    await settle();
    expect(wrapper.find('.ep-form-modal__summary').exists()).toBe(false);
    expect(wrapper.get('.ep-form-modal__footer').classes()).not.toContain('ep-form-modal__footer--summary');
  });

  it('sits next to buttons of the page\'s own too', async () => {
    mountModal({}, { summary: SUMMARY, footer: () => [h('button', { 'data-testid': 'own' }, 'Book')] });
    await settle();
    expect(byTestId('chosen')?.closest('.ep-form-modal__footer')).toBe(byTestId('own')?.closest('.ep-form-modal__footer'));
  });
});

describe('FormModal: where the summary sits (CSS computed in a happy-dom window)', () => {
  const STYLE = /<style>([\s\S]*?)<\/style>/.exec(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'FormModal.vue'), 'utf8'))?.[1] ?? '';

  async function summaryAt(width: number) {
    const win = new Window({ width, height: 844 });
    win.document.head.innerHTML = `<style>${STYLE}</style>`;
    win.document.body.innerHTML = `
      <ion-modal class="ep-form-modal" data-size="xl" data-phone-layout="fullscreen">
        <div class="ep-form-modal__footer ep-form-modal__footer--summary"><div class="ep-form-modal__summary"></div></div>
      </ion-modal>`;
    const summary = win.getComputedStyle(win.document.querySelector('.ep-form-modal__summary')!);
    const footer = win.getComputedStyle(win.document.querySelector('.ep-form-modal__footer')!);
    const read = {
      grow: summary.getPropertyValue('flex-grow'),
      basis: summary.getPropertyValue('flex-basis'),
      minWidth: summary.getPropertyValue('min-width'),
      border: footer.getPropertyValue('border-top-style'),
    };
    await win.happyDOM.close();
    return read;
  }

  it('from 640px it takes the free room at the start of the footer, the buttons at the end', async () => {
    const { grow, basis, minWidth } = await summaryAt(1024);
    expect(grow).toBe('1');
    expect(basis).not.toBe('100%');
    expect(minWidth).toBe('0');
  });

  it('below 640px it takes its own line, above the buttons', async () => {
    expect((await summaryAt(390)).basis).toBe('100%');
  });

  it('a line sets the footer apart from the fields that scroll above it', async () => {
    expect((await summaryAt(1024)).border).toBe('solid');
  });
});
