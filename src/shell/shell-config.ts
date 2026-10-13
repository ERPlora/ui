// Static facts of the shell an app passes to `createShell`: where «Home» is (brand link of the
// menu, «Go to Home» of the 404) and whether the shell's own Home (HomePage) is on.
import { type App, inject, type InjectionKey } from 'vue';

export interface ShellConfig {
  /** Path of «Home». */
  homePath: string;
  /** The shell's Home is on (`createShell({ home: true })`, the hub): «Home» goes first in the menu. */
  home?: boolean;
}

const DEFAULTS: ShellConfig = { homePath: '/' };

export const SHELL_CONFIG_KEY: InjectionKey<ShellConfig> = Symbol('erplora.shell.config');

/** Provides the config app-wide (createShell). Missing fields take the defaults. */
export function provideShellConfig(config: Partial<ShellConfig>, app: App): ShellConfig {
  const full = Object.freeze({ ...DEFAULTS, ...config });
  app.provide(SHELL_CONFIG_KEY, full);
  return full;
}

/** The provided config, or the defaults. */
export function useShellConfig(): ShellConfig {
  return inject(SHELL_CONFIG_KEY, DEFAULTS);
}
