// The signed-in side of the sign-in screen (ADR 0079): the account's username, chosen right after a
// sign-in (once, skippable) or changed later, as notices: pure, so every state is tested without a
// DOM. The rule is the server's own words; the server alone checks a name.
import { USERNAME_RULE } from '../api/accounts.ts';
import type { NoticeContent, NoticeField } from '../ui/notice-content.ts';

/** Signed in: the username, or that opponents see the generated name until one is chosen. */
export function signedInCard(
  username: string | null,
  done: () => void,
  change: () => void,
): NoticeContent {
  return {
    title: 'You’re signed in',
    body: [
      username === null
        ? 'Opponents see you as “Player” and a number until you choose a username.'
        : `Opponents see you as ${username}.`,
      'Your games stay with your account. Sign in on another device to play as you there.',
    ],
    buttons: [{ text: 'Done', onClick: done }],
    quiet: { text: username === null ? 'Choose a username' : 'Change username', onClick: change },
  };
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
