// `erploraVite()`: the Vite plugins every ERPlora SPA (hub-next, saas-next) shares. Ported from
// ERPlora hub `apps/web/vite.config.ts` (origin/develop); what is project-specific there (dev
// proxy, ports, base, manifest) stays in each project's own `vite.config.ts`.
//
//   - `@vitejs/plugin-vue`: every tag is a Vue component (`ion-*` come from `@ionic/vue`; there are
//     no custom elements of our own since OutfitKit left, PLAN §16.11). Templates compile at build
//     time: no `eval` at runtime.
//   - `unplugin-icons`: icons of any Iconify set baked at build time (PLAN §16.4), see `ICONS`.
//   - `@tailwindcss/vite` (v4): `src/shell/theme/global.css` starts with `@import "tailwindcss"
//     source(none)`; `erplora:tailwind-sources` adds the project's frontends to it (PoC issue B).
//   - `erplora:defines`: vue-i18n feature flags (the shell uses its Composition API only).
//   - `erplora:chunks`: bundle splitting (hub#798, plan §4.3), see `chunksPlugin()`.
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import icons from 'unplugin-icons/vite';
import type { Plugin, PluginOption, Rollup } from 'vite';

/** Root of this package: the installed `@iconify-json/*` sets are resolved from here. */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * `~icons/<set>/<name>` → its SVG string, rendered at build time from the `@iconify-json/<set>`
 * installed in this package (never from the network, never auto-installed); `shell/icons.ts`
 * registers it and `HubIcon` paints it through `ion-icon`. A string and not a Vue component (the
 * `vue3` compiler): the SVG then needs no second imitation of ion-icon's CSS, and the `?raw` query
 * that would give a string next to components is refused by Vite's dev server (`Denied ID`) for
 * these virtual ids. `scale: 1` gives the `1em` box of `ion-icon`. The sets are resolved from this
 * package, not from the cwd, so a project builds them without depending on them.
 */
const ICONS = { compiler: 'raw', autoInstall: false, scale: 1, collectionsNodeResolvePath: PACKAGE_ROOT } as const;

function definesPlugin(): Plugin {
  return {
    name: 'erplora:defines',
    config() {
      return {
        define: {
          __VUE_I18N_FULL_INSTALL__: 'true',
          __VUE_I18N_LEGACY_API__: 'false',
          __INTLIFY_PROD_DEVTOOLS__: 'false',
        },
      };
    },
  };
}

/** The package a resolved id belongs to (`vue`, `@ionic/core`…), plain or pnpm layout; none for our code. */
function packageOf(id: string): string | undefined {
  return id.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\//)?.[1];
}

function vendorOf(pkg: string): string | undefined {
  if (['vue', 'vue-router', 'vue-i18n'].includes(pkg) || pkg.startsWith('@vue/') || pkg.startsWith('@intlify/')) {
    return 'vendor-vue';
  }
  return undefined;
}

/**
 * Cache-stable vendor chunk: it changes only on a dependency bump, so an app change no longer
 * invalidates one 1.3 MB entry chunk. Everything else keeps Rollup's own assignment:
 *   - A module only reached through `import()` (an app page, Ionic's `p-*`) stays its own lazy
 *     chunk; grouping it would load every lazy component on the first one.
 *   - Stylesheets stay in the entry CSS: in a vendor chunk they would be linked after it, and
 *     `createShell` orders the theme sheets (variables, palettes, tabbar, polish) on purpose.
 *   - Ionic (`@ionic/vue`, `@ionic/core`, `@ionic/vue-router`, `ionicons`) is NOT grouped, as in
 *     hub#798: a manual chunk keeps every export of the `@ionic/vue` barrel, so the components the
 *     tree-shaking dropped come back (measured here: 137 `ion-*` instead of 85, +390 kB raw,
 *     +74 kB gzip, and Ionic's lazy chunks swallowed). Ionic stays in the entry, tree-shaken.
 */
const manualChunks: Rollup.GetManualChunk = (id, { getModuleInfo }) => {
  const pkg = packageOf(id);
  if (!pkg || /\.css(?:$|\?)/.test(id)) return undefined;
  const info = getModuleInfo(id);
  if (info && info.importers.length === 0 && info.dynamicImporters.length > 0) return undefined;
  return vendorOf(pkg);
};

/**
 * hub#798 (ERPlora hub `apps/web/vite.config.ts`, origin/develop): Stencil's `@ionic/core`
 * component modules open with unannotated top-level calls (`proxyCustomElement(…)`), so Rollup
 * keeps all 140+ components `@ionic/vue` re-exports (~400 kB never used). Their only real side
 * effect is the exported `defineCustomElement()`, called explicitly (by `@ionic/vue` when a wrapper
 * mounts or a controller is used): nothing registers at import time, so the registered elements do
 * not change. JS only: CSS stays side-effectful.
 */
function moduleSideEffects(id: string): boolean {
  return !(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@ionic\/core\//.test(id) && id.endsWith('.js'));
}

function chunksPlugin(): Plugin {
  return {
    name: 'erplora:chunks',
    config() {
      return { build: { rollupOptions: { treeshake: { moduleSideEffects }, output: { manualChunks } } } };
    },
  };
}

/** Forward slashes: Vite ids and Tailwind `@source` paths use them on every OS. */
const slash = (path: string): string => path.replaceAll('\\', '/');

/** The shell stylesheet that imports Tailwind, with `source(none)` (automatic detection off). */
const SHELL_GLOBAL_CSS = slash(join(dirname(fileURLToPath(import.meta.url)), 'shell/theme/global.css'));

/**
 * Where Tailwind reads class names in a project, from its Vite `root`, unless the project names its
 * own (`frontendSources`): the entry's `frontend/` and the modules' `apps/<id>/frontend/` (hub-next).
 */
const PROJECT_SOURCES = ['frontend/**/*.{vue,ts}', 'apps/*/frontend/**/*.{vue,ts}'];
const PROJECT_EXCLUDED = ['**/*.test.ts'];

/**
 * PoC issue B: Tailwind's automatic source detection scanned the whole project, so a `.py` change
 * made `@tailwindcss/vite` send `full-reload` to every open tab, and the comments of
 * `tests/e2e/*.ts` turned into classes. `global.css` scans only the UI package; this appends the
 * project's own frontends to it, relative to the Vite `root`, before Tailwind compiles it (a
 * separate stylesheet cannot do it: every stylesheet is its own Tailwind compilation).
 */
function tailwindSourcesPlugin(frontendSources: readonly string[]): Plugin {
  let root = process.cwd();
  return {
    name: 'erplora:tailwind-sources',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      if (slash(id.split('?')[0]) !== SHELL_GLOBAL_CSS) return undefined;
      const base = slash(relative(dirname(SHELL_GLOBAL_CSS), root)) || '.';
      const sources = [
        ...frontendSources.map((glob) => `@source "${base}/${glob}";`),
        ...PROJECT_EXCLUDED.map((glob) => `@source not "${base}/${glob}";`),
      ];
      // Appended at the end: the lines above keep their positions, so no source map is needed.
      return { code: `${code}\n/* erplora:tailwind-sources (src/vite.ts) */\n${sources.join('\n')}\n`, map: null };
    },
  };
}

export interface ErploraViteOptions {
  /**
   * Globs of the project's frontends, relative to its Vite `root`, where Tailwind reads class names
   * (`*.test.ts` always excluded). Default: `frontend/` and `apps/<id>/frontend/`. saas-next has no
   * `apps/` (PLAN §20.2) and names its root apps (`accounts/frontend/…`).
   */
  frontendSources?: readonly string[];
}

/** The shared plugins. Spread them into a project's `plugins`. */
export function erploraVite({ frontendSources = PROJECT_SOURCES }: ErploraViteOptions = {}): PluginOption[] {
  return [
    vue(),
    icons(ICONS),
    tailwindSourcesPlugin(frontendSources),
    tailwindcss(),
    definesPlugin(),
    chunksPlugin(),
  ];
}
