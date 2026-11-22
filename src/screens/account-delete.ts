// Delete account, or a guest's Forget me, on the account screen (ADR 0079 addendum of
// 2026-11-22): asked once, in the card's place; Keep goes back where it was asked from. A try that
// didn't work (offline, failing) asks again with the reason above the question.
import type { NoticeContent } from '../ui/notice-content.ts';
import { deleteCard } from './account-text.ts';

export function askToDelete(
  show: (content: NoticeContent) => void,
  account: boolean,
  forget: () => Promise<string | undefined>,
  keep: () => void,
  problem?: string,
): void {
  const remove = async () => {
    const failed = await forget();
    if (failed !== undefined) askToDelete(show, account, forget, keep, failed);
  };
  show(deleteCard(account, remove, keep, problem));
}
