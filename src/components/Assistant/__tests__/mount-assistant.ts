// Test helper of the assistant's chat: the SDK's live harness (fake network serving the API), the shell's i18n with
// the chat's words (`assistantMessages`) and a host's own (`host.*`: the verbs of its writes, its screens), a session,
// the shell's config, a memory router with the routes a test names and Ionic's router API on it, and the chat
// configured as a host configures it when it boots (`HOST_CONFIG`, each test may change a piece). The shell's icons are
// registered, as `createShell` registers them when an app starts, and what a test mounted is unmounted when it ends
// (the panel listens on the document: one left mounted would answer the next test's keys).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { addIcons } from 'ionicons';
import { afterEach, vi } from 'vitest';
import { type Component, createApp, ref } from 'vue';
import { createMemoryHistory, createRouter, type RouteLocationRaw, type Router, type RouteRecordRaw } from 'vue-router';

import { type ApiHandler, createTestClient } from '../../../sdk/__tests__/live-harness';
import { LIVE_CLIENT_KEY } from '../../../sdk/live-client';
import { createShellI18n } from '../../../shell/i18n';
import { ION_ICONS } from '../../../shell/icons';
import { provideSession, type SessionMe, type SessionStatus } from '../../../shell/session';
import { provideShellConfig } from '../../../shell/shell-config';
import { type AssistantConfig, configureAssistant } from '../config';
import { assistantMessages } from '../messages';

export { errorFrame, flush, resultFrame } from '../../../sdk/__tests__/live-harness';

addIcons(ION_ICONS);
enableAutoUnmount(afterEach);

/** Who may use the assistant and who may upgrade the plan, in the test host's words. */
export const USE = 'assistant.use';
export const UPGRADE = 'plan.upgrade';

export const OWNER: SessionMe = {
  user: { id: 'u1', label: 'Ana' },
  permissions: [USE, UPGRADE],
  menu: [],
  apps: [],
  language: 'en',
};

export const EMPLOYEE: SessionMe = { ...OWNER, user: { id: 'u2', label: 'Leo' }, permissions: [USE] };

/** A host's own words: the verb of each action of its writes, the writes whose action's verb does not say what they do,
 *  its platform's screens (the Hub's, as its catalogue says them) and a line under a spent allowance (erplora.com's). */
export const HOST_MESSAGES = {
  en: {
    host: {
      verbs: {
        create: 'Create', delete: 'Delete', rectify: 'Rectify', mark_paid: 'Record the payment', remove: 'Remove',
        settings_update: 'Change', bulk_delete: 'Delete', close: 'Close', add: 'Add', clear: 'Clear',
      },
      operations: { cart_checkout: { cart: { clear: 'Clear' } }, cash_register: { count: { add: 'Register count' } } },
      screens: { home: 'Home', settings: 'Settings' },
      spentNote: 'Each business has its own assistant.',
    },
  },
  es: {
    host: {
      verbs: {
        create: 'Crear', delete: 'Borrar', rectify: 'Rectificar', mark_paid: 'Registrar el cobro', remove: 'Quitar',
        settings_update: 'Cambiar', bulk_delete: 'Borrar', close: 'Cerrar', add: 'Añadir', clear: 'Quitar',
      },
      operations: { cart_checkout: { cart: { clear: 'Vaciar' } }, cash_register: { count: { add: 'Registrar arqueo' } } },
      screens: { home: 'Inicio', settings: 'Ajustes' },
      spentNote: 'Cada negocio tiene su propio asistente.',
    },
  },
};

const HOST = HOST_MESSAGES.en.host;

function ownVerb(operation: string): boolean {
  let node: unknown = HOST.operations;
  for (const part of operation.split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

/** The plan's page the test host gives. */
export const PLAN_URL = 'https://erplora.com/plan';

/** The chat as the test host configures it; `turnUrl` is never fetched (each test posts through its own `post`). */
export const HOST_CONFIG: AssistantConfig = {
  turnUrl: '/api/assistant/turn',
  canUse: (session) => session.can(USE),
  canUpgrade: (session) => session.can(UPGRADE),
  planUrl: () => PLAN_URL,
  verbKey: (operation) => {
    if (ownVerb(operation)) return `host.operations.${operation}`;
    const action = operation.split('.').at(-1) ?? '';
    return Object.hasOwn(HOST.verbs, action) ? `host.verbs.${action}` : 'assistant.card.other';
  },
  placeKey: (screen) => (screen && Object.hasOwn(HOST.screens, screen) ? `host.screens.${screen}` : null),
  screenKey: (path) => ({ '/': 'host.screens.home', '/settings': 'host.screens.settings' })[path] ?? null,
};

/** Configures the chat as the test host does, with the pieces a test changes. */
export function configure(changes: Partial<AssistantConfig> = {}): AssistantConfig {
  const config = { ...HOST_CONFIG, ...changes };
  configureAssistant(config);
  return config;
}

/** The name a screen reader reads. Attached, `ion-button` moves `aria-label` from its host to the native button of its
 *  shadow root (Ionic's `inheritAriaAttributes`), as in a browser — its native link when it has an `href`. */
export function accessibleName(element: Element): string | null | undefined {
  return element.shadowRoot?.querySelector('button, a')?.getAttribute('aria-label') ?? element.getAttribute('aria-label');
}

/** A storage of its own for each test (the conversation, open or closed). */
export function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

const BLANK = { template: '<div />' };

export interface MountOptions {
  props?: Record<string, unknown>;
  slots?: Record<string, unknown>;
  path?: string;
  locale?: 'en' | 'es';
  /** `null`: no session arrived. */
  session?: SessionMe | null;
  status?: SessionStatus;
  /** Paths the router knows (besides the 404 catch-all named `not-found`, as the shell's). */
  routes?: string[];
  stubs?: Record<string, Component | boolean>;
  /** What the fake API answers, set before mounting. */
  onApi?: ApiHandler;
}

/** Ionic's router API (`useIonRouter`) as the shell's Ionic router provides it app-wide (`navManager`). */
function navManager(router: Router) {
  return {
    handleNavigate: vi.fn((location: RouteLocationRaw, action = 'push') =>
      action === 'replace' ? router.replace(location) : router.push(location),
    ),
    canGoBack: () => Boolean(window.history.state?.back),
    goBack: () => router.back(),
    goForward: () => router.forward(),
  };
}

export async function mountAssistant(component: Component, options: MountOptions = {}) {
  const harness = createTestClient();
  if (options.onApi) harness.net.onApi(options.onApi);
  const known: RouteRecordRaw[] = (options.routes ?? []).map((path) => ({ path, component: BLANK }));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: BLANK }, ...known, { path: '/:pathMatch(.*)*', name: 'not-found', component: BLANK }],
  });
  await router.push(options.path ?? '/');
  await router.isReady();
  const app = createApp({});
  provideSession(ref(options.session === null ? undefined : (options.session ?? OWNER)), ref(options.status ?? 'live'), { app });
  provideShellConfig({ homePath: '/', home: true }, app);
  const ionRouter = navManager(router);
  const messages = {
    en: { ...assistantMessages.en, ...HOST_MESSAGES.en },
    es: { ...assistantMessages.es, ...HOST_MESSAGES.es },
  };
  const wrapper = mount(component, {
    props: options.props,
    slots: options.slots as never,
    attachTo: document.body,
    global: {
      plugins: [router, createShellI18n({ locale: options.locale ?? 'en', messages })],
      provide: { ...app._context.provides, [LIVE_CLIENT_KEY as symbol]: harness.client, navManager: ionRouter },
      stubs: options.stubs,
    },
  });
  return { ...harness, router, ionRouter, wrapper };
}
