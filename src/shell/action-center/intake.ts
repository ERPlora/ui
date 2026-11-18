// Turns each result of the source into what the user sees change: a card for the gravest new notice, a pulse
// of the bell for the rest, and a moment marked as solved for each notice that is no longer given. Nothing is
// stored between visits: what is new is told by comparing each result with the one before.
import { compareResults, keepMissing } from './changes';
import { sortNotices } from './ordering';
import type { CenterState, CenterView } from './state';
import type { ActionNotice } from './types';

export interface Intake {
  /** One result of the source: undefined while it loads; when it `failed`, what it stopped giving stays. */
  receive(notices: readonly ActionNotice[] | undefined, failed: boolean): void;
  /** The next result is taken as it comes, announcing and solving nothing. */
  restart(): void;
}

export function createIntake(state: CenterState, view: CenterView): Intake {
  let quiet = true;

  function take(next: readonly ActionNotice[]): void {
    state.latest.value = next;
    const card = state.arrivals.current.value;
    if (card && !next.some((notice) => notice.id === card.id)) state.arrivals.withdraw();
  }

  /** Keeps the featured one featured while it shows as solved, so the check shows where the user is looking. */
  function solve(removed: readonly ActionNotice[]): void {
    const featured = view.featured.value?.id;
    if (removed.some((notice) => notice.id === featured)) state.chosen.value = featured;
    state.linger.add(removed);
  }

  function announce(added: readonly ActionNotice[], raised: boolean): void {
    const [gravest, ...others] = sortNotices(added);
    const carded = gravest !== undefined && !state.open.value && state.arrivals.offer(gravest);
    if (raised || others.length > 0 || (gravest !== undefined && !carded)) state.pulse.value++;
  }

  function receive(notices: readonly ActionNotice[] | undefined, failed: boolean): void {
    if (notices === undefined) {
      quiet = true;
      return;
    }
    const next = failed ? keepMissing(state.latest.value, notices) : notices;
    if (quiet) {
      quiet = false;
      state.linger.clear();
      take(next);
      return;
    }
    const { added, raised, removed } = compareResults(state.latest.value, next);
    solve(removed);
    state.linger.drop(added.map((notice) => notice.id));
    take(next);
    announce(added, raised);
  }

  return {
    receive,
    restart: () => {
      quiet = true;
    },
  };
}
