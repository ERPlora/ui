// Public types of Combo.

/** One option of a Combo: `id` is what the page keeps, `label` what the person reads and searches,
 *  `hint` a second line (a code, a parent), also searched. */
export interface ComboOption {
  id: string;
  label: string;
  hint?: string;
}

/** Asks the server for the options that match `query` (`''` = the first page). */
export type ComboSearch = (query: string) => Promise<ComboOption[]>;
