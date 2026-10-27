// Behaviour spec of ReportProblemModal: «Report a problem» in a dialog (the hub's user menu, without leaving the hub;
// ACCOUNTS-F38 is the SaaS's page with the same texts and limits): «Subject» and «What happened?», what goes with the
// report, «Send report» while it runs, a refusal that keeps what was typed and can be sent again, and «Report sent»
// with the address support answers to. The sending is the page's (`send`): the dialog knows no operation.
import { mount, type VueWrapper } from '@vue/test-utils';
import { addIcons } from 'ionicons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import { ION_ICONS } from '../../shell/icons';
import * as components from '../index';
import * as entry from './index';
import ReportProblemModal from './ReportProblemModal.vue';
import type { ReportProblemReport, ReportProblemSent } from './types';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

addIcons(ION_ICONS);

type Props = InstanceType<typeof ReportProblemModal>['$props'];
type Send = (report: ReportProblemReport) => Promise<ReportProblemSent>;

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/** Mounted as the hub mounts it: `v-model:open` and its `send`. */
function mountModal(send: Send, locale = 'en', props: Partial<Props> = {}): VueWrapper {
  const wrapper: VueWrapper = mount(ReportProblemModal, {
    props: {
      open: true,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      send,
      ...props,
    } as Props,
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
  mounted.push(wrapper);
  return wrapper;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

type Field = HTMLElement & { value?: string; label?: string; maxlength?: number; errorText?: string; placeholder?: string };
/** The dialog's content, wherever Ionic puts it (the stub keeps it in the mount, attached to the body). */
const find = (w: VueWrapper, testid: string): HTMLElement | null =>
  (w.element as Element).ownerDocument.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
const get = (w: VueWrapper, testid: string): HTMLElement => {
  const el = find(w, testid);
  if (!el) throw new Error(`no [data-testid="${testid}"]`);
  return el;
};
const subject = (w: VueWrapper) => get(w, 'report-problem-subject') as Field;
const description = (w: VueWrapper) => get(w, 'report-problem-description') as Field;
const sendButton = (w: VueWrapper) => get(w, 'report-problem-submit');
const disabled = (el: Element): boolean =>
  (el as HTMLElement & { disabled?: boolean }).disabled === true || el.hasAttribute('disabled');
const click = async (el: Element): Promise<void> => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
};
/** What the person does in an ion-input or ion-textarea: Ionic writes the value, then emits `ionInput`. */
async function type(el: Element, value: string): Promise<void> {
  (el as Field).value = value;
  el.dispatchEvent(new CustomEvent('ionInput', { detail: { value }, bubbles: true }));
  await settle();
}
async function fill(w: VueWrapper, subjectText = 'The printer stops', descriptionText = 'It prints half a ticket.'): Promise<void> {
  await type(subject(w), subjectText);
  await type(description(w), descriptionText);
}

/** A promise the test settles when it wants: the report «on its way». */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { promise, resolve, reject };
}

const SENT: ReportProblemSent = { replyTo: 'marta@example.com' };

describe('ReportProblemModal', () => {
  it('is a dialog named «Report a problem» with «Subject» (150) and «What happened?» (5000), and says what goes with it', async () => {
    const wrapper = mountModal(vi.fn<Send>());
    await settle();
    const modal = get(wrapper, 'report-problem');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-label')).toBe('Report a problem');
    expect(get(wrapper, 'report-problem-intro').textContent?.trim()).toBe('Tell us what went wrong. We will reply by email.');
    expect([subject(wrapper).label, subject(wrapper).maxlength]).toEqual(['Subject', 150]);
    expect([description(wrapper).label, description(wrapper).maxlength]).toEqual(['What happened?', 5000]);
    expect(description(wrapper).placeholder).toBe('Describe the steps and what you expected to happen');
    expect(get(wrapper, 'report-problem-context').textContent?.trim()).toBe(
      'Your account, your businesses, the page you came from and your browser go with your report.',
    );
    expect(sendButton(wrapper).textContent?.trim()).toBe('Send report');
    expect(get(wrapper, 'report-problem-cancel').textContent?.trim()).toBe('Cancel');
  });

  it('speaks Spanish with a Spanish person: the same texts as erplora.com\'s page', async () => {
    const wrapper = mountModal(vi.fn<Send>(), 'es');
    await settle();
    expect(get(wrapper, 'report-problem').getAttribute('aria-label')).toBe('Reportar un problema');
    expect(get(wrapper, 'report-problem-intro').textContent?.trim()).toBe(
      'Cuéntanos qué ha fallado. Te responderemos por correo electrónico.',
    );
    expect([subject(wrapper).label, description(wrapper).label]).toEqual(['Asunto', '¿Qué pasó?']);
    expect(get(wrapper, 'report-problem-context').textContent?.trim()).toBe(
      'Con tu informe van tu cuenta, tus negocios, la página de la que vienes y tu navegador.',
    );
    expect(sendButton(wrapper).textContent?.trim()).toBe('Enviar informe');
  });

  it('«Send report» stays off until both fields say something (spaces do not count)', async () => {
    const send = vi.fn<Send>();
    const wrapper = mountModal(send);
    await settle();
    expect(disabled(sendButton(wrapper))).toBe(true);
    await type(subject(wrapper), 'The printer stops');
    expect(disabled(sendButton(wrapper))).toBe(true);
    await type(description(wrapper), '   ');
    expect(disabled(sendButton(wrapper))).toBe(true);
    await click(sendButton(wrapper));
    expect(send).not.toHaveBeenCalled();
    await type(description(wrapper), 'It prints half a ticket.');
    expect(disabled(sendButton(wrapper))).toBe(false);
  });

  it('sends what was typed, trimmed, and while it runs nothing sends it twice or closes it', async () => {
    const answer = deferred<ReportProblemSent>();
    const send = vi.fn<Send>(() => answer.promise);
    const wrapper = mountModal(send);
    await settle();
    await fill(wrapper, '  The printer stops  ', '\n It prints half a ticket. \n');
    await click(sendButton(wrapper));
    expect(send).toHaveBeenCalledExactlyOnceWith({ subject: 'The printer stops', description: 'It prints half a ticket.' });
    expect(disabled(sendButton(wrapper))).toBe(true);
    expect(sendButton(wrapper).querySelector('ion-spinner')).not.toBeNull();
    expect(disabled(get(wrapper, 'report-problem-cancel'))).toBe(true);
    await click(sendButton(wrapper));
    expect(send).toHaveBeenCalledOnce();
    expect(wrapper.emitted('update:open')).toBeUndefined();
    answer.resolve(SENT);
    await settle();
  });

  it('a refusal says why above the fields, keeps what was typed and can be sent again', async () => {
    const send = vi
      .fn<Send>()
      .mockRejectedValueOnce({ status: 429, code: 'base.too_many_attempts', message: 'Too many attempts. Please try again in a few minutes.' })
      .mockResolvedValueOnce(SENT);
    const wrapper = mountModal(send);
    await settle();
    await fill(wrapper);
    await click(sendButton(wrapper));
    expect(get(wrapper, 'report-problem-error').textContent?.trim()).toBe('Too many attempts. Please try again in a few minutes.');
    expect([subject(wrapper).value, description(wrapper).value]).toEqual(['The printer stops', 'It prints half a ticket.']);
    expect(disabled(sendButton(wrapper))).toBe(false);
    expect(find(wrapper, 'report-problem-sent')).toBeNull();
    await click(sendButton(wrapper));
    expect(send).toHaveBeenCalledTimes(2);
    expect(find(wrapper, 'report-problem-error')).toBeNull();
    expect(find(wrapper, 'report-problem-sent')).not.toBeNull();
  });

  it("a field's refusal (422) goes under that field", async () => {
    const send = vi.fn<Send>().mockRejectedValue({
      status: 422,
      code: 'validation_error',
      message: 'Check the highlighted fields.',
      fields: { subject: 'Add a subject.' },
    });
    const wrapper = mountModal(send);
    await settle();
    await fill(wrapper);
    await click(sendButton(wrapper));
    expect(subject(wrapper).errorText).toBe('Add a subject.');
    expect(description(wrapper).errorText ?? '').toBe('');
  });

  it('a failure that is no answer of the server says the report did not leave, and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountModal(vi.fn<Send>().mockRejectedValue(new TypeError('x is undefined')));
    await settle();
    await fill(wrapper);
    await click(sendButton(wrapper));
    expect(get(wrapper, 'report-problem-error').textContent?.trim()).toBe('We could not send your report. Try again.');
    expect(logged).toHaveBeenCalled();
    expect(subject(wrapper).value).toBe('The printer stops');
  });

  it('sent: «Report sent» with the address support answers to; «Close» closes it and the next opening starts empty', async () => {
    const wrapper = mountModal(vi.fn<Send>().mockResolvedValue(SENT));
    await settle();
    await fill(wrapper);
    await click(sendButton(wrapper));
    const sent = get(wrapper, 'report-problem-sent');
    expect(sent.textContent).toContain('Report sent');
    expect(sent.textContent).toContain(
      'Thank you: we have received your report and will reply to marta@example.com as soon as possible.',
    );
    expect(find(wrapper, 'report-problem-subject')).toBeNull();
    expect(find(wrapper, 'report-problem-submit')).toBeNull();
    const done = get(wrapper, 'report-problem-done');
    expect(done.textContent?.trim()).toBe('Close');
    await click(done);
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
    await wrapper.setProps({ open: true } as Props);
    await settle();
    expect(find(wrapper, 'report-problem-sent')).toBeNull();
    expect([subject(wrapper).value ?? '', description(wrapper).value ?? '']).toEqual(['', '']);
  });

  it('«Report sent» in Spanish', async () => {
    const wrapper = mountModal(vi.fn<Send>().mockResolvedValue(SENT), 'es');
    await settle();
    await fill(wrapper);
    await click(sendButton(wrapper));
    const sent = get(wrapper, 'report-problem-sent');
    expect(sent.textContent).toContain('Informe enviado');
    expect(sent.textContent).toContain('Gracias: hemos recibido tu informe y te responderemos a marta@example.com lo antes posible.');
    expect(get(wrapper, 'report-problem-done').textContent?.trim()).toBe('Cerrar');
  });

  it('closing it without sending keeps the draft for the next opening', async () => {
    const send = vi.fn<Send>();
    const wrapper = mountModal(send);
    await settle();
    await fill(wrapper);
    await click(get(wrapper, 'report-problem-cancel'));
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
    await wrapper.setProps({ open: true } as Props);
    await settle();
    expect([subject(wrapper).value, description(wrapper).value]).toEqual(['The printer stops', 'It prints half a ticket.']);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('ReportProblemModal entry points', () => {
  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.ReportProblemModal).toBe(ReportProblemModal);
    expect((components as Record<string, unknown>).ReportProblemModal).toBe(ReportProblemModal);
    expect((root as Record<string, unknown>).ReportProblemModal).toBe(ReportProblemModal);
  });
});
