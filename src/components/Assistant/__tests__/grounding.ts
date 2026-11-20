import { type Executed, groundingNotices } from '../grounding';

export const ran = (outcome: Executed['outcome'], kind: Executed['kind'] = 'command'): Executed => ({
  name: 'demo.item.create',
  kind,
  outcome,
});
export const ID = '0193e1c2-7a4b-7c3d-9e8f-0a1b2c3d4e5f';

export function notices(answer: string, executed: Executed[] = [], extra: { results?: string[]; question?: string } = {}) {
  return groundingNotices({ answer, executed, results: extra.results ?? [], question: extra.question ?? '', screenExists: () => true });
}

export const declined = (outcome: Executed['outcome']): Executed => ({ name: 'accounts.preferences.update', kind: 'command', outcome });
