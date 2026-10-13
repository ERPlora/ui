// What the shell knows about the person in front of it: the result of the live query
// `base.session.me` (user, permissions, menu, apps, language) plus the state of the stream that
// carries it. The shell never fetches it: the entry point hands two refs in — today the JSON that
// `base/spa.py` embeds in the HTML, from V7 on the `useLive('base.session.me')` of the SDK — and
// everything here derives from them.
//
// The menu comes from the server, already filtered by permission and active app and already
// translated; `routes.ts` of an app never contributes menu items (it only maps routes → pages).
//
// Signing out of the Hub is the server's too: `logout()` hands the browser to the Hub's
// `/auth/logout`; the hub passes it to `createShell({ userMenu: { logout } })`.
import {
  type App,
  computed,
  type ComputedRef,
  inject,
  type InjectionKey,
  provide,
  readonly,
  type Ref,
  watch,
} from 'vue';

import { readSpaConfig } from '../sdk/config';
import { readCookie } from '../sdk/headers';

/** State of the stream that carries `base.session.me`. */
export type SessionStatus = 'loading' | 'live' | 'error' | 'reconnecting';

export interface SessionUser {
  id: string;
  label: string;
  /** Shown under the name in the user menu (the SaaS sends it; the Hub may not). */
  email?: string;
}

export interface SessionMenuItem {
  path: string;
  label: string;
  /** `prefix:name` (e.g. `ion:cube-outline`), painted with HubIcon. */
  icon: string;
  /** Sells something (the SaaS's Store): not painted on the app surfaces (`surface.ts`). */
  webOnly?: boolean;
}

export interface SessionMenuSection {
  id: string;
  /** `''` paints no divider header (a menu of one section). */
  label: string;
  items: SessionMenuItem[];
}

export interface SessionApp {
  /** The app's id (its Django label, e.g. `demo`): the `id` of its menu section. */
  label: string;
  state: 'on' | 'activating' | 'off';
}

/** Result of `base.session.me`. */
export interface SessionMe {
  user: SessionUser | null;
  permissions: string[];
  menu: SessionMenuSection[];
  apps: SessionApp[];
  language: string;
}

/** The session as the shell's components and router see it. Read-only: the server owns it. */
export interface ShellSession {
  readonly me: Readonly<Ref<SessionMe | undefined>>;
  readonly status: Readonly<Ref<SessionStatus>>;
  readonly user: ComputedRef<SessionUser | null>;
  readonly menu: ComputedRef<SessionMenuSection[]>;
  /** Exact permission, or the superuser wildcard `*`. */
  can(permission: string): boolean;
}

export const SESSION_KEY: InjectionKey<ShellSession> = Symbol('erplora.shell.session');

/** Builds the read-only session view over the two refs the entry point owns. */
export function createShellSession(
  me: Ref<SessionMe | undefined>,
  status: Ref<SessionStatus>,
): ShellSession {
  const user = computed(() => me.value?.user ?? null);
  const menu = computed(() => me.value?.menu ?? []);
  return {
    me: readonly(me) as Readonly<Ref<SessionMe | undefined>>,
    status: readonly(status) as Readonly<Ref<SessionStatus>>,
    user,
    menu,
    can(permission) {
      const granted = me.value?.permissions ?? [];
      return granted.includes('*') || granted.includes(permission);
    },
  };
}

/**
 * Provides the session to the component tree: from a component's `setup`, or app-wide with
 * `{ app }` (what `createShell` does, before mounting). Returns the session it provided.
 */
export function provideSession(
  me: Ref<SessionMe | undefined>,
  status: Ref<SessionStatus>,
  options: { app?: App } = {},
): ShellSession {
  const session = createShellSession(me, status);
  if (options.app) options.app.provide(SESSION_KEY, session);
  else provide(SESSION_KEY, session);
  return session;
}

/** The session provided above. Throws when nothing provided it: a shell without one is a bug. */
export function useSession(): ShellSession {
  const session = inject(SESSION_KEY, null);
  if (!session) {
    throw new Error('useSession() found no session: call provideSession() (createShell does) first.');
  }
  return session;
}

/**
 * Resolves once there is something to decide with: `base.session.me` arrived, or the stream left
 * `loading` (it answered, failed or is reconnecting). The auth gate waits on it, so the first
 * navigation never sends to the login a person whose session simply had not arrived yet (hub#858).
 */
export function sessionReady(session: ShellSession): Promise<void> {
  const settled = () => session.me.value !== undefined || session.status.value !== 'loading';
  if (settled()) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = watch([session.me, session.status], () => {
      if (!settled()) return;
      stop();
      resolve();
    });
  });
}

/** The Hub's logout (`base/auth_views.py`): POST only, behind Django's CSRF check. */
const LOGOUT_PATH = '/auth/logout';

/**
 * Signs the person out of the Hub: a top-level form POST to its logout, so the BROWSER follows its
 * redirect (the Hub closes its session, then the SaaS's logout page closes that one). Not `fetch`:
 * it would follow that cross-origin redirect itself and leave the page where it was. The CSRF token
 * is the cookie that `spa-config` names, sent as Django's `csrfmiddlewaretoken` field.
 */
export function logout(doc: Document = document): void {
  const { csrfCookieName } = readSpaConfig(doc);
  const form = doc.createElement('form');
  form.setAttribute('method', 'post');
  form.setAttribute('action', LOGOUT_PATH);
  form.hidden = true;
  const token = doc.createElement('input');
  token.type = 'hidden';
  token.name = 'csrfmiddlewaretoken';
  token.value = readCookie(doc.cookie, csrfCookieName) ?? '';
  form.append(token);
  doc.body.append(form);
  form.submit();
}
