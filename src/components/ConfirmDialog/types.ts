// Public types of ConfirmDialog and useConfirm.

/** Colour of the action, by what it does: destroys, has a consequence to weigh, or neither. */
export type ConfirmTone = 'danger' | 'warning' | 'primary';

/** One consequence of the action, with an optional icon (`set:name`, registered in `shell/icons.ts`). */
export type ConfirmConsequence = string | { text: string; icon?: string };

/** What `useConfirm().confirm()` takes: the ConfirmDialog's texts and options. */
export interface ConfirmOptions {
  title: string;
  message?: string;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmIcon?: string;
  consequences?: readonly ConfirmConsequence[];
  /** The person must type this (e.g. the business name) before confirming. */
  requireText?: string;
  requireTextLabel?: string;
}
