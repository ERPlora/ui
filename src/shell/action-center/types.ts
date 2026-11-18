// The action center lists what needs doing now and stays true until it is solved: an unpaid invoice, a printer
// offline, appointments to confirm. It is not the device notices (`device-notices.ts`), which tell what happened.
import type { Ref } from 'vue';

export type NoticeSeverity = 'danger' | 'warning' | 'info';

/** Opens a page of the app. */
interface NoticeRouteAction {
  readonly label: string;
  readonly to: string;
  readonly href?: never;
  readonly run?: never;
}

/** Opens a link outside the app. */
interface NoticeLinkAction {
  readonly label: string;
  readonly href: string;
  readonly to?: never;
  readonly run?: never;
}

/** Does something in place; the button spins while the promise is pending. */
interface NoticeRunAction {
  readonly label: string;
  readonly run: () => Promise<unknown> | void;
  readonly to?: never;
  readonly href?: never;
}

export type NoticeAction = NoticeRouteAction | NoticeLinkAction | NoticeRunAction;

/** Where an action with `to` or `href` leads: whoever paints the button goes there. */
export type NoticeDestination = { readonly to: string } | { readonly href: string };

/** ISO dates: the deadline, and when the countdown towards it started. */
export interface NoticeDue {
  readonly at: string;
  readonly from?: string;
}

export interface ActionNotice {
  /** Stable while the problem lasts: `<app>.<key>`, `base.blocking`, `billing.unpaid:<hub>`. */
  readonly id: string;
  readonly severity: NoticeSeverity;
  /** Iconify name. */
  readonly icon: string;
  /** The text of its compact row. */
  readonly label: string;
  /** The heading when it is the featured one. */
  readonly title: string;
  /** One sentence with the consequence. */
  readonly body?: string;
  /** The key datum, e.g. «29,00 €». */
  readonly figure?: string;
  /** A short state, e.g. «3 days left». */
  readonly chip?: string;
  /** How many things it groups; the bell adds them up, counting 1 when it is missing. */
  readonly count?: number;
  readonly due?: NoticeDue;
  /** None: the notice is text only. */
  readonly action?: NoticeAction;
  readonly secondary?: NoticeAction;
}

/** Where the notices come from: `undefined` while loading; on failure the last ones stay and `failed` is true. */
export interface ActionNoticeSource {
  readonly notices: Readonly<Ref<readonly ActionNotice[] | undefined>>;
  readonly failed: Readonly<Ref<boolean>>;
  readonly retry?: () => void;
}
