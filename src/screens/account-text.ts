// The account's cards (ADR 0079, 0081): its username, chosen right after a sign-in (once,
// skippable) or changed later from Profile, and Delete account asked once, as notices: pure, so
// every state is tested without a DOM. The rule is the server's own words; the server alone
// checks a name.
import { USERNAME_RULE } from '../api/accounts.ts';
import type { NoticeContent, NoticeField } from '../ui/notice-content.ts';

/** What the signed-in card offers at its end, and why the last of them didn't work, if it didn't. */
export interface AccountActions {
  readonly logOut: () => Promise<unknown>;
  readonly deleteAccount: () => void;
  readonly problem?: string;
}

export interface UsernameCard {
  /** The username now, if there is one: then this changes it. */
  readonly current: string | null;
  readonly field: NoticeField;
  readonly save: () => Promise<unknown>;
  /** Skip (right after a sign-in) or Cancel (a change). */
  readonly skip: () => void;
}

/** Choosing a username, or changing it. */
export function usernameCard(card: UsernameCard): NoticeContent {
  return {
    title: card.current === null ? 'Choose a username' : 'Change your username',
    body: [
      'Opponents see it in live matches.',
      `${USERNAME_RULE}. You can change it once a month.`,
    ],
    field: card.field,
    buttons: [{ text: 'Save', onClick: card.save }],
    quiet: { text: card.current === null ? 'Skip for now' : 'Cancel', onClick: card.skip },
  };
}

/**
 * Delete account, or a guest's Forget me, asked once (ADR 0052 section 6, 0079): Keep first, so a
 * stray tap keeps the player. `problem` says why the last try didn't work (offline, failing).
 */
export function deleteCard(
  account: boolean,
  remove: () => Promise<unknown>,
  keep: () => void,
  problem?: string,
): NoticeContent {
  return {
    title: account ? 'Delete your account?' : 'Delete your guest?',
    body: [
      ...(problem === undefined ? [] : [problem]),
      account
        ? 'Its username and games go with it. A match in play is lost; finished ones stay in ' +
          'opponents’ history, as “Deleted player”.'
        : 'A match in play is lost; finished ones stay, as “Deleted player”.',
    ],
    buttons: [
      { text: 'Keep', onClick: keep },
      { text: 'Delete', onClick: remove },
    ],
  };
}
