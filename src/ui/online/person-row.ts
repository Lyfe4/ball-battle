// A person's row on the Friends tab (ADR 0086): their disc, name and status (a dot only on a
// friend's status line), the whole row opening their sheet, and at most one inline action, only
// where it can succeed: Accept and Decline for a request, Challenge for a friend online.
import type { FriendEntry } from '../../api/friends.ts';
import { personStatus, type FriendGroup } from '../../screens/friends-text.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';
import { personDisc } from './friend-sheet.ts';

export interface PersonRowHost {
  /** A friend whose lobby waits for this player (their status says so). */
  readonly waiting: boolean;
  /** Opens the person's sheet. */
  readonly open: () => void;
  /** A change to the friends list, as a request: true when it was made. */
  readonly made: (method: 'POST' | 'DELETE', path: string) => () => Promise<boolean>;
  /** Challenge a friend online (the vs Friend setup), where the build offers it. */
  readonly challenge: ((friend: FriendEntry) => void) | undefined;
}

export function personRow(
  group: FriendGroup,
  friend: FriendEntry,
  host: PersonRowHost,
): HTMLElement {
  const item = element('li', 'friends-row');
  item.dataset['friend'] = friend.id;
  const kind = group.key === 'friends' ? 'friend' : group.key;
  const status = personStatus(friend, kind, host.waiting);
  const open = element('button', 'friends-who friends-open');
  open.type = 'button';
  open.setAttribute('aria-label', `${friend.name}: ${status}`);
  const line = element('span', 'friends-status', status);
  // A dot only on a friend's status line (ADR 0086), in its status's colour.
  if (kind === 'friend')
    line.dataset['status'] = host.waiting ? 'waiting' : (friend.status ?? 'offline');
  const words = element('span', 'friends-words');
  words.append(element('span', 'friends-name', friend.name), line);
  open.append(personDisc(friend, 'row'), words);
  open.addEventListener('click', host.open);
  const actions = element('span', 'friends-actions');
  item.append(open, actions);
  if (kind === 'incoming') {
    const decline = element('button', 'hud-button friends-decline', 'Decline');
    decline.type = 'button';
    decline.setAttribute('aria-label', `Decline ${friend.name}`);
    busyOnClick(decline, host.made('DELETE', `friends/${friend.id}`));
    const accept = element('button', 'hud-button hud-button-primary friends-accept', 'Accept');
    accept.type = 'button';
    accept.setAttribute('aria-label', `Accept ${friend.name}`);
    busyOnClick(accept, host.made('POST', `friends/${friend.id}/accept`));
    actions.append(decline, accept);
  } else if (kind === 'friend' && friend.status === 'online' && host.challenge !== undefined) {
    const challenge = host.challenge;
    const send = element('button', 'hud-button friends-challenge', 'Challenge');
    send.type = 'button';
    send.setAttribute('aria-label', `Challenge ${friend.name}`);
    send.addEventListener('click', () => {
      challenge(friend);
    });
    actions.append(send);
  }
  return item;
}
