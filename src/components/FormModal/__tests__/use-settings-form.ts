// useSettingsForm's own tests drive the command by hand (each test sets its pending and error); the tests of
// the pieces built on it use settings-form.ts, whose command behaves as useCommand does.
import { vi } from 'vitest';
import { effectScope, ref, shallowRef } from 'vue';

import { useSettingsForm, type SettingsFormOptions } from '../settingsForm';
import type { FormModalError } from '../types';

// A page like Services': numbers, a text, a switch and a field the server names otherwise.
export interface ServiceOut {
  default_duration: number;
  page_title: string;
  show_prices: boolean;
  default_tax_category_key: string | null;
  default_tax_category_name: string | null;
}
type Option = { id: string; label: string } | null;
export interface ServiceForm {
  default_duration: string;
  page_title: string;
  show_prices: boolean;
  tax: Option;
}
export type ServiceIn = Partial<Omit<ServiceOut, 'default_tax_category_name'>>;

export const SAVED: ServiceOut = {
  default_duration: 60,
  page_title: 'Book with us',
  show_prices: true,
  default_tax_category_key: 'general',
  default_tax_category_name: 'General VAT',
};

export const SERVICE: SettingsFormOptions<ServiceOut, ServiceForm> = {
  toForm: (settings) => ({
    default_duration: String(settings.default_duration),
    page_title: settings.page_title,
    show_prices: settings.show_prices,
    tax: settings.default_tax_category_key
      ? { id: settings.default_tax_category_key, label: settings.default_tax_category_name ?? settings.default_tax_category_key }
      : null,
  }),
  numbers: ['default_duration'],
  server: { tax: { name: 'default_tax_category_key', value: (option) => option?.id ?? null } },
};

export function setup<Out, Form extends object, In extends object>(
  options: SettingsFormOptions<Out, Form>,
  initial: Out | undefined,
  run: (input: In) => Promise<Out> = vi.fn(),
) {
  const data = shallowRef<Out | undefined>(initial);
  const pending = ref(false);
  const error = shallowRef<FormModalError | null>(null);
  const command = { run: vi.fn(run), pending, error };
  const scope = effectScope();
  const form = scope.run(() => useSettingsForm(data, command, options))!;
  return { data, pending, error, command, form, scope };
}

export const service = (run?: (input: ServiceIn) => Promise<ServiceOut>) => setup<ServiceOut, ServiceForm, ServiceIn>(SERVICE, SAVED, run);
