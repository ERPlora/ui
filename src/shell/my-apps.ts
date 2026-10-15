// The apps of this hub, as the person may open them: the Home grid (HomePage, Odoo's home) and the
// topbar's «My apps» sheet (AppsLauncher, the launcher of `nav: 'launcher'`) paint the same list.
// Everything comes from `base.session.me`, already filtered by permission and translated: one entry
// per app that has a menu section (its name, the icon and path of its first entry), so neither
// offers what the server does not (on the app surfaces, neither offers a web-only entry). An app
// that is not on yet keeps its state and has no path: it opens nothing until it is.
import { computed, type ComputedRef } from 'vue';

import { type SessionApp, useSession } from './session';
import { useSurface } from './surface';

export interface MyApp {
  /** The app's id (its Django label). */
  id: string;
  /** Its name, the label of its menu section. */
  name: string;
  /** `set:name` for HubIcon. */
  icon: string;
  state: SessionApp['state'];
  /** Where it opens; none while the app is not on. */
  path?: string;
}

/** The menu sends `set:name` of any registered set; a bare name is Ionicons. */
export const iconName = (icon: string): string => (icon.includes(':') ? icon : `ion:${icon}`);

/** The apps of `base.session.me` the person can see, live. */
export function useMyApps(): ComputedRef<MyApp[]> {
  const { me, menu } = useSession();
  const { isWeb } = useSurface();
  return computed(() =>
    (me.value?.apps ?? []).flatMap((app) => {
      const section = menu.value.find((candidate) => candidate.id === app.label);
      const first = section?.items.find((item) => !item.webOnly || isWeb.value);
      if (!section || !first) return [];
      const path = app.state === 'on' ? first.path : undefined;
      return [{ id: app.label, name: section.label, icon: iconName(first.icon), state: app.state, path }];
    }),
  );
}
