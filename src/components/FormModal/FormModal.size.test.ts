// The dialog's width on desktop and tablet: `sm` 420px for short confirmations, `md` 480px for forms (the default),
// `lg` 640px for windows that are mostly reading, such as the in-app help, and `xl` 920px for a form in two columns.
// Below 640px a sheet takes the full width whatever the size.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount, type VueWrapper } from '@vue/test-utils';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import FormModal from './FormModal.vue';

vi.mock('@ionic/vue', async (importOriginal) => (await import('./__tests__/ionModalStub')).ionicVueWithModalStub(importOriginal));

const STYLE = /<style>([\s\S]*?)<\/style>/.exec(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'FormModal.vue'), 'utf8'))?.[1] ?? '';

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

/** The modal's custom properties in a window `width` px wide (happy-dom computes the media queries, not the layout). */
async function modalStyleAt(width: number, size: string): Promise<Record<string, string>> {
  const win = new Window({ width, height: 844 });
  win.document.head.innerHTML = `<style>${STYLE}</style>`;
  win.document.body.innerHTML = `<ion-modal class="ep-form-modal" data-size="${size}" data-phone-layout="sheet"></ion-modal>`;
  const style = win.getComputedStyle(win.document.querySelector('ion-modal')!);
  const read = Object.fromEntries(['--width', '--max-width'].map((prop) => [prop, style.getPropertyValue(prop)]));
  await win.happyDOM.close();
  return read;
}

describe('FormModal: size lg', () => {
  it('marks the dialog with its size', async () => {
    const wrapper = mount(FormModal, {
      props: { title: 'Help · Tables', open: true, size: 'lg' },
      attachTo: document.body,
      global: { plugins: [createShellI18n({ locale: 'en' })] },
    });
    mounted.push(wrapper);
    await nextTick();
    expect(wrapper.get('[data-stub="ion-modal"]').attributes('data-size')).toBe('lg');
  });

  it('is 640px wide from 640px up, and never wider than the screen', async () => {
    for (const width of [640, 834, 1440]) {
      const modal = await modalStyleAt(width, 'lg');
      expect(modal['--width'], String(width)).toBe('640px');
      expect(modal['--max-width'], String(width)).toBe('calc(100% - 32px)');
    }
  });

  it('leaves the other sizes as they are', async () => {
    expect((await modalStyleAt(1024, 'md'))['--width']).toBe('480px');
    expect((await modalStyleAt(1024, 'sm'))['--width']).toBe('420px');
  });

  it('below 640px is the full-width sheet like every other size', async () => {
    expect((await modalStyleAt(390, 'lg'))['--width']).toBe('100%');
  });
});

describe('FormModal: size xl', () => {
  it('marks the dialog with its size', async () => {
    const wrapper = mount(FormModal, {
      props: { title: 'New appointment', open: true, size: 'xl' },
      attachTo: document.body,
      global: { plugins: [createShellI18n({ locale: 'en' })] },
    });
    mounted.push(wrapper);
    await nextTick();
    expect(wrapper.get('[data-stub="ion-modal"]').attributes('data-size')).toBe('xl');
  });

  // A tablet in portrait (834px) is narrower than the dialog: it takes the page but for the usual 16px each side.
  it('is 920px wide from 640px up, and never wider than the screen', async () => {
    for (const width of [640, 834, 1440]) {
      const modal = await modalStyleAt(width, 'xl');
      expect(modal['--width'], String(width)).toBe('920px');
      expect(modal['--max-width'], String(width)).toBe('calc(100% - 32px)');
    }
  });

  it('below 640px is the full-width sheet like every other size', async () => {
    expect((await modalStyleAt(390, 'xl'))['--width']).toBe('100%');
  });
});
