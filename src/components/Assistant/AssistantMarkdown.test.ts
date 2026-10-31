// BASE-G113 and G114: an answer painted with its format — never as HTML —, its links only to screens this app serves,
// named as the menu names them; a table scrolls inside its own box; a quote (the model's warnings) is set apart.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { compileStyle, parse } from 'vue/compiler-sfc';

import { mountAssistant } from './__tests__/mount-assistant';
import AssistantMarkdown from './AssistantMarkdown.vue';

function mountText(text: string) {
  return mountAssistant(AssistantMarkdown, {
    props: {
      text,
      screenExists: (path: string) => path.startsWith('/settings') || path === '/customer/customers',
      nameOf: (path: string) => (path === '/customer/customers' ? 'Clientes' : undefined),
    },
  });
}

/** The selectors of the component's own stylesheet, compiled as the build compiles them (scoped to `id`). */
function compiledSelectors(id: string): string[] {
  const filename = join(dirname(fileURLToPath(import.meta.url)), 'AssistantMarkdown.vue');
  const { descriptor } = parse(readFileSync(filename, 'utf8'));
  return descriptor.styles.flatMap((style) => {
    const { code, errors } = compileStyle({ source: style.content, filename, id, scoped: style.scoped });
    expect(errors).toEqual([]);
    return [...code.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
      .flatMap((rule) => rule[1].split(','))
      .map((selector) => selector.trim())
      .filter((selector) => selector !== '' && !selector.startsWith('@'));
  });
}

describe('AssistantMarkdown', () => {
  it('paints bold, lists and a table in its own scrolling box', async () => {
    const { wrapper } = await mountText('**Hoy**\n\n- Uno\n- Dos\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(wrapper.find('strong').text()).toBe('Hoy');
    expect(wrapper.findAll('li').map((li) => li.text())).toEqual(['Uno', 'Dos']);
    expect(wrapper.find('.assistant-table table th').text()).toBe('A');
    wrapper.unmount();
  });

  it('never turns what the model writes into HTML', async () => {
    const { wrapper } = await mountText('<img src=x onerror=alert(1)> **ok**');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>');
    wrapper.unmount();
  });

  it('a link to a screen of this app leads there; a bare path is named as the menu names it', async () => {
    const { wrapper } = await mountText('Ve a [tus ajustes](/settings#business) o a /customer/customers.');
    const links = wrapper.findAll('a.assistant-link');
    expect(links.map((link) => [link.text(), link.attributes('href')])).toEqual([
      ['tus ajustes', '/settings#business'],
      ['Clientes', '/customer/customers'],
    ]);
    await links[0].trigger('click');
    expect(wrapper.emitted('go')).toEqual([['/settings#business']]);
    wrapper.unmount();
  });

  it('a screen this app does not serve is plain text, no link', async () => {
    const { wrapper } = await mountText('Mira [informes](/reports).');
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).toBe('Mira informes.');
    wrapper.unmount();
  });

  // QA battery 2026-10-31 (B21, B25): «> ⚠️ …» showed as a literal line; the warning is a quoted block.
  it('paints a quote as a quote: its marks read inside it, never a literal «>»', async () => {
    const { wrapper } = await mountText('Confirma el cierre.\n\n> 📌 La sesión cerrada **no** se puede reabrir.\n>\n> - Cuenta el cajón');
    const quote = wrapper.find('blockquote.assistant-quote');
    expect(quote.exists()).toBe(true);
    expect(quote.find('strong').text()).toBe('no');
    expect(quote.findAll('p').map((p) => p.text())).toEqual(['📌 La sesión cerrada no se puede reabrir.']);
    expect(quote.findAll('li').map((li) => li.text())).toEqual(['Cuenta el cajón']);
    expect(wrapper.find('p').text()).toBe('Confirma el cierre.');
    expect(wrapper.text()).not.toContain('>');
    wrapper.unmount();
  });

  it('a quote inside a quote is nested, and a link inside one still leads to its screen', async () => {
    const { wrapper } = await mountText('> Fuera\n>> Ve a [tus ajustes](/settings).');
    expect(wrapper.findAll('blockquote blockquote').length).toBe(1);
    const link = wrapper.find('blockquote blockquote a.assistant-link');
    expect([link.text(), link.attributes('href')]).toEqual(['tus ajustes', '/settings']);
    await link.trigger('click');
    expect(wrapper.emitted('go')).toEqual([['/settings']]);
    wrapper.unmount();
  });

  it('a tag inside a quote is text, never HTML', async () => {
    const { wrapper } = await mountText('> <img src=x onerror=alert(1)>');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('blockquote').text()).toBe('<img src=x onerror=alert(1)>');
    wrapper.unmount();
  });

  it('its own styles reach everything it paints, quotes, code and links included', async () => {
    const { wrapper } = await mountText(
      '## Caja\n\nUsa `x` y [tus ajustes](/settings).\n\n- uno\n\n1. dos\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> ⚠️ Aviso\n> - tres\n> - cuatro\n\nFin.',
    );
    const id = (AssistantMarkdown as { __scopeId?: string }).__scopeId;
    expect(id).toMatch(/^data-v-/);
    const selectors = compiledSelectors(id ?? '');
    // Every element a rule of the stylesheet is written for (a list item takes its look from its list), none of them the
    // last of its parent: a rule for the last one alone does not count.
    const painted = ['h4', 'p', 'code', 'a.assistant-link', 'ul', 'ol', '.assistant-table', 'th', 'td', 'blockquote', 'blockquote p', 'blockquote ul'];
    const unstyled = painted.filter((query) => {
      const element = wrapper.find(query);
      expect(element.exists(), query).toBe(true);
      return !selectors.some((selector) => element.element.matches(selector));
    });
    expect(unstyled).toEqual([]);
    wrapper.unmount();
  });
});
