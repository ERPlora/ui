import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assistant, panel, script, setUpPanel, tearDownPanel, USAGE } from './__tests__/assistant-panel';
import { EMPLOYEE, flush, PLAN_URL } from './__tests__/mount-assistant';
import type { AssistantConfig } from './config';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

beforeEach(setUpPanel);
afterEach(tearDownPanel);

describe('AssistantPanel', () => {
  it('reads the allowance once per opening, through the page\'s client, and from 80 % says what is left', async () => {
    const m = await panel({ usage: { ...USAGE, used: 25 } });
    expect(m.usage).toHaveBeenCalledWith(m.client);
    expect(m.usage).toHaveBeenCalledTimes(1);
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('Te quedan 5 de 30 mensajes este mes. Se renuevan el 1 de noviembre.');
    assistant.setOpen(false);
    await flush();
    assistant.setOpen(true);
    for (let i = 0; i < 3; i += 1) await flush();
    expect(m.usage).toHaveBeenCalledTimes(2);
  });

  it('one message left: the foot says it in the singular in Spanish, and English keeps its sentence (ui#117)', async () => {
    const m = await panel({ usage: { ...USAGE, used: 29 } });
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('Te queda 1 de 30 mensajes este mes. Se renuevan el 1 de noviembre.');
    (m.wrapper.vm as unknown as { $i18n: { locale: string } }).$i18n.locale = 'en';
    await flush();
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('You have 1 of 30 messages left this month. They renew on November 1.');
  });

  it('after each turn the foot counts what is left now, with no other reading', async () => {
    script.push([
      { type: 'text', text: 'Hola.' },
      { type: 'usage', used: 26, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false },
      { type: 'done', append: [{ role: 'assistant', content: 'Hola.' }], pending: [], continuation: null },
    ]);
    const m = await panel({ usage: { ...USAGE, used: 25 } });
    await assistant.ask('Hola');
    await flush();
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('Te quedan 4 de 30 mensajes este mes. Se renuevan el 1 de noviembre.');
    expect(m.usage).toHaveBeenCalledTimes(1);
  });

  it('a turn refused for a spent month: the foot says the same as the answer, without a second «Upgrade plan»', async () => {
    script.push([{ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false }]);
    const m = await panel({ usage: { ...USAGE, used: 25 } });
    await assistant.ask('Hola');
    await flush();
    const foot = m.wrapper.get('[data-testid="assistant-usage"]');
    expect(foot.text()).toBe('Has usado los 30 mensajes de este mes. Se renuevan el 1 de noviembre.');
    expect(foot.find('a').exists()).toBe(false);
    expect(m.wrapper.findAll('[data-testid="assistant-upgrade"]')).toHaveLength(1);
    expect(m.wrapper.get('[data-testid="assistant-upgrade"]').attributes('href')).toBe(PLAN_URL);
  });

  it('opened with the month already spent, the foot says so', async () => {
    const m = await panel({ usage: { ...USAGE, used: 30 } });
    expect(m.wrapper.get('[data-testid="assistant-usage"]').text()).toBe('Has usado los 30 mensajes de este mes. Se renuevan el 1 de noviembre.');
  });

  it('under 80 %, or when the allowance cannot be read, it says nothing of it', async () => {
    const low = await panel();
    expect(low.wrapper.find('[data-testid="assistant-usage"]').exists()).toBe(false);
    low.wrapper.unmount();
    const failed = await panel({ usage: new Error('unavailable') });
    expect(failed.wrapper.find('[data-testid="assistant-usage"]').exists()).toBe(false);
  });

  it('a host that does not count messages: nothing is read and nothing said of them', async () => {
    const m = await panel({ usage: { ...USAGE, used: 30 }, config: { usage: undefined } });
    expect(m.usage).not.toHaveBeenCalled();
    expect(m.wrapper.find('[data-testid="assistant-usage"]').exists()).toBe(false);
    expect(m.wrapper.find('[data-testid="assistant-no-plan"]').exists()).toBe(false);
  });

  it('a plan without the assistant: says so, the owner gets «Upgrade plan», and nothing can be sent', async () => {
    const m = await panel({ usage: { ...USAGE, used: 0, limit: 0 } });
    expect(m.wrapper.get('[data-testid="assistant-no-plan"]').text()).toContain('Tu plan no incluye el asistente.');
    expect(m.wrapper.get('[data-testid="assistant-no-plan-upgrade"]').attributes('href')).toBe(PLAN_URL);
    expect(m.wrapper.get('[data-testid="assistant-send"]').attributes('disabled')).toBeDefined();
    m.wrapper.unmount();
    const employee = await panel({ usage: { ...USAGE, used: 0, limit: 0 }, session: EMPLOYEE });
    expect(employee.wrapper.get('[data-testid="assistant-no-plan"]').text()).toContain('Pídele a quien administra el negocio que mejore el plan.');
    expect(employee.wrapper.find('[data-testid="assistant-no-plan-upgrade"]').exists()).toBe(false);
  });

  describe('«Upgrade plan» and the host that takes its click (`openPlan`)', () => {
    /** A click as a browser sees it: `defaultPrevented` says whether the link still opens its address by itself. */
    function click(link: Element): MouseEvent {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      // The link stays inside the test's page: happy-dom would otherwise try to follow it.
      link.addEventListener('click', (seen) => seen.preventDefault(), { once: true });
      link.dispatchEvent(event);
      return event;
    }

    it("the foot's link hands its click to the host, with the client and the event, and keeps the address", async () => {
      const openPlan = vi.fn<NonNullable<AssistantConfig['openPlan']>>();
      const m = await panel({ usage: { ...USAGE, used: 0, limit: 0 }, config: { openPlan } });
      const link = m.wrapper.get('[data-testid="assistant-no-plan-upgrade"]');
      expect(link.attributes('href')).toBe(PLAN_URL);

      const event = click(link.element);

      expect(openPlan).toHaveBeenCalledTimes(1);
      expect(openPlan.mock.calls[0][0]).toBeDefined();
      expect(openPlan.mock.calls[0][0].api).toBeDefined();
      expect(openPlan.mock.calls[0][1]).toBe(event);
    });

    it("the answer's link under a spent month does the same", async () => {
      script.push([{ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false }]);
      const openPlan = vi.fn<NonNullable<AssistantConfig['openPlan']>>();
      const m = await panel({ usage: { ...USAGE, used: 25 }, config: { openPlan } });
      await assistant.ask('Hola');
      await flush();

      const event = click(m.wrapper.get('[data-testid="assistant-upgrade"]').element);

      expect(openPlan).toHaveBeenCalledTimes(1);
      expect(openPlan.mock.calls[0][0].api).toBeDefined();
      expect(openPlan.mock.calls[0][1]).toBe(event);
    });

    /** The link as a browser would follow it: nothing of the panel stopped its click. */
    function expectPlainLink(link: Element): void {
      expect(link.getAttribute('href')).toBe(PLAN_URL);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener');
      const seen: boolean[] = [];
      // Read before `click`'s guard, which keeps the test's page in place.
      link.addEventListener('click', (event) => seen.push(event.defaultPrevented), { once: true });
      click(link);
      expect(seen).toEqual([false]);
    }

    it("a host that does not take it (the SaaS's way): the foot's link stays a plain link", async () => {
      const m = await panel({ usage: { ...USAGE, used: 0, limit: 0 } });
      expectPlainLink(m.wrapper.get('[data-testid="assistant-no-plan-upgrade"]').element);
    });

    it("a host that does not take it: the answer's link stays a plain link", async () => {
      script.push([{ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false }]);
      const m = await panel({ usage: { ...USAGE, used: 25 } });
      await assistant.ask('Hola');
      await flush();
      expectPlainLink(m.wrapper.get('[data-testid="assistant-upgrade"]').element);
    });

    describe.each([
      {
        where: "the foot's link",
        async mountWith(openPlan: AssistantConfig['openPlan']) {
          const m = await panel({ usage: { ...USAGE, used: 0, limit: 0 }, config: { openPlan } });
          return { m, link: m.wrapper.get('[data-testid="assistant-no-plan-upgrade"]').element };
        },
      },
      {
        where: "the answer's link",
        async mountWith(openPlan: AssistantConfig['openPlan']) {
          script.push([{ type: 'error', code: 'assistant.quota_exceeded', used: 30, limit: 30, resets_at: '2026-11-01T00:00:00Z', demo: false }]);
          const m = await panel({ usage: { ...USAGE, used: 25 }, config: { openPlan } });
          await assistant.ask('Hola');
          await flush();
          return { m, link: m.wrapper.get('[data-testid="assistant-upgrade"]').element };
        },
      },
    ])('$where', ({ mountWith }) => {
      /** What the app's error handler hears: where a failure in the click goes (the Hub reports it). */
      function failuresOf(m: Awaited<ReturnType<typeof panel>>): unknown[] {
        const failures: unknown[] = [];
        m.wrapper.getCurrentComponent().appContext.config.errorHandler = (error) => {
          failures.push(error);
        };
        return failures;
      }

      it('a host that leaves the click alone (the Hub, when the browser blocks its tab): the link still opens by itself', async () => {
        const openPlan = vi.fn<NonNullable<AssistantConfig['openPlan']>>();
        const { link } = await mountWith(openPlan);
        expectPlainLink(link);
        expect(openPlan).toHaveBeenCalledTimes(1);
      });

      it('a host that fails in the click: the link still opens by itself, and the error reaches the app', async () => {
        const failure = new Error('the host failed');
        const { m, link } = await mountWith(() => {
          throw failure;
        });
        const failures = failuresOf(m);
        expectPlainLink(link);
        expect(failures).toEqual([failure]);
      });

      it('a host that rejects after the click: the error reaches the app, not swallowed', async () => {
        const failure = new Error('the host rejected');
        const { m, link } = await mountWith(async () => {
          throw failure;
        });
        const failures = failuresOf(m);
        click(link);
        await flush();
        expect(failures).toEqual([failure]);
      });
    });
  });

  it("without the assistant and nobody who may upgrade: the host's own line under it, when it gives one (ui#49)", async () => {
    const m = await panel({ usage: { ...USAGE, used: 0, limit: 0 }, session: EMPLOYEE, config: { spentNoteKey: 'host.spentNote' } });
    const foot = m.wrapper.get('[data-testid="assistant-no-plan"]');
    expect(foot.get('[data-testid="assistant-spent-note"]').text()).toBe('Cada negocio tiene su propio asistente.');
    expect(foot.text()).not.toContain('Pídele a quien administra el negocio que mejore el plan.');
    expect(foot.find('[data-testid="assistant-no-plan-upgrade"]').exists()).toBe(false);
  });
});
