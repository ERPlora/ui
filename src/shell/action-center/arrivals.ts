// The card a new notice gets under the top bar before it settles in the bell. One card at a time: a graver
// notice takes the place of the one on screen, and one as grave or less is not shown: the bell tells it instead.
import { shallowRef } from 'vue';
import type { Ref } from 'vue';

import { severityRank } from './ordering';
import type { ActionNotice } from './types';

/** Why the cards are held back: a screen that must not be covered, reduced motion, the assistant open… */
export type ArrivalHold = string | symbol;

export interface ArrivalsOptions {
  /** How long a card stays on screen, in ms. */
  readonly duration: number;
  /** A card went to the bell: by its time, by being settled, or by giving way to a graver one. */
  readonly onSettle: () => void;
}

export interface Arrivals {
  readonly current: Readonly<Ref<ActionNotice | undefined>>;
  /** Shows `notice` as the card; `false` when it is not shown and the bell has to tell it instead. */
  offer(notice: ActionNotice): boolean;
  pause(): void;
  resume(): void;
  /** The card goes to the bell now. */
  settle(): void;
  /** The card leaves without going to the bell (its notice was solved, or the panel shows it). */
  withdraw(): void;
  /** No card is shown until every reason is released; the one on screen goes to the bell. */
  hold(reason: ArrivalHold): void;
  release(reason: ArrivalHold): void;
}

/** A one-off timer that can stop and go on later with the time it had left. */
function createCountdown(timeUp: () => void) {
  let left = 0;
  let since = 0;
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    since = Date.now();
    timer = setTimeout(() => {
      timer = undefined;
      timeUp();
    }, left);
  }

  function stop(): void {
    clearTimeout(timer);
    timer = undefined;
    paused = false;
  }

  function pause(): void {
    if (timer === undefined) return;
    stop();
    paused = true;
    left -= Date.now() - since;
  }

  function resume(): void {
    if (!paused) return;
    paused = false;
    run();
  }

  function start(duration: number): void {
    stop();
    left = duration;
    run();
  }

  return { pause, resume, start, stop };
}

export function createArrivals(options: ArrivalsOptions): Arrivals {
  const current = shallowRef<ActionNotice>();
  const holds = new Set<ArrivalHold>();
  const countdown = createCountdown(() => settle());

  function leave(): boolean {
    if (current.value === undefined) return false;
    countdown.stop();
    current.value = undefined;
    return true;
  }

  function settle(): void {
    if (leave()) options.onSettle();
  }

  function offer(notice: ActionNotice): boolean {
    const shown = current.value;
    if (holds.size > 0) return false;
    if (shown && severityRank(notice.severity) >= severityRank(shown.severity)) return false;
    settle();
    current.value = notice;
    countdown.start(options.duration);
    return true;
  }

  function hold(reason: ArrivalHold): void {
    holds.add(reason);
    settle();
  }

  return {
    current,
    offer,
    pause: countdown.pause,
    resume: countdown.resume,
    settle,
    withdraw: () => void leave(),
    hold,
    release: (reason) => void holds.delete(reason),
  };
}
