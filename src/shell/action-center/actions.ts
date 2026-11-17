import { shallowRef } from 'vue';
import type { Ref } from 'vue';

import type { ActionNotice, NoticeDestination } from './types';

/** Which of the two buttons of a notice. */
export type NoticeActionSlot = 'primary' | 'secondary';

export interface ActionRunner {
  /** The ids of the notices whose action is running: their buttons spin and do not run it again. */
  readonly busy: Readonly<Ref<ReadonlySet<string>>>;
  /**
   * Runs the action in place, passing its error on, or gives back where it leads for the caller to go there:
   * the action center knows no router. Undefined when there is nothing to do or it is already running.
   */
  run(notice: ActionNotice, which: NoticeActionSlot): Promise<NoticeDestination | undefined>;
}

export function createActionRunner(): ActionRunner {
  const busy = shallowRef<ReadonlySet<string>>(new Set());

  function mark(id: string, running: boolean): void {
    const next = new Set(busy.value);
    if (running) next.add(id);
    else next.delete(id);
    busy.value = next;
  }

  async function run(notice: ActionNotice, which: NoticeActionSlot): Promise<NoticeDestination | undefined> {
    const action = which === 'primary' ? notice.action : notice.secondary;
    if (action?.to !== undefined) return { to: action.to };
    if (action?.href !== undefined) return { href: action.href };
    if (action?.run === undefined || busy.value.has(notice.id)) return undefined;
    mark(notice.id, true);
    try {
      await action.run();
    } finally {
      mark(notice.id, false);
    }
    return undefined;
  }

  return { busy, run };
}
