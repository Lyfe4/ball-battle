// The Friends tab's loading states (ADR 0087, loading rules 2, 4 and 7): sized skeleton rows where
// rows are coming, shown only once a read has taken longer than SKELETON_AFTER_MS (a quick answer
// shows no skeleton at all); one calm reveal when they're replaced; and one failure card, in the
// failed section's place, in the game's words with Try again.
import type { FriendEntry, FriendsResponse } from '../../api/friends.ts';
import type { ApiResult } from '../../app/api.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';

/** Under this from the screen showing, an answer shows no skeleton at all (ADR 0087 rule 4). */
export const SKELETON_AFTER_MS = 150;

/** Rows drawn while the list isn't known and the inbox hasn't said how many friends there are. */
export const DEFAULT_SKELETON_ROWS = 3;

/**
 * Keeps `node`'s place from the first frame but unseen until SKELETON_AFTER_MS has passed, so a
 * quick answer shows no skeleton and a slow one shows it without anything moving (ADR 0087 addendum
 * of 2026-11-27: `hidden` took the space away, so the skeleton pushed the page when it appeared).
 */
export function unseenAtFirst(node: HTMLElement): void {
  node.dataset['unseen'] = '';
  window.setTimeout(() => {
    delete node.dataset['unseen'];
  }, SKELETON_AFTER_MS);
  // (What replaces the placeholders in the same node clears the mark itself, so it shows at once.)
}

/**
 * `count` placeholder rows, each a row's height (friends-section.css), in their place at once and
 * seen from SKELETON_AFTER_MS: they show only for a slow read.
 */
export function skeletonRows(count: number): HTMLElement {
  const rows = element('ul', 'friends-list friends-skeleton');
  rows.setAttribute('aria-hidden', 'true');
  for (let at = 0; at < count; at += 1) rows.append(element('li', 'friends-skeleton-row'));
  unseenAtFirst(rows);
  return rows;
}

/**
 * `count` rows' places in `items` (a group whose rows are coming), seen from SKELETON_AFTER_MS;
 * `requests`: a request's height, its Accept and Decline under the name.
 */
export function holdRows(items: HTMLElement, count: number, requests = false): void {
  const rows = [...skeletonRows(count).children];
  if (requests) for (const row of rows) row.classList.add('friends-skeleton-request');
  items.append(...rows);
  items.classList.add('friends-skeleton');
  items.setAttribute('aria-hidden', 'true');
  unseenAtFirst(items);
}

/**
 * The list read again for news the inbox brought (ADR 0089 addendum of 2026-11-27), one read at a
 * time: `done` gets the new list; a failed read keeps what shows (the next news reads again).
 */
export function createReread(
  read: () => Promise<ApiResult<FriendsResponse | undefined>>,
  done: (list: FriendsResponse) => void,
): () => void {
  let busy = false;
  return () => {
    if (busy) return;
    busy = true;
    void read().then((answer) => {
      busy = false;
      if (answer.ok && answer.body !== undefined) done(answer.body);
    });
  };
}

/** Whether a skeleton was seen (so what replaces it fades in once, rather than snapping). */
export function skeletonShown(root: ParentNode): boolean {
  const rows = root.querySelector('.friends-skeleton');
  return rows instanceof HTMLElement && !rows.hidden && rows.dataset['unseen'] === undefined;
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

/**
 * The list read failed: `card` in the list's place, and nothing moves. The list keeps the height it
 * had (the skeleton's), the cards under it keep theirs (the friend code's unseen: it came with the
 * list), so the link card stays where it was (ADR 0087).
 */
export function failInPlace(root: HTMLElement, lists: HTMLElement, card: HTMLElement): void {
  lists.removeAttribute('data-reveal');
  lists.style.minHeight = `${String(lists.getBoundingClientRect().height)}px`;
  lists.replaceChildren(card);
  root.setAttribute('data-list-failed', '');
}

/** The list drawn again (Try again answered): its own height, everything seen. */
export function drawnAgain(root: HTMLElement, lists: HTMLElement): void {
  lists.style.minHeight = '';
  root.removeAttribute('data-list-failed');
}
