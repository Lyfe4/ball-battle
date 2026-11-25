// The Friends tab's loading states (ADR 0087, loading rules 2, 4 and 7): sized skeleton rows where
// rows are coming, shown only once a read has taken longer than SKELETON_AFTER_MS (a quick answer
// shows no skeleton at all); one calm reveal when they're replaced; and one failure card, in the
// failed section's place, in the game's words with Try again.
import type { FriendEntry, FriendsResponse } from '../../api/friends.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';

/** Under this from the screen showing, an answer shows no skeleton at all (ADR 0087 rule 4). */
export const SKELETON_AFTER_MS = 150;

/** Rows drawn while the list isn't known and the inbox hasn't said how many friends there are. */
export const DEFAULT_SKELETON_ROWS = 3;

/**
 * `count` placeholder rows, each a row's height (friends-section.css), hidden until
 * SKELETON_AFTER_MS has passed: they show only for a slow read.
 */
export function skeletonRows(count: number): HTMLElement {
  const rows = element('ul', 'friends-list friends-skeleton');
  rows.setAttribute('aria-hidden', 'true');
  for (let at = 0; at < count; at += 1) rows.append(element('li', 'friends-skeleton-row'));
  rows.hidden = true;
  window.setTimeout(() => {
    if (rows.isConnected) rows.hidden = false;
  }, SKELETON_AFTER_MS);
  return rows;
}

/** Whether a skeleton was seen (so what replaces it fades in once, rather than snapping). */
export function skeletonShown(root: ParentNode): boolean {
  const rows = root.querySelector('.friends-skeleton');
  return rows instanceof HTMLElement && !rows.hidden;
}

/** The one failure card: the section's title, the game's words for what failed, Try again. */
export function failureCard(
  title: string,
  line: string,
  retry: () => Promise<unknown>,
): HTMLElement {
  const card = element('section', 'friends-card friends-failure');
  card.setAttribute('role', 'alert');
  const again = element('button', 'hud-button', 'Try again');
  again.type = 'button';
  busyOnClick(again, retry);
  card.append(
    element('h2', 'friends-card-title', title),
    element('p', 'friends-card-text', line),
    again,
  );
  return card;
}

/** What the inbox has said of the friends, as a list with no code or requests (never kept). */
export function inboxList(friends: readonly FriendEntry[] | undefined): FriendsResponse {
  return { code: '', friends: friends ?? [], incoming: [], outgoing: [], blocked: [] };
}
