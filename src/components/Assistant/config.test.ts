// The assistant's configuration: what the host (the Hub, the SaaS) gives the shared chat — where a turn goes, its
// reads and writes around the chat, who may use it — set once when the app boots (`configureAssistant`).
import { afterEach, describe, expect, it } from 'vitest';

import { type AssistantConfig, assistantConfig, configureAssistant, spentNoteKeyOf, verbKeyOf } from './config';

afterEach(() => configureAssistant(undefined));

describe('configureAssistant', () => {
  it('until the host configures it, asking for the configuration says so, never a guess', () => {
    expect(() => assistantConfig()).toThrow(/configureAssistant/);
  });

  it('gives back what the host set, and forgets it with undefined', () => {
    const config: AssistantConfig = { turnUrl: '/api/assistant/turn' };
    configureAssistant(config);
    expect(assistantConfig()).toBe(config);
    configureAssistant(undefined);
    expect(() => assistantConfig()).toThrow(/configureAssistant/);
  });
});

describe('verbKeyOf', () => {
  it("is the host's key for the verb of a write", () => {
    expect(verbKeyOf({ turnUrl: '/t', verbKey: (operation) => `host.verbs.${operation}` }, 'sale.ticket.void')).toBe(
      'host.verbs.sale.ticket.void',
    );
  });

  it('without a catalogue of verbs, every write is «Do this»', () => {
    expect(verbKeyOf({ turnUrl: '/t' }, 'sale.ticket.void')).toBe('assistant.card.other');
  });
});

describe('spentNoteKeyOf', () => {
  it("is the host's key for the line under a spent allowance where nobody may upgrade (ui#49)", () => {
    expect(spentNoteKeyOf({ turnUrl: '/t', spentNoteKey: 'host.spentNote' })).toBe('host.spentNote');
  });

  it('without one, the line asks whoever runs the business to upgrade the plan', () => {
    expect(spentNoteKeyOf({ turnUrl: '/t' })).toBe('assistant.askOwner');
  });
});
