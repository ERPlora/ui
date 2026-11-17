import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, vi } from 'vitest';

import type { ActionNotice, NoticeSeverity } from '../types';

export function notice(id: string, severity: NoticeSeverity = 'warning', extra: Partial<ActionNotice> = {}): ActionNotice {
  return { id, severity, icon: 'ion:alert-circle-outline', label: id, title: id, ...extra };
}

export const ids = (list: readonly ActionNotice[]): string[] => list.map((each) => each.id);

export function useCenterTimers(): void {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
}

export function cleanupCenter(wrapper: VueWrapper | undefined, disconnect: (() => void) | undefined): void {
  wrapper?.unmount();
  disconnect?.();
  vi.useRealTimers();
  document.body.innerHTML = '';
}
