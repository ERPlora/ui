// useConfirm — the imperative ConfirmDialog, for a yes/no that needs nothing else (no pending state
// or error inside the dialog): `window.confirm`, but ours.
//   const { confirm } = useConfirm();            // in setup(): it needs the app it belongs to
//   async function remove(member) {
//     if (!(await confirm({ title: t('…'), message: t('…'), tone: 'danger', confirmLabel: t('…') }))) return;
//     await removeMember.run({ id: member.id });  // its own pending/error/toast, as any command
//   }
// Pattern: ONE ConfirmDialog per app, mounted on first use in a `div.ep-confirm-host` of the body
// (Ionic moves the modal to ion-app when it presents) and rendered with the app's context, so it has
// its i18n and plugins. `confirm()` resolves `true` on confirm and `false` on cancel, Escape or the
// backdrop, and closes the dialog either way. A new question while one is open replaces it (the open
// one resolves `false`); when the component that asked goes away, its open question resolves `false`
// and the dialog closes; the dialog goes away with the app. When the action needs the dialog to stay
// open while it runs (pending, an error to show, a text to type and then wait), use <ConfirmDialog>.
import {
  type App,
  type AppContext,
  defineComponent,
  getCurrentInstance,
  h,
  onScopeDispose,
  render,
  type ShallowRef,
  shallowRef,
} from 'vue';

import ConfirmDialog from './ConfirmDialog.vue';
import type { ConfirmOptions } from './types';

interface Question {
  readonly id: number;
  readonly options: ConfirmOptions;
  readonly resolve: (answer: boolean) => void;
  answered: boolean;
}

interface Host {
  readonly question: ShallowRef<Question | null>;
  readonly open: ShallowRef<boolean>;
}

const HOSTS = new WeakMap<App, Host>();
let lastId = 0;

/** Answers the question (once) and closes the dialog if it is still the one shown. */
function answer(host: Host, question: Question, value: boolean): void {
  if (question.answered) return;
  question.answered = true;
  question.resolve(value);
  if (host.question.value === question) host.open.value = false;
}

function hostOf(context: AppContext): Host {
  const known = HOSTS.get(context.app);
  if (known) return known;

  const host: Host = { question: shallowRef(null), open: shallowRef(false) };
  const Root = defineComponent({
    name: 'ConfirmHost',
    setup() {
      return () => {
        const question = host.question.value;
        if (!question) return null;
        return h(ConfirmDialog, {
          // A fresh dialog per question: nothing typed or focused carries over.
          key: question.id,
          ...question.options,
          open: host.open.value,
          'onUpdate:open': (value: boolean) => {
            host.open.value = value;
          },
          onConfirm: () => answer(host, question, true),
          onCancel: () => answer(host, question, false),
        });
      };
    },
  });

  const container = document.createElement('div');
  container.className = 'ep-confirm-host';
  document.body.append(container);
  const vnode = h(Root);
  vnode.appContext = context;
  render(vnode, container);

  HOSTS.set(context.app, host);
  context.app.onUnmount(() => {
    render(null, container);
    container.remove();
    HOSTS.delete(context.app);
  });
  return host;
}

export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean> } {
  const instance = getCurrentInstance();
  if (!instance) throw new Error('useConfirm() must be called from setup(): the dialog belongs to the app of its caller.');
  const context = instance.appContext;
  const asked = new Set<Question>();

  onScopeDispose(() => {
    const host = HOSTS.get(context.app);
    for (const question of asked) if (host) answer(host, question, false);
    asked.clear();
  });

  function confirm(options: ConfirmOptions): Promise<boolean> {
    const host = hostOf(context);
    return new Promise<boolean>((resolve) => {
      const previous = host.question.value;
      if (previous) answer(host, previous, false);
      const question: Question = {
        id: ++lastId,
        options,
        resolve: (value) => {
          asked.delete(question);
          resolve(value);
        },
        answered: false,
      };
      asked.add(question);
      host.question.value = question;
      host.open.value = true;
    });
  }

  return { confirm };
}
