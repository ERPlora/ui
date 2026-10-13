// @vitest-environment node
// (Node, not happy-dom: one test runs a real Vite build.)
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin, type PluginOption, type Rollup, type UserConfig } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

import * as viteModule from './vite';
import { erploraVite } from './vite';

const SHELL_GLOBAL_CSS = join(dirname(fileURLToPath(import.meta.url)), 'shell/theme/global.css');

function flat(options: PluginOption[]): Plugin[] {
  return (options.flat(Infinity as 1) as unknown[]).filter(Boolean) as Plugin[];
}

function plugin(name: string): Plugin {
  const found = flat(erploraVite()).find((p) => p.name === name);
  if (!found) throw new Error(`plugin ${name} not found`);
  return found;
}

describe('erploraVite', () => {
  it('includes Vue and Tailwind v4', () => {
    const names = flat(erploraVite()).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['vite:vue', '@tailwindcss/vite:scan', 'erplora:defines']));
  });

  it('compiles every tag as a Vue component: no custom-element escape hatch (OutfitKit is gone, PLAN §16.11)', () => {
    const vue = plugin('vite:vue') as Plugin & {
      api: { options: { template?: { compilerOptions?: { isCustomElement?: unknown } } } };
    };
    expect(vue.api.options.template?.compilerOptions?.isCustomElement).toBeUndefined();
    expect(Object.keys(viteModule)).not.toContain('isCustomElement');
  });

  it('sets the vue-i18n feature flags (Composition API only, no devtools in prod)', () => {
    const hook = plugin('erplora:defines').config as (...args: unknown[]) => UserConfig;
    expect(hook({}, { command: 'build', mode: 'production' }).define).toEqual({
      __VUE_I18N_FULL_INSTALL__: 'true',
      __VUE_I18N_LEGACY_API__: 'false',
      __INTLIFY_PROD_DEVTOOLS__: 'false',
    });
  });
});

// hub#798 (reference: ERPlora hub `apps/web/vite.config.ts`, origin/develop) + plan §4.3.
describe('erploraVite: bundle splitting', () => {
  type ModuleInfo = { importers: string[]; dynamicImporters: string[] };
  type ManualChunks = (id: string, meta: { getModuleInfo: (id: string) => ModuleInfo | null }) => string | undefined;
  type SideEffects = (id: string, external: boolean) => boolean;

  function rollup() {
    const hook = plugin('erplora:chunks').config as (...args: unknown[]) => UserConfig;
    const options = hook({}, { command: 'build', mode: 'production' }).build?.rollupOptions;
    const output = options?.output as { manualChunks?: unknown } | undefined;
    const treeshake = options?.treeshake as { moduleSideEffects?: unknown } | undefined;
    expect(typeof output?.manualChunks).toBe('function');
    expect(typeof treeshake?.moduleSideEffects).toBe('function');
    return { manualChunks: output?.manualChunks as ManualChunks, moduleSideEffects: treeshake?.moduleSideEffects as SideEffects };
  }

  /** A pnpm-resolved id: `/repo/node_modules/.pnpm/<pkg>@<v>/node_modules/<pkg>/<file>`. */
  const pnpm = (pkg: string, file: string) =>
    `/repo/node_modules/.pnpm/${pkg.replace('/', '+')}@1.0.0/node_modules/${pkg}/${file}`;
  /** A module imported statically by the entry (the common case). */
  const eager = { getModuleInfo: () => ({ importers: ['/repo/hub-next/frontend/main.ts'], dynamicImporters: [] }) };
  /** A module only reached through `import()`: a lazy chunk of its own. */
  const lazy = { getModuleInfo: () => ({ importers: [], dynamicImporters: ['/repo/hub-next/apps/demo/frontend/routes.ts'] }) };

  it('groups Vue, its router and vue-i18n in vendor-vue', () => {
    const { manualChunks } = rollup();
    expect(manualChunks('/repo/node_modules/.pnpm/vue@3.5.22/node_modules/vue/index.js', eager)).toBe('vendor-vue');
    for (const [pkg, file] of [
      ['vue', 'dist/vue.runtime.esm-bundler.js'],
      ['@vue/runtime-core', 'dist/runtime-core.esm-bundler.js'],
      ['vue-router', 'dist/vue-router.mjs'],
      ['vue-i18n', 'dist/vue-i18n.mjs'],
      ['@intlify/core-base', 'dist/core-base.mjs'],
    ]) {
      expect(manualChunks(pnpm(pkg, file), eager), pkg).toBe('vendor-vue');
    }
    expect(manualChunks('/repo/node_modules/vue-router/dist/vue-router.mjs', eager)).toBe('vendor-vue');
  });

  it('has Vue as its only vendor chunk: the Lit one left with the Web Components library (PLAN §16.11)', () => {
    const { manualChunks } = rollup();
    for (const [pkg, file] of [
      ['lit', 'index.js'],
      ['lit-html', 'lit-html.js'],
      ['lit-element', 'lit-element.js'],
      ['@lit/reactive-element', 'reactive-element.js'],
    ]) {
      expect(manualChunks(pnpm(pkg, file), eager), pkg).toBeUndefined();
    }
  });

  it('leaves Ionic in the entry, tree-shaken (grouping it brings back every unused component, hub#798)', () => {
    const { manualChunks } = rollup();
    expect(manualChunks(pnpm('@ionic/core', 'components/ion-datetime.js'), eager)).toBeUndefined();
    expect(manualChunks(pnpm('@ionic/vue', 'dist/index.js'), eager)).toBeUndefined();
    expect(manualChunks(pnpm('@ionic/vue-router', 'dist/index.js'), eager)).toBeUndefined();
    expect(manualChunks(pnpm('ionicons', 'components/ion-icon.js'), eager)).toBeUndefined();
  });

  it('keeps lazy chunks lazy: a module only reached through import() is never grouped', () => {
    const { manualChunks } = rollup();
    expect(manualChunks(pnpm('vue-i18n', 'dist/vue-i18n.mjs'), lazy)).toBeUndefined();
    expect(manualChunks(pnpm('@ionic/core', 'components/p-D7bSXQD3.js'), lazy)).toBeUndefined();
  });

  it('leaves stylesheets in the entry CSS, so the cascade keeps the import order of createShell', () => {
    const { manualChunks } = rollup();
    expect(manualChunks(pnpm('@vue/runtime-dom', 'dist/style.css'), eager)).toBeUndefined();
    expect(manualChunks(`${pnpm('@vue/runtime-dom', 'dist/style.css')}?direct`, eager)).toBeUndefined();
    expect(manualChunks(pnpm('@ionic/vue', 'css/core.css'), eager)).toBeUndefined();
  });

  it('leaves app code, workspace packages and look-alike packages to Rollup', () => {
    const { manualChunks } = rollup();
    expect(manualChunks('/repo/hub-next/apps/demo/frontend/pages/ItemListPage.vue', eager)).toBeUndefined();
    expect(manualChunks('/repo/packages/ui/src/shell/App.vue', eager)).toBeUndefined();
    expect(manualChunks(pnpm('vue-demi', 'lib/index.mjs'), eager)).toBeUndefined();
    expect(manualChunks(pnpm('@iconify-json/ion', 'icons.json'), eager)).toBeUndefined();
    expect(manualChunks('\0vite/preload-helper.js', eager)).toBeUndefined();
  });

  it("marks @ionic/core's JS side-effect-free and keeps everything else as Rollup analyses it", () => {
    const { moduleSideEffects } = rollup();
    expect(moduleSideEffects(pnpm('@ionic/core', 'components/ion-input-otp.js'), false)).toBe(false);
    expect(moduleSideEffects('/repo/node_modules/@ionic/core/components/ion-datetime.js', false)).toBe(false);
    expect(moduleSideEffects(pnpm('@ionic/core', 'css/ionic.bundle.css'), false)).toBe(true);
    expect(moduleSideEffects(pnpm('@ionic/vue', 'dist/index.js'), false)).toBe(true);
    expect(moduleSideEffects(pnpm('vue', 'dist/vue.runtime.esm-bundler.js'), false)).toBe(true);
    expect(moduleSideEffects('/repo/packages/ui/src/shell/createShell.ts', false)).toBe(true);
  });
});

// PLAN §16.4: icons of any Iconify set are SVG baked into the bundle at build time (`unplugin-icons`
// over the installed `@iconify-json/*`), never fetched at runtime (CSP `connect-src` has no external
// hosts). The sets are resolved from this package, so hub-next and saas-next build them without
// depending on `@iconify-json/*` themselves.
describe('erploraVite: icons baked at build time', () => {
  let root: string | undefined;
  const cwd = process.cwd();
  afterEach(() => {
    process.chdir(cwd);
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  /** Builds `entry` from a project with no `node_modules`, run from there (as `pnpm --filter hub build`). */
  async function buildFrom(entry: string): Promise<string> {
    root = mkdtempSync(join(tmpdir(), 'erplora-icons-'));
    writeFileSync(join(root, 'main.js'), entry);
    process.chdir(root);
    const output = (await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: erploraVite(),
      build: {
        write: false,
        minify: false,
        lib: { entry: join(root, 'main.js'), formats: ['es'] },
        rollupOptions: { external: ['vue'] },
      },
    })) as Rollup.RollupOutput[];
    return output[0].output.map((file) => (file.type === 'chunk' ? file.code : '')).join('\n');
  }

  it('includes unplugin-icons', () => {
    expect(flat(erploraVite()).map((p) => p.name)).toContain('unplugin-icons');
  });

  it('bakes `~icons/<set>/<name>` as its SVG string with the 1em box of ion-icon, from the installed sets', async () => {
    const code = await buildFrom(
      "import cart from '~icons/mdi/cart';\nimport back from '~icons/lucide/arrow-left';\nexport { cart, back };\n",
    );
    expect(code).toMatch(/<svg viewBox="0 0 24 24" width="1em" height="1em"\s*><path fill="currentColor"/);
    expect(code).toContain('stroke="currentColor"');
    expect(code).not.toContain('iconify.design');
  }, 60_000);

  it('compiles to a plain string, never a component nor a `?raw` id (the dev server denies `?raw` virtual ids)', async () => {
    const code = await buildFrom("export { default } from '~icons/material-symbols/point-of-sale';\n");
    expect(code).not.toMatch(/from "vue"/);
    expect(code).toMatch(/const pointOfSale = '<svg /);
  }, 60_000);

  it('never installs a set on its own: an icon of a set that is not installed fails the build', async () => {
    await expect(buildFrom("export { default } from '~icons/fa6-solid/house';\n")).rejects.toThrow('Icon `fa6-solid/house` not found');
  }, 60_000);
});

// PoC issue B: with Tailwind's automatic source detection, `@tailwindcss/vite` scanned the whole
// project (`.py` included) and sent `full-reload` to every tab on a Python change; it also read
// `tests/e2e/*.ts` and generated the classes named in their comments.
describe('erploraVite: Tailwind sources', () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function write(file: string, content: string): void {
    mkdirSync(dirname(join(root!, file)), { recursive: true });
    writeFileSync(join(root!, file), content);
  }

  it('global.css turns automatic detection off and scans only the UI package sources, tests excluded', () => {
    const css = readFileSync(SHELL_GLOBAL_CSS, 'utf8');
    expect(css).toMatch(/^@import "tailwindcss" source\(none\);$/m);
    expect(css).toMatch(/^@source "\.\.\/\.\.\/\*\*\/\*\.\{vue,ts\}";$/m);
    expect(css).toMatch(/^@source not "\.\.\/\.\.\/\*\*\/\*\.test\.ts";$/m);
  });

  /** The globs `erplora:tailwind-sources` appends to global.css, relative to the Vite `root` (`not ` for an exclusion). */
  function projectSources(plugins: PluginOption[], viteRoot: string): string[] {
    const sources = flat(plugins).find((p) => p.name === 'erplora:tailwind-sources');
    if (!sources) throw new Error('plugin erplora:tailwind-sources not found');
    (sources.configResolved as unknown as (config: { root: string }) => void)({ root: viteRoot });
    const transform = sources.transform as unknown as (code: string, id: string) => { code: string };
    const base = relative(dirname(SHELL_GLOBAL_CSS), viteRoot);
    return [...transform('', SHELL_GLOBAL_CSS).code.matchAll(/^@source (not )?"([^"]+)";$/gm)].map(
      ([, not, glob]) => `${not ?? ''}${glob.slice(base.length + 1)}`,
    );
  }

  it("by default adds the project's frontend/ and apps/*/frontend/ (hub-next's anatomy), tests excluded", () => {
    expect(projectSources(erploraVite(), '/repo/hub-next')).toEqual([
      'frontend/**/*.{vue,ts}',
      'apps/*/frontend/**/*.{vue,ts}',
      'not **/*.test.ts',
    ]);
  });

  it('adds the frontends a project names instead (saas-next keeps its apps at the root, PLAN §20.2)', () => {
    const frontendSources = ['frontend/**/*.{vue,ts}', 'accounts/frontend/**/*.{vue,ts}'];
    expect(projectSources(erploraVite({ frontendSources }), '/repo/saas-next')).toEqual([
      ...frontendSources,
      'not **/*.test.ts',
    ]);
  });

  it('adds the project sources before Tailwind compiles (its plugins run in array order)', () => {
    const names = flat(erploraVite()).map((p) => p.name);
    const sources = names.indexOf('erplora:tailwind-sources');
    expect(sources).toBeGreaterThan(-1);
    for (const [index, name] of names.entries()) {
      if (name.startsWith('@tailwindcss/vite')) expect(index, name).toBeGreaterThan(sources);
    }
    expect(plugin('erplora:tailwind-sources').enforce).toBe('pre');
  });

  it("generates classes from the project's frontend/ and apps/*/frontend/ only: never .py, e2e or unit tests", async () => {
    root = mkdtempSync(join(tmpdir(), 'erplora-tw-'));
    write('frontend/main.ts', `import ${JSON.stringify(SHELL_GLOBAL_CSS)};\nexport const shell = 'bg-[#100001]';\n`);
    write('apps/demo/frontend/pages/Page.vue', '<template><div class="bg-[#100002]" /></template>\n');
    write('apps/demo/frontend/pages/Page.test.ts', "it('x', () => 'bg-[#200001]');\n");
    write('apps/demo/queries.py', '# bg-[#200002]\n');
    write('apps/demo/templates/demo/page.html', '<div class="bg-[#200003]"></div>\n');
    write('tests/e2e/demo.spec.ts', '// .bg-[#200004]\n');
    write('frontend/dist/assets/old.js', '"bg-[#200005]"\n');

    const output = (await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: erploraVite(),
      build: { write: false, rollupOptions: { input: join(root, 'frontend/main.ts') } },
    })) as Rollup.RollupOutput;
    const css = output.output
      .filter((file): file is Rollup.OutputAsset => file.type === 'asset' && file.fileName.endsWith('.css'))
      .map((file) => String(file.source))
      .join('\n');

    expect(css).toContain('#100001');
    expect(css).toContain('#100002');
    for (const leaked of ['#200001', '#200002', '#200003', '#200004', '#200005']) {
      expect(css, leaked).not.toContain(leaked);
    }
  }, 60_000);
});
