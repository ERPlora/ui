// BASE-G123: «Report a problem» under a finished answer. The person says what is wrong with it (wrong, harmful, did not
// do what was asked, something else) and, if it wants, why; the answer, the question it answered and the reason go to
// the host's review (`AssistantConfig.report`; the Hub's: erplora.com's). Sent: a thank-you and the dialog closes;
// refused: it stays open with the reason, nothing lost.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveClient } from '../../sdk/live-client';
import { toastSuccess } from '../../shell/toast';
import { configure, flush, mountAssistant } from './__tests__/mount-assistant';
import AssistantReport from './AssistantReport.vue';
import { type AssistantReportInput, configureAssistant } from './config';
import type { Bubble } from './history';

vi.mock('../../shell/toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shell/toast')>()),
  toastSuccess: vi.fn(() => Promise.resolve()),
}));
vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

const ANSWER: Bubble = {
  id: '01JASSIST0000000000000000A',
  role: 'assistant',
  text: 'Hoy has vendido 120 €.',
  files: [],
  notices: [],
  done: true,
  question: '¿Cuánto he vendido hoy?',
};

/** Mounts the dialog with the host's sending: `answer` is what it gives back — a refusal rejects. */
async function report(answer: () => Promise<unknown>, bubble: Bubble | null = ANSWER) {
  const sent: AssistantReportInput[] = [];
  const send = vi.fn(async (_client: LiveClient, input: AssistantReportInput) => {
    sent.push(input);
    return answer();
  });
  configure({ report: send });
  const m = await mountAssistant(AssistantReport, { locale: 'es', props: { bubble } });
  await flush();
  return { ...m, sent, send };
}

const SENT = async () => ({ sent: true, duplicate: false });

const field = (testid: string) => document.querySelector<HTMLElement & { value?: unknown }>(`[data-testid="${testid}"]`);

function choose(reason: string): void {
  const group = field('assistant-report-reason')!;
  group.dispatchEvent(new CustomEvent('ionChange', { detail: { value: reason } }));
}

function write(comment: string): void {
  field('assistant-report-comment')!.dispatchEvent(new CustomEvent('ionInput', { detail: { value: comment } }));
}

async function send(): Promise<void> {
  field('assistant-report-dialog-submit')!.click();
  for (let i = 0; i < 3; i += 1) await flush();
}

beforeEach(() => {
  vi.mocked(toastSuccess).mockClear();
});

afterEach(() => {
  configureAssistant(undefined);
  document.body.innerHTML = '';
});

describe('AssistantReport', () => {
  it('asks what is wrong, in the person’s language, with the four reasons', async () => {
    await report(SENT);
    const text = field('assistant-report-dialog')!.textContent ?? '';
    expect(text).toContain('Denunciar esta respuesta');
    expect(text).toContain('¿Qué le pasa?');
    for (const reason of ['Es incorrecta', 'Es dañina u ofensiva', 'No hace lo que pedí', 'Otra cosa']) {
      expect(text).toContain(reason);
    }
  });

  it('sends the answer, its question, the reason and the comment, then thanks and closes', async () => {
    const m = await report(SENT);
    choose('harmful');
    write('  Un insulto  ');
    await flush();
    await send();
    expect(m.sent).toEqual([
      {
        message_id: ANSWER.id,
        reason: 'harmful',
        comment: 'Un insulto',
        question: '¿Cuánto he vendido hoy?',
        answer: 'Hoy has vendido 120 €.',
      },
    ]);
    expect(m.send).toHaveBeenCalledWith(m.client, m.sent[0]);
    expect(toastSuccess).toHaveBeenCalledWith('Gracias, hemos recibido tu denuncia.');
    expect(m.wrapper.emitted('close')).toHaveLength(1);
  });

  it('without a reason picked, it is «It is wrong»', async () => {
    const m = await report(SENT);
    await send();
    expect(m.sent[0].reason).toBe('incorrect');
    expect(m.sent[0]).not.toHaveProperty('comment');
  });

  it('a refusal stays in the dialog with its sentence, and nothing closes', async () => {
    const m = await report(async () => Promise.reject(new Error('down')));
    choose('other');
    await send();
    expect(field('assistant-report-dialog-error')?.textContent).toContain('No se pudo enviar la denuncia. Inténtalo de nuevo.');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(m.wrapper.emitted('close')).toBeUndefined();
  });

  it('closed when there is nothing to report', async () => {
    await report(SENT, null);
    expect(field('assistant-report-dialog-submit')).toBeNull();
  });
});
