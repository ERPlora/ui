// What guides the person in the assistant's panel, as keys of the chat's catalogue (the component translates them):
// - `errorView` (BASE-G124, G122): the sentence of each failure and its way out (try again, a new conversation, the
//   plan, sign in again); a spent allowance or a plan without the assistant is no breakdown;
// - `usageNote` (BASE-G122): from 80 % of the month's messages, what is left of how many;
// - `screenLabel` (BASE-G114): a screen by the name the person sees — the host's platform's by its catalogue
//   (`AssistantConfig.screenKey`), an app's by the menu —, never its path.
import type { SessionMenuSection } from '../../shell/session';
import type { AssistantUsage } from './config';

export type Recovery = 'retry' | 'new' | 'upgrade' | 'signin' | 'none';

export interface ErrorView {
  key: string;
  values?: Record<string, unknown>;
  recovery: Recovery;
}

export function errorView(code: string, details: Record<string, unknown> = {}): ErrorView {
  switch (code) {
    case 'assistant.unreachable':
      return { key: 'assistant.errors.unreachable', recovery: 'retry' };
    case 'assistant.cut':
      return { key: 'assistant.errors.cut', recovery: 'retry' };
    case 'assistant.quota_exceeded': {
      const limit = Number(details.limit ?? 0);
      if (limit <= 0) return { key: 'assistant.errors.noPlan', recovery: 'upgrade' };
      return {
        key: 'assistant.errors.quotaSpent',
        values: { used: Number(details.used ?? limit), limit, resetsAt: details.resets_at ?? null },
        recovery: 'upgrade',
      };
    }
    case 'assistant.rate_limited':
      return { key: 'assistant.errors.rateLimited', values: { seconds: Number(details.retry_after ?? 60) }, recovery: 'retry' };
    case 'assistant.too_large':
    case 'payload_too_large':
      return { key: 'assistant.errors.tooLarge', recovery: 'new' };
    case 'assistant.too_many_steps':
      return { key: 'assistant.errors.tooManySteps', recovery: 'none' };
    case 'unauthorized':
      return { key: 'assistant.errors.signedOut', recovery: 'signin' };
    default:
      return { key: 'assistant.errors.unavailable', recovery: 'retry' };
  }
}

/** From 80 % of the month's messages: how many are left of how many, and when they come back. */
export const NOTE_FROM = 0.8;

export function usageNote(usage: AssistantUsage | undefined): { left: number; limit: number; resetsAt: string | null } | null {
  if (!usage || usage.limit <= 0 || usage.used / usage.limit < NOTE_FROM) return null;
  return { left: Math.max(usage.limit - usage.used, 0), limit: usage.limit, resetsAt: usage.resets_at };
}

export function screenLabel(
  path: string,
  menu: SessionMenuSection[],
  t: (key: string) => string,
  platformKey?: (path: string) => string | null,
): string | undefined {
  const bare = path.split('#', 1)[0].replace(/\/+$/, '') || '/';
  const platform = platformKey?.(bare);
  if (platform) return t(platform);
  let best: { section: string; item: string; length: number } | undefined;
  for (const section of menu) {
    for (const item of section.items) {
      const matches = bare === item.path || bare.startsWith(`${item.path}/`);
      if (matches && (!best || item.path.length > best.length)) {
        best = { section: section.label, item: item.label, length: item.path.length };
      }
    }
  }
  if (!best) return undefined;
  return best.section && best.section !== best.item ? `${best.section} › ${best.item}` : best.item;
}
