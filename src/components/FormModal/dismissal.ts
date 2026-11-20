import { computed, type Ref } from 'vue';

/** Closing FormModal by the person (Cancel, close, Escape, backdrop, Back): the page's `canDismiss` is asked first,
 *  and `cancelled` runs once it agrees. */
export function useDismissal(source: {
  canDismiss: () => (() => boolean | Promise<boolean>) | undefined;
  pending: () => boolean;
  backdropDismiss: () => boolean;
  open: Ref<boolean>;
  cancelled: () => void;
}) {
  /** The page's question while it is up: a second way out waits for the same answer instead of asking again. */
  let asking: Promise<boolean> | null = null;

  /** May the person close it? Without a question, yes; a question that fails keeps it open. */
  function mayClose(): Promise<boolean> {
    const ask = source.canDismiss();
    if (!ask) return Promise.resolve(true);
    asking ??= Promise.resolve()
      .then(ask)
      .catch((error: unknown) => {
        console.error('ui: could not ask whether to close the dialog', error);
        return false;
      })
      .finally(() => {
        asking = null;
      });
    return asking;
  }

  /** Ionic's own dismissals (backdrop, Escape, the system Back) ask the page first. Closing from the page
   *  (`open = false`, no role) never asks, and `handler` is Ionic's role for who already asked. */
  const ionCanDismiss = computed(() =>
    source.canDismiss() ? (_data?: unknown, role?: string): Promise<boolean> => (role === undefined ? Promise.resolve(true) : mayClose()) : true,
  );

  /** A Cancel already waiting for the page's answer: a second click while it is up closes nothing twice. */
  let cancelling = false;

  async function cancel(): Promise<void> {
    if (source.pending() || cancelling) return;
    cancelling = true;
    try {
      if (!(await mayClose()) || source.pending() || !source.open.value) return;
      source.cancelled();
      source.open.value = false;
    } finally {
      cancelling = false;
    }
  }

  /** Escape: with backdrop dismissal Ionic dismisses on its own (→ `onDidDismiss`); without it, here. */
  function onEscape(): void {
    if (source.pending() || source.backdropDismiss()) return;
    void cancel();
  }

  return { ionCanDismiss, cancel, onEscape };
}
