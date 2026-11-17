import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { openExternalLink } from '../open-external';
import { toastError } from '../toast';
import { useActionCenter } from './center';
import type { NoticeActionSlot } from './actions';
import type { ActionNotice } from './types';

/** Runs the notice through the central store; only this UI layer knows navigation and error feedback. */
export function useNoticeAction() {
  const { runAction, closePanel } = useActionCenter();
  const router = useRouter();
  const { t } = useI18n();

  async function run(notice: ActionNotice, which: NoticeActionSlot, event?: Event): Promise<void> {
    try {
      const destination = await runAction(notice, which);
      if (!destination) return;
      closePanel();
      if ('to' in destination) await router.push(destination.to);
      else openExternalLink(destination.href, event ?? new Event('click'));
    } catch {
      toastError(t('actionCenter.actionFailed'));
    }
  }

  return { run };
}
