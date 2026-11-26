import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('FormModal: layout (CSS, read from the stylesheet or computed in a happy-dom window)', () => {
  const sfc = readFileSync(join(HERE, 'FormModal.vue'), 'utf8');

  it('is a centred card on desktop, 480px (md) or 420px (sm) wide, its height by its content', () => {
    expect(sfc).toMatch(/ion-modal\.ep-form-modal\s*\{[^}]*--width:\s*480px;[^}]*--height:\s*auto;/);
    expect(sfc).toMatch(/ion-modal\.ep-form-modal\[data-size='sm'\]\s*\{[^}]*--width:\s*420px;/);
  });

  // As in Material 3 and iOS, a form on a phone is a sheet from the bottom as tall as its fields, never a full-height
  // page with most of the screen empty under one field; it grows to 90% of the screen and then its fields scroll
  // between the title and the buttons. A confirmation (`phoneLayout: 'card'`, ConfirmDialog) stays the centred card at
  // every width.
  const STYLE = /<style>([\s\S]*?)<\/style>/.exec(sfc)?.[1] ?? '';

  // A select keeps what it has chosen on one line, so its minimum width is that line's, and the
  // one-column grid of a form grows to it, every field with it. Inside a dialog the chosen text takes the lines it needs.
  it('a select wraps what it has chosen, so no field grows past the dialog', () => {
    expect(STYLE).toMatch(/ion-modal\.ep-form-modal ion-select::part\(text\)\s*\{[^}]*white-space:\s*normal;/);
  });

  // An outlined select floats its label over the top edge of its box, down to 8px inside it, and centres what it
  // has chosen in the 56px box, under Ionic's 1px margin. Measured in Chromium (a Hub form, lines of 18px): one line
  // starts at 19.5 and two at 10.5, clear of the label; three or more fill the box from 1px, and the label lies on them.
  // happy-dom lays nothing out and has no `::part`, so these numbers are the ones of that measure.
  describe('what an outlined select has chosen, against its floating label', () => {
    const LINE = 18;
    const BOX = 56;
    const IONIC_MARGIN = 1;
    const LABEL_BOTTOM = 8;
    // The shared theme says it once for every outlined select, those of a dialog included.
    const THEME = readFileSync(join(HERE, '../../shell/theme/polish.css'), 'utf8');
    const OUTLINED_TEXT = /(?:^|\})\s*ion-select\.select-fill-outline::part\(text\)\s*\{([^}]*)\}/m;
    const padding = (): number => Number(/padding-block:\s*([\d.]+)px;/.exec(OUTLINED_TEXT.exec(THEME)?.[1] ?? '')?.[1] ?? 0);

    it('three lines or more start clear of the label, where two lines start', () => {
      const twoLinesStartAt = IONIC_MARGIN + (BOX - IONIC_MARGIN - 2 * LINE) / 2;
      const manyLinesStartAt = IONIC_MARGIN + padding();
      expect(manyLinesStartAt).toBeGreaterThan(LABEL_BOTTOM);
      expect(manyLinesStartAt).toBe(twoLinesStartAt);
    });

    it('one or two lines keep the height of any other field', () => {
      expect(IONIC_MARGIN + 2 * LINE + 2 * padding()).toBeLessThanOrEqual(BOX);
    });

    it('the dialog does not say it a second time', () => {
      expect(STYLE).not.toMatch(/select-fill-outline/);
    });

    // Without `fill` the label takes its own line above the text and a compact select keeps its height.
    it('a select that is not outlined gets no extra room', () => {
      expect(STYLE).not.toMatch(/ion-modal\.ep-form-modal ion-select::part\(text\)\s*\{[^}]*padding/);
    });
  });

  // Ionic's title is one line cut with «…»: its shadow `.toolbar-title` says `white-space: nowrap`, out of reach of
  // the page's styles, and a long question read «¿Marcar FACT-2026-000004 como paga…». The words sit in their own
  // element, which takes the lines it needs, as Material's and iOS's dialogs do.
  it('a long title takes the lines it needs instead of being cut with «…»', async () => {
    const win = new Window({ width: 1280, height: 720 });
    win.document.head.innerHTML = `<style>${STYLE}</style>`;
    win.document.body.innerHTML = `
      <ion-modal class="ep-form-modal">
        <ion-title class="ep-form-modal__title" style="white-space: nowrap">
          <span class="ep-form-modal__title-text">¿Marcar FACT-2026-000004 como pagada?</span>
        </ion-title>
      </ion-modal>`;
    const whiteSpace = win.getComputedStyle(win.document.querySelector('.ep-form-modal__title-text')!).whiteSpace;
    await win.happyDOM.close();
    expect(whiteSpace).toBe('normal');
  });

  /** The dialog's stylesheet applied in a window `width` px wide (happy-dom computes the media
   *  queries, not the layout), on the DOM FormModal and Ionic render. */
  async function styleAt(width: number, phoneLayout: string, size = 'md', height = 844) {
    const win = new Window({ width, height });
    win.document.head.innerHTML = `<style>${STYLE}</style>`;
    win.document.body.innerHTML = `
      <ion-modal class="ep-form-modal" data-size="${size}" data-phone-layout="${phoneLayout}">
        <div class="ion-delegate-host ion-page"><div class="ep-form-modal__content">
          <form class="ep-form-modal__form"><div class="ep-form-modal__body"></div><div class="ep-form-modal__footer"></div></form>
        </div></div>
      </ion-modal>`;
    /** The computed values of `props` on `selector`, read before the window closes. */
    const read = (selector: string, props: string[]): Record<string, string> => {
      const style = win.getComputedStyle(win.document.querySelector(selector)!);
      return Object.fromEntries(props.map((prop) => [prop, style.getPropertyValue(prop)]));
    };
    const styles = {
      modal: read('ion-modal', ['--width', '--max-width', '--height', '--max-height', '--border-radius', 'align-items']),
      host: read('.ion-delegate-host', ['display', 'flex-direction', 'max-height']),
      body: read('.ep-form-modal__body', ['overflow-y', 'min-height', 'max-height']),
    };
    await win.happyDOM.close();
    return styles;
  }

  it('below 640px a form is a sheet from the bottom, as tall as its content up to 90vh, the fields scrolling inside', async () => {
    const { modal, host, body } = await styleAt(390, 'sheet');
    expect(modal['--width']).toBe('100%');
    expect(modal['--height']).toBe('auto');
    expect(modal['--max-height']).toBe('90vh');
    expect(modal['align-items']).toBe('flex-end');
    // The sheet's rounded top (--ep-radius-sheet-top, 18px 18px 0 0 without the theme).
    expect(modal['--border-radius']).toBe('18px 18px 0 0');
    // The content is capped like the sheet, so the body scrolls instead of being cut off.
    expect(host['max-height']).toBe(`${(844 * 90) / 100}px`); // 90vh of the 844px window, computed
    expect(host.display).toBe('flex');
    expect(body['overflow-y']).toBe('auto');
    expect(body['min-height']).toBe('0');
    expect(body['max-height']).toBe('none');
  });

  it('a confirmation (`phoneLayout: card`) stays the centred card below 640px: never a sheet', async () => {
    const { modal } = await styleAt(390, 'card', 'sm');
    expect(modal['--width']).toBe('420px');
    expect(modal['--max-width']).toBe('calc(100vw - 32px)');
    expect(modal['--height']).toBe('auto');
    expect(modal['align-items']).not.toBe('flex-end');
    expect(modal['--border-radius']).not.toBe('18px 18px 0 0');
  });

  it('from 640px both are the centred card', async () => {
    for (const layout of ['sheet', 'card']) {
      const { modal } = await styleAt(1024, layout);
      expect(modal['--width'], layout).toBe('480px');
      expect(modal['--height'], layout).toBe('auto');
      expect(modal['align-items'], layout).not.toBe('flex-end');
    }
  });

  // A tablet in landscape is a low screen (1280×761 CSS px). A footer of six actions wraps into three rows, and with
  // only the body capped (70vh) the buttons fell past the bottom of the dialog, cut off. The content is
  // capped like the dialog itself, so the fields scroll between the title and the buttons, which always show.
  it('from 640px the content is capped like the dialog, so a tall footer stays inside it on a low screen', async () => {
    const { modal, host, body } = await styleAt(1280, 'sheet', 'md', 761);
    expect(modal['--max-height']).toBe('calc(100vh - 32px)');
    expect(host.display).toBe('flex');
    expect(host['flex-direction']).toBe('column');
    expect(host['max-height']).toBe('calc(761px - 32px)');
    expect(body['overflow-y']).toBe('auto');
    expect(body['min-height']).toBe('0');
  });

  // Ionic drops the backdrop and the shadow of a modal opened over another one (`ion-modal.modal-default.show-modal
  // ~ ion-modal.modal-default` in its core.css), a rule made for windows of one size that cover each other. The card is
  // narrower than a sheet (600px wide on a tablet) and the phone's sheet is only as tall as its fields, so what is behind
  // would show around it, neither dimmed nor apart. Over another window it keeps both.
  describe('over another window', () => {
    const IONIC = readFileSync(join(HERE, '../../../node_modules/@ionic/vue/css/core.css'), 'utf8');
    const SHADOW = '0 18px 50px rgba(17, 24, 39, 0.18)';

    /** `front` presented after an open sheet (none with `alone`), with Ionic's stylesheet and the dialog's, in a window
     *  `width` px wide. */
    async function over(width: number, front: string, dark = false, alone = false) {
      const win = new Window({ width, height: 844 });
      if (dark) win.document.documentElement.classList.add('ion-palette-dark');
      // The dialog's rules first: they must win by what they say, not by coming after Ionic's (the bundle sets the order).
      win.document.head.innerHTML = `<style>:root { --ep-shadow-modal: ${SHADOW}; }</style><style>${STYLE}</style><style>${IONIC}</style>`;
      win.document.body.innerHTML = `<ion-app>
        ${alone ? '' : '<ion-modal class="ios modal-default show-modal" data-testid="sheet"></ion-modal>'}
        ${front}
      </ion-app>`;
      const style = win.getComputedStyle(win.document.querySelector('[data-testid=front]')!);
      const read = { backdrop: style.getPropertyValue('--backdrop-opacity'), shadow: style.getPropertyValue('--box-shadow') };
      await win.happyDOM.close();
      return read;
    }
    const dialog = (phoneLayout: string, size = 'md') =>
      `<ion-modal class="ep-form-modal ios modal-default show-modal" data-testid="front" data-size="${size}" data-phone-layout="${phoneLayout}"></ion-modal>`;

    it.each([
      [1440, 'sheet', 'md'],
      [820, 'sheet', 'md'],
      [1440, 'card', 'sm'],
      [390, 'sheet', 'md'],
      [390, 'card', 'sm'],
    ])('at %ipx (%s, %s) it dims the window behind as Ionic dims a lone modal, and keeps its shadow', async (width, layout, size) => {
      const { backdrop, shadow } = await over(width, dialog(layout, size));
      expect(backdrop).toBe('0.4');
      expect(shadow).toBe(SHADOW);
    });

    it('dark: the backdrop of a dialog over another window is as deep as the one over a page', async () => {
      expect((await over(1440, dialog('sheet'), true)).backdrop).toBe('0.6');
    });

    // Over a page, Ionic's own 0.4 (set on its shadow root's `:host`, which happy-dom does not apply) is said by the
    // dialog itself, with the 0.6 of dark: one value per theme for both cases.
    it('over a page it says Ionic\'s 0.4 itself, and 0.6 in dark', async () => {
      expect(await over(1440, dialog('sheet'), false, true)).toEqual({ backdrop: '0.4', shadow: SHADOW });
      expect((await over(1440, dialog('sheet'), true, true)).backdrop).toBe('0.6');
    });

    it('a window that is not a FormModal keeps Ionic\'s rule: nothing leaks to other modals', async () => {
      const { backdrop, shadow } = await over(1440, '<ion-modal class="ios modal-default show-modal" data-testid="front"></ion-modal>');
      expect(backdrop).toBe('0');
      expect(shadow).toBe('none');
    });
  });

  it('uses Ionic\'s spacing class and our tokens, never an `ok-*` one', () => {
    expect(sfc).toMatch(/ion-padding/);
    expect(sfc).not.toMatch(/--ok-|\bok-[a-z]/);
  });
});
