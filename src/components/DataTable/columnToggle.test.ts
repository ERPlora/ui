import { describe, expect, it } from 'vitest';

import { hasToggle, toggleNote, toggleState } from './columnToggle';
import type { DataTableColumnToggle } from './types';

type Row = { id: string; on: boolean; why?: string; failed?: boolean };
const toggle: DataTableColumnToggle<Row> = {
  checked: (r) => r.on,
  label: (r) => `Turn ${r.id} ${r.on ? 'off' : 'on'}`,
  disabled: (r) => !!r.why,
  busy: (r) => r.id === 'busy',
  busyLabel: 'Working…',
  note: (r) => r.why,
  noteTone: (r) => (r.failed ? 'danger' : 'muted'),
};

describe('columnToggle', () => {
  it('reads the switch of a row from its column', () => {
    expect(toggleState(toggle, { id: 'tax', on: true, why: 'Required' })).toEqual({
      checked: true,
      label: 'Turn tax off',
      disabled: true,
      busy: false,
      busyLabel: 'Working…',
    });
    expect(toggleState(toggle, { id: 'busy', on: false }).busy).toBe(true);
  });

  it('a switch with only the required parts is enabled and idle', () => {
    expect(toggleState({ checked: () => false, label: () => 'Turn on' }, { id: 'x', on: false })).toMatchObject({ disabled: false, busy: false });
  });

  it('the note of a row, muted unless the column says it is a failure; none when empty', () => {
    expect(toggleNote(toggle, { id: 'a', on: false, why: 'Not in your plan' })).toEqual({ text: 'Not in your plan', tone: 'muted' });
    expect(toggleNote(toggle, { id: 'a', on: false, why: 'Could not turn on', failed: true })).toEqual({ text: 'Could not turn on', tone: 'danger' });
    expect(toggleNote(toggle, { id: 'a', on: false, why: '' })).toBeUndefined();
    expect(toggleNote(undefined, { id: 'a', on: false })).toBeUndefined();
  });
});

describe('a row without a switch', () => {
  it('is said by `hidden`; its note still shows', () => {
    const readOnly: DataTableColumnToggle<Row> = { ...toggle, hidden: () => true };
    expect(hasToggle(readOnly, { id: 'a', on: true })).toBe(false);
    expect(hasToggle(toggle, { id: 'a', on: true })).toBe(true);
    expect(hasToggle(undefined, { id: 'a', on: true })).toBe(false);
    expect(toggleNote(readOnly, { id: 'a', on: false, why: 'Bought on erplora.com' })?.text).toBe('Bought on erplora.com');
  });
});
