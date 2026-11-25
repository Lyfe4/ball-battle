// The Friends tab's lists (ADR 0079, PR (c); ADR 0081, 0086): what waits on you (friend requests,
// Decline and Accept), your friends, then your friend code with Copy, a field to add a friend by
// username or code, the requests you sent and who you blocked. Each person is a row (their disc,
// name and status, one inline action only where it can succeed) that opens their sheet
// (friend-sheet.ts): Challenge, Remove, Report name and Block, Cancel request, Unblock. Waiting for
// you leads with a series by turns waiting on your pick and friends' challenges (waiting-rows.ts).
// The order never changes after a read (ADR 0087): Waiting for you (when something waits), your
// friends (or, with none, the empty state in their place), your code and Add, then the tab's "Play
// a friend with a link" card, always last. The code card and the link card are in the first frame;
// rows come from the inbox at once where it has answered, else sized skeleton rows after 150 ms
// (friends-loading.ts), and a failed read is one card in the list's place.
// Every change answers with the whole list, drawn again. The field takes the notice's field look;
// every button that waits on the server is busy through busyOnClick.
import {
  shownFriendCode,
  type AddFriendResponse,
  type FriendEntry,
  type FriendsResponse,
  type Invite,
  type TurnWaiting,
} from '../../api/friends.ts';
import type { ApiFailure, ApiResult } from '../../app/api.ts';
import { visitCache, type VisitKey } from '../../app/visit-cache.ts';
import { busyOnClick } from '../busy-button.ts';
import { addField } from './friends-add-field.ts';
import {
  DEFAULT_SKELETON_ROWS,
  failureCard,
  inboxList,
  skeletonRows,
  skeletonShown,
} from './friends-loading.ts';
import { createFriendSheet, personDisc } from './friend-sheet.ts';
import { challengeRow, turnRow, type WaitingRowsHost } from './waiting-rows.ts';
import { element } from '../dom.ts';
import {
  addedLine,
  FRIEND_GROUPS,
  FRIENDS_FAILED_TITLE,
  NO_FRIENDS,
  personStatus,
  type FriendGroup,
} from '../../screens/friends-text.ts';

/** The Friends tab's last list this visit (visit-cache.ts). */
const FRIENDS_SEEN: VisitKey<FriendsResponse> = { name: 'friends' };

export interface FriendsHost {
  readonly api: <T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ) => Promise<ApiResult<T | undefined>>;
  /** A failure's one line (offline, failing, or the server's reason). */
  readonly line: (answer: ApiFailure) => string;
  /** Copies the code; false where there is no clipboard. */
  readonly copy: (text: string) => Promise<boolean>;
  /** Challenge: the vs Friend setup, the challenge going to this friend (PR (d)). */
  readonly challenge?: (friend: FriendEntry) => void;
  /** The friends changed here (a request sent or answered): the inbox reads now. */
  readonly changed?: () => void;
  /** The tab's link card, always last (ADR 0087). */
  readonly link?: HTMLElement;
  /** A friend's challenge in Waiting for you: Accept (its lineup) and No thanks (ADR 0081). */
  readonly acceptInvite?: (token: string) => Promise<void>;
  readonly declineInvite?: (token: string) => Promise<string | undefined>;
  /** A series by turns in Waiting for you: Play opens it (ADR 0085). */
  readonly openSeries?: (seriesId: string) => Promise<void>;
}

export interface FriendsSection {
  readonly element: HTMLElement;
  /** Reads the list afresh and draws it. */
  open(): Promise<void>;
  /** The friends' status from the inbox (PR (d)), drawn if the section shows. */
  statuses(friends: readonly FriendEntry[]): void;
  /**
   * The friends' open challenges from the inbox, and the series by turns waiting on your pick
   * (ADR 0085): first in Waiting for you (ADR 0081).
   */
  challenges(invites: readonly Invite[], turns?: readonly TurnWaiting[]): void;
}

function textButton(text: string, label: string): HTMLButtonElement {
  const button = element('button', 'text-link friends-action', text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  return button;
}

export function createFriendsSection(host: FriendsHost): FriendsSection {
  const root = element('div', 'friends');

  const codeRow = element('p', 'friends-code');
  const codeText = element('strong', 'friends-code-value');
  const copy = textButton('Copy', 'Copy your friend code');
  codeRow.append(element('span', 'friends-code-label', 'Your friend code'), codeText, copy);

  // Adding: the notice's field look, its own Add button, and one line for what happened.
  const { field, input, add, said } = addField();

  // Waiting for you, then your friends; your code and Add in a card of their own, with what you sent.
  const lists = element('div', 'friends-lists');
  const addCard = element('section', 'friends-card friends-add-card');
  addCard.setAttribute('aria-labelledby', 'friends-add-title');
  const addTitle = element('h2', 'friends-card-title', 'Your friend code');
  addTitle.id = 'friends-add-title';
  const sent = element('div', 'friends-sent');
  addCard.append(addTitle, codeRow, field, sent);
  // What a block or a report just did, said where the list is.
  const note = element('p', 'friends-note');
  note.setAttribute('role', 'status');
  root.append(note, lists, addCard);
  if (host.link !== undefined) root.append(host.link);

  let code = '';
  let list: FriendsResponse | undefined;
  /** The friends as the inbox last said (names and status): rows at once, before `/friends`. */
  let inboxFriends: readonly FriendEntry[] | undefined;
  let invites: readonly Invite[] = [];
  let turns: readonly TurnWaiting[] = [];

  /** A change's answer drawn, true when it was made (the friend sheet's actions). */
  const made = (method: 'POST' | 'DELETE', path: string, body?: unknown) => () =>
    send(host.api<FriendsResponse>(method, path, body)).then((done) => done !== undefined);
  const sheet = createFriendSheet({
    ...(host.challenge === undefined ? {} : { challenge: host.challenge }),
    remove: (id) => made('DELETE', `friends/${id}`)(),
    block: (id) => made('POST', `friends/${id}/block`)(),
    report: (id, reason) => made('POST', `friends/${id}/report`, { reason })(),
    accept: (id) => made('POST', `friends/${id}/accept`)(),
    decline: (id) => made('DELETE', `friends/${id}`)(),
    unblock: (id) => made('POST', `friends/${id}/unblock`)(),
    said: (line) => {
      note.textContent = line;
    },
  });
  root.append(sheet.element);

  /** Waits on you in a lobby: a friend's live challenge to you is open (not "In a match"). */
  const waitsOnYou = (friend: FriendEntry) => invites.some((invite) => invite.friend === friend.id);

  /** Opens the sheet of the person behind friendship `id`, wherever they are listed. */
  function openPerson(id: string): void {
    const now = list ?? inboxList(inboxFriends);
    for (const group of FRIEND_GROUPS) {
      const person = now[group.key].find((entry) => entry.id === id);
      if (person !== undefined) {
        sheet.open(person, group.key === 'friends' ? 'friend' : group.key, waitsOnYou(person));
        return;
      }
    }
  }

  const rows: WaitingRowsHost = {
    accept: host.acceptInvite,
    decline: host.declineInvite,
    play: host.openSeries,
    say: (line) => {
      say(line, true);
    },
    person: openPerson,
  };

  function say(text: string, error = false): void {
    said.textContent = text;
    said.toggleAttribute('data-error', error);
    input.setAttribute('aria-invalid', String(error));
  }

  /**
   * A person's row (ADR 0086): their disc, name and what they are; the row opens their sheet (its
   * chevron). One inline action at most, only where it can succeed: Challenge for a friend online; a
   * request to you keeps Decline and Accept side by side.
   */
  function rowOf(group: FriendGroup, friend: FriendEntry): HTMLElement {
    const item = element('li', 'friends-row');
    item.dataset['friend'] = friend.id;
    const kind = group.key === 'friends' ? 'friend' : group.key;
    const waiting = kind === 'friend' && waitsOnYou(friend);
    const open = element('button', 'friends-who friends-open');
    open.type = 'button';
    open.setAttribute('aria-label', `${friend.name}: ${personStatus(friend, kind, waiting)}`);
    const status = element('span', 'friends-status', personStatus(friend, kind, waiting));
    // A dot only on a friend's status line (ADR 0086), in its status's colour.
    if (kind === 'friend')
      status.dataset['status'] = waiting ? 'waiting' : (friend.status ?? 'offline');
    const words = element('span', 'friends-words');
    words.append(element('span', 'friends-name', friend.name), status);
    open.append(personDisc(friend, 'row'), words);
    open.addEventListener('click', () => {
      sheet.open(friend, kind, waiting);
    });
    const actions = element('span', 'friends-actions');
    item.append(open, actions);
    if (kind === 'incoming') {
      const decline = element('button', 'hud-button friends-decline', 'Decline');
      decline.type = 'button';
      decline.setAttribute('aria-label', `Decline ${friend.name}`);
      busyOnClick(decline, made('DELETE', `friends/${friend.id}`));
      const accept = element('button', 'hud-button hud-button-primary friends-accept', 'Accept');
      accept.type = 'button';
      accept.setAttribute('aria-label', `Accept ${friend.name}`);
      busyOnClick(accept, made('POST', `friends/${friend.id}/accept`));
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

  function draw(): void {
    // Before `/friends` answers, the friends the inbox named, else skeleton rows.
    const now = list ?? inboxList(inboxFriends);
    const fade = skeletonShown(lists);
    // Kept for the visit: the tab opened again shows it at once while it reads (ADR 0087).
    if (list !== undefined) visitCache.write(FRIENDS_SEEN, list);
    code = now.code;
    // Before the list answers, a placeholder of the code's shape keeps its line (unread, unseen).
    codeText.textContent = code === '' ? '0000-0000' : shownFriendCode(code);
    codeText.toggleAttribute('data-loading', code === '');
    codeText.toggleAttribute('aria-hidden', code === '');
    const box = (group: FriendGroup) => {
      const shown = element('section', 'friends-group');
      shown.dataset['group'] = group.key;
      const count = group.key === 'friends' ? ` · ${String(now.friends.length)}` : '';
      const title = element('h2', 'friends-group-title', `${group.title}${count}`);
      const items = element('ul', 'friends-list');
      items.append(...now[group.key].map((friend) => rowOf(group, friend)));
      shown.append(title, items);
      if (group.key !== 'friends') return shown;
      // Your friends always sit here: rows, skeleton rows while unknown, or the empty state.
      if (list === undefined && inboxFriends === undefined) {
        title.textContent = group.title;
        items.replaceWith(skeletonRows(DEFAULT_SKELETON_ROWS));
      } else if (now.friends.length === 0) {
        items.replaceWith(element('p', 'friends-empty', NO_FRIENDS));
      }
      return shown;
    };
    const groups = FRIEND_GROUPS.filter(
      (group) =>
        group.key === 'friends' ||
        now[group.key].length > 0 ||
        (group.key === 'incoming' && invites.length + turns.length > 0),
    );
    // What waits on you and your friends lead; what you sent sits with your code (ADR 0081).
    const withCode = (group: FriendGroup) => group.key === 'outgoing' || group.key === 'blocked';
    lists.replaceChildren(...groups.filter((group) => !withCode(group)).map(box));
    // A turn and a friend's challenges come first in Waiting for you: they wait on a clock.
    lists
      .querySelector('.friends-group[data-group="incoming"] .friends-list')
      ?.prepend(
        ...turns.map((turn) => turnRow(turn, Date.now(), rows)),
        ...invites.map((invite) => challengeRow(invite, rows)),
      );
    sent.replaceChildren(...groups.filter(withCode).map(box));
    addCard.hidden = false;
    // The link card last, taken back from the guest's layout if it lent it (friends-tab.ts).
    if (host.link !== undefined && root.lastElementChild !== host.link) root.append(host.link);
    // One calm reveal where skeleton rows were seen (ADR 0087 rule 4).
    lists.toggleAttribute('data-reveal', fade && list !== undefined);
  }

  /** A change's answer: the list drawn again, or why not under the field. */
  async function send<T extends FriendsResponse>(request: Promise<ApiResult<T | undefined>>) {
    const answer = await request;
    if (!answer.ok) {
      say(host.line(answer), true);
      return undefined;
    }
    if (answer.body !== undefined) list = answer.body;
    draw();
    host.changed?.();
    return answer.body;
  }

  async function addFriend(): Promise<void> {
    const to = input.value.trim();
    if (to === '') {
      say('Type a username or a friend code', true);
      input.focus();
      return;
    }
    const answer = await send(host.api<AddFriendResponse>('POST', 'friends', { to }));
    if (answer === undefined) return;
    input.value = '';
    say(addedLine(answer));
  }
  busyOnClick(add, addFriend);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add.click();
    }
  });
  copy.addEventListener('click', () => {
    void host.copy(shownFriendCode(code)).then((done) => {
      copy.textContent = done ? 'Copied' : 'Copy';
    });
  });

  async function open(): Promise<void> {
    note.textContent = '';
    say('');
    copy.textContent = 'Copy';
    // What this visit read shows at once, and the read refreshes it in place.
    // Never another player's: a sign-in or a switch clears the cache, and with it this list.
    list = visitCache.read(FRIENDS_SEEN);
    // In the first frame either way: what is known, or the skeleton's place.
    draw();
    const answer = await host.api<FriendsResponse>('GET', 'friends');
    // A failed refresh under what this visit already showed keeps it (the inbox keeps it current).
    if (!answer.ok && list !== undefined) return;
    if (!answer.ok) {
      // One failure card in the list's place; the link card stays (ADR 0087 rule 7).
      lists.removeAttribute('data-reveal');
      lists.replaceChildren(failureCard(FRIENDS_FAILED_TITLE, host.line(answer), open));
      addCard.hidden = true;
      return;
    }
    list = answer.body;
    draw();
  }

  return {
    element: root,
    open,
    challenges(next, nextTurns = []) {
      if (JSON.stringify([next, nextTurns]) === JSON.stringify([invites, turns])) return;
      invites = next;
      turns = nextTurns;
      if (root.isConnected) draw();
    },
    statuses(friends) {
      // Before `/friends` answers, the inbox's friends are the rows (ADR 0087 rule 6).
      if (list === undefined) {
        const before = JSON.stringify(inboxFriends);
        inboxFriends = friends;
        if (before !== JSON.stringify(friends) && root.isConnected) draw();
        return;
      }
      const before = JSON.stringify(list.friends);
      if (before === JSON.stringify(friends)) return;
      list = { ...list, friends };
      draw();
    },
  };
}
