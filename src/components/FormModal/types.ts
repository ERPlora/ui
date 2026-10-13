// Public types of FormModal.

/** `md`: the mockups' 480px dialog; `sm`: 420px, for short confirmations. */
export type FormModalSize = 'sm' | 'md';

/** `alertdialog` for consequential confirmations (ConfirmDialog). */
export type FormModalRole = 'dialog' | 'alertdialog';

/**
 * The error a command left (`useCommand().error`, an `ApiError` of `@erplora/ui/sdk`), or anything
 * shaped like it: its `message` goes on top of the form and its `fields` (a 422) to the fields.
 */
export interface FormModalError {
  message: string;
  code?: string;
  status?: number;
  fields?: Readonly<Record<string, string>>;
}

/** Props of the default (fields) slot. */
export interface FormModalFieldsSlotProps {
  /** Per-field messages of the last error (`{}` without them): `:error-text="fieldErrors.email"`. */
  fieldErrors: Readonly<Record<string, string>>;
  pending: boolean;
}

/** Props of the `footer` slot, to lay out other buttons with the same behaviour. */
export interface FormModalFooterSlotProps {
  submit: () => void;
  cancel: () => void;
  pending: boolean;
}
