<script setup lang="ts">
// An answer of the assistant with its format (BASE-G113): the tree of `markdown.ts` painted with Vue's
// own elements — never `v-html`, so nothing the model writes is a tag. A link only to a screen this app serves
// (`screenExists`), named as the menu names it when the answer gave it no label (`nameOf`, BASE-G114); clicking it
// emits `go` (the panel navigates). Any other path is text. A table fits the bubble, or scrolls inside its own box; a
// quote (`> …`, the model's warnings) is a block set apart, with the answer's own format inside it.
import { computed, type FunctionalComponent, h, type VNodeChild } from 'vue';

import { type Block, type Inline, parseMarkdown } from './markdown';

const props = defineProps<{
  text: string;
  screenExists: (path: string) => boolean;
  nameOf: (path: string) => string | undefined;
}>();
const emit = defineEmits<{ go: [path: string] }>();

const blocks = computed(() => parseMarkdown(props.text));

function paint(inline: Inline): VNodeChild {
  switch (inline.kind) {
    case 'text':
      return inline.text;
    case 'strong':
      return h('strong', inline.children.map(paint));
    case 'em':
      return h('em', inline.children.map(paint));
    case 'code':
      return h('code', inline.text);
    case 'link': {
      const label = inline.label ? inline.label.map(paint) : (props.nameOf(inline.path) ?? inline.path);
      if (!props.screenExists(inline.path)) return h('span', label);
      return h(
        'a',
        {
          class: 'assistant-link',
          href: inline.path,
          onClick: (event: MouseEvent) => {
            event.preventDefault();
            emit('go', inline.path);
          },
        },
        label,
      );
    }
  }
}

const cells = (tag: 'th' | 'td', row: Inline[][]) => h('tr', row.map((cell) => h(tag, cell.map(paint))));

function paintBlock(block: Block): VNodeChild {
  switch (block.kind) {
    case 'paragraph':
      return h('p', block.inlines.map(paint));
    case 'heading':
      return h(`h${Math.min(block.level + 2, 6)}`, { class: 'assistant-md-heading' }, block.inlines.map(paint));
    case 'list':
      return h(block.ordered ? 'ol' : 'ul', block.items.map((item) => h('li', item.map(paint))));
    case 'table':
      return h('div', { class: 'assistant-table' }, [
        h('table', [h('thead', [cells('th', block.head)]), h('tbody', block.rows.map((row) => cells('td', row)))]),
      ]);
    case 'quote':
      return h('blockquote', { class: 'assistant-quote' }, block.blocks.map(paintBlock));
  }
}

// What `h()` paints carries no scope of this file: the styles below reach it through `:deep()`.
const Blocks: FunctionalComponent<{ blocks: Block[] }> = (inner) => inner.blocks.map(paintBlock);
</script>

<template>
  <div class="assistant-md">
    <Blocks :blocks="blocks" />
  </div>
</template>

<style scoped>
.assistant-md {
  overflow-wrap: anywhere;
  line-height: 1.45;
}
.assistant-md :deep(p) {
  margin: 0 0 8px;
  white-space: pre-line;
}
.assistant-md :deep(p:last-child),
.assistant-md :deep(ul:last-child),
.assistant-md :deep(ol:last-child),
.assistant-md :deep(.assistant-table:last-child),
.assistant-md :deep(.assistant-quote:last-child) {
  margin-bottom: 0;
}
/* The page's reset takes the markers away: a list says it is one. */
.assistant-md :deep(ul) {
  list-style: disc;
}
.assistant-md :deep(ol) {
  list-style: decimal;
}
.assistant-md :deep(ul),
.assistant-md :deep(ol) {
  margin: 0 0 8px;
  padding-inline-start: 20px;
}
.assistant-md :deep(.assistant-md-heading) {
  margin: 4px 0 6px;
  font-size: 1em;
  font-weight: 600;
}
.assistant-md :deep(code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--ion-color-light, #f4f5f8);
  font-size: 0.92em;
}
.assistant-md :deep(.assistant-link) {
  color: var(--ion-color-primary);
  text-decoration: underline;
  cursor: pointer;
}
/* A table fits the bubble, its long cells broken between words; one that still cannot (many columns) scrolls inside
   its own box: at 390 px the panel never moves sideways (BASE-G113). */
.assistant-md :deep(.assistant-table) {
  max-width: 100%;
  margin: 0 0 8px;
  overflow-x: auto;
}
.assistant-md :deep(.assistant-table table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92em;
}
.assistant-md :deep(.assistant-table th),
.assistant-md :deep(.assistant-table td) {
  min-width: 4.5em;
  padding: 4px 8px;
  border: 1px solid var(--ion-color-step-150, #e3e3e3);
  text-align: start;
  vertical-align: top;
  overflow-wrap: break-word;
}
.assistant-md :deep(.assistant-table th) {
  font-weight: 600;
}
/* A quote (the model's warnings) is set apart by a bar at its start and a faint tint of the same colour, readable on
   the bubble in light and dark; its own paragraphs and lists keep the answer's format. */
.assistant-md :deep(.assistant-quote) {
  margin: 0 0 8px;
  padding: 6px 10px;
  border-inline-start: 3px solid var(--ep-text-muted, #646b78);
  border-start-end-radius: var(--ep-radius-sm, 10px);
  border-end-end-radius: var(--ep-radius-sm, 10px);
  background: color-mix(in srgb, var(--ep-text-muted, #646b78) 8%, transparent);
}
</style>
