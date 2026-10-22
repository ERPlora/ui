// The accessible-name guardrail (UX audit 2, R-03): what axe's `role-img-alt` and `button-name`
// check, in a DOM happy-dom can build. Ionic paints every `ion-icon` as `role="img"`, so an icon is
// either hidden from assistive tech (`aria-hidden="true"`, the decorative case) or named; a button
// is named by its text or its `aria-label`, never by an icon alone.
import { describe, expect, it } from 'vitest';

import { bareIonIcons, unnamedButtons, unnamedIcons } from './a11y';

function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

const tags = (els: Element[]): string[] => els.map((el) => el.getAttribute('data-id') ?? el.tagName.toLowerCase());

describe('unnamedIcons', () => {
  it('reports an ion-icon that assistive tech reaches without a name', () => {
    const root = dom(`
      <ion-icon data-id="bare"></ion-icon>
      <ion-icon data-id="hidden" aria-hidden="true"></ion-icon>
      <ion-icon data-id="named" aria-label="Overdue" role="img"></ion-icon>
      <ion-icon data-id="labelled-by" aria-labelledby="x"></ion-icon>
      <ion-icon data-id="empty-name" aria-label=" "></ion-icon>
      <ion-button aria-label="Delete"><ion-icon data-id="in-named-button" slot="icon-only"></ion-icon></ion-button>`);
    expect(tags(unnamedIcons(root))).toEqual(['bare', 'empty-name', 'in-named-button']);
  });

  it('skips what an ancestor hides (aria-hidden, inert)', () => {
    const root = dom(`
      <div aria-hidden="true"><ion-icon data-id="a"></ion-icon></div>
      <ion-button inert><ion-icon data-id="b"></ion-icon></ion-button>
      <ion-icon data-id="c" aria-hidden="false"></ion-icon>`);
    expect(tags(unnamedIcons(root))).toEqual(['c']);
  });
});

describe('unnamedButtons', () => {
  it('reports a button whose only content is a hidden icon and that has no aria-label', () => {
    const root = dom(`
      <ion-button data-id="icon-only"><ion-icon aria-hidden="true"></ion-icon></ion-button>
      <button data-id="native-icon-only" type="button"><ion-icon aria-hidden="true"></ion-icon></button>
      <ion-segment-button data-id="segment"><ion-icon aria-hidden="true"></ion-icon></ion-segment-button>
      <span data-id="role" role="button"></span>
      <ion-button data-id="text"><ion-icon aria-hidden="true"></ion-icon>Save</ion-button>
      <ion-button data-id="labelled" aria-label="Next page"><ion-icon aria-hidden="true"></ion-icon></ion-button>
      <button data-id="by" aria-labelledby="t" type="button"></button>
      <button data-id="titled" title="Close" type="button"></button>`);
    expect(tags(unnamedButtons(root))).toEqual(['icon-only', 'native-icon-only', 'segment', 'role']);
  });

  it('reads the name Ionic moved into its shadow root (ion-button hands aria-label to its native button)', () => {
    const root = dom(`<ion-button data-id="hydrated"><ion-icon aria-hidden="true"></ion-icon></ion-button>
      <ion-button data-id="hydrated-unnamed"><ion-icon aria-hidden="true"></ion-icon></ion-button>`);
    const [named, unnamed] = root.querySelectorAll('ion-button');
    named.attachShadow({ mode: 'open' }).innerHTML = '<button class="button-native" aria-label="Previous page"><slot></slot></button>';
    unnamed.attachShadow({ mode: 'open' }).innerHTML = '<button class="button-native"><slot></slot></button>';
    expect(tags(unnamedButtons(root))).toEqual(['hydrated-unnamed']);
  });

  it('does not count hidden text as a name, and skips hidden buttons', () => {
    const root = dom(`
      <button data-id="hidden-text" type="button"><span aria-hidden="true">×</span></button>
      <ion-button data-id="gap" aria-hidden="true"><ion-icon></ion-icon></ion-button>
      <div inert><button data-id="inert" type="button"></button></div>`);
    expect(tags(unnamedButtons(root))).toEqual(['hidden-text']);
  });
});

describe('bareIonIcons (the static twin, for a whole tree of templates)', () => {
  it('returns every <ion-icon> tag with neither aria-hidden nor a name, multi-line or not', () => {
    const source = `
      <template>
        <ion-icon :icon="icon(ICONS.add)" slot="start" />
        <ion-icon
          slot="icon-only"
          :icon="icon(action.icon)"
        />
        <ion-icon :icon="x" aria-hidden="true" />
        <ion-icon :icon="x" :aria-hidden="hide" />
        <ion-icon name="warning" aria-label="Overdue" />
        <ion-icon name="warning" :aria-label="t('overdue')" />
        <ion-icon :name="paint.name" v-bind="a11y" />
        <IonIcon :icon="y" @click="() => a > b" />
      </template>`;
    expect(bareIonIcons(source).map((tag) => tag.replace(/\s+/g, ' '))).toEqual([
      '<ion-icon :icon="icon(ICONS.add)" slot="start" />',
      '<ion-icon slot="icon-only" :icon="icon(action.icon)" />',
      '<IonIcon :icon="y" @click="() => a > b" />',
    ]);
  });

  it('ignores the words in comments and strings that are not tags', () => {
    expect(bareIonIcons('// an ion-icon is role="img"; <ion-icons> is not one')).toEqual([]);
  });
});
