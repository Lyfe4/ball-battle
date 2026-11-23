// The Friends tab's lists (ADR 0079, PR (c); ADR 0081): what waits on you (friend requests, Accept
// and Decline), your friends (their status, Challenge, Remove asked in place), then your friend
// code with Copy, a field to add a friend by username or code, and the requests you sent (Cancel).
// The tab's "Play a friend with a link" card comes last, or first while there are no friends yet.
// Every change answers with the whole list, drawn again. The field takes the notice's field look;
// every button that waits on the server is busy through busyOnClick.
import {
  shownFriendCode,
  type AddFriendResponse,
  type FriendEntry,
  type FriendsResponse,
  type Invite,
} from '../../api/friends.ts';
import type { ApiFailure, ApiResult } from '../../app/api.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';
import { challengeLine } from '../../screens/online-text.ts';
import {
  addedLine,
  challengesYou,
  FRIEND_GROUPS,
  hasAnyone,
  NO_FRIENDS,
  removeQuestion,
  STATUS_WORDS,
  type FriendGroup,
} from '../../screens/friends-text.ts';

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
  /** The tab's link card, placed first with no friends yet, else last (ADR 0081). */
  readonly link?: HTMLElement;
  /** A friend's challenge in Waiting for you: Accept (its lineup) and No thanks (ADR 0081). */
  readonly acceptInvite?: (token: string) => Promise<void>;
  readonly declineInvite?: (token: string) => Promise<string | undefined>;
}

export interface FriendsSection {
  readonly element: HTMLElement;
  /** Reads the list afresh and draws it. */
  open(): Promise<void>;
  /** The friends' status from the inbox (PR (d)), drawn if the section shows. */
  statuses(friends: readonly FriendEntry[]): void;
  /** The friends' open challenges from the inbox, first in Waiting for you (ADR 0081). */
  challenges(invites: readonly Invite[]): void;
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
  const field = element('div', 'notice-field friends-add');
  const label = element('label', 'notice-field-label', 'Add a friend');
  const input = element('input', 'notice-field-input');
  input.id = 'friends-add-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.autocapitalize = 'off';
  input.setAttribute('autocorrect', 'off');
  input.placeholder = 'Username or friend code';
  label.htmlFor = input.id;
  const add = element('button', 'hud-button friends-add-button', 'Add');
  add.type = 'button';
  const said = element('p', 'friends-said');
  said.setAttribute('role', 'status');
  const row = element('div', 'friends-add-row');
  row.append(input, add);
  field.append(label, row, said);

  // Waiting for you, then your friends; your code and Add in a card of their own, with what you sent.
  const lists = element('div', 'friends-lists');
  const addCard = element('section', 'friends-card friends-add-card');
  addCard.setAttribute('aria-labelledby', 'friends-add-title');
  const addTitle = element('h2', 'friends-card-title', 'Your friend code');
  addTitle.id = 'friends-add-title';
  const empty = element('p', 'friends-empty', NO_FRIENDS);
  const sent = element('div', 'friends-sent');
  addCard.append(addTitle, empty, codeRow, field, sent);
  const problem = element('p', 'friends-problem');
  problem.setAttribute('role', 'alert');
  const retry = textButton('Try again', 'Try again');
  const problemBox = element('div', 'friends-problem-box');
  problemBox.append(problem, retry);
  problemBox.hidden = true;
  root.append(problemBox, lists, addCard);
  root.hidden = true;

  let code = '';
  /** The row whose Remove is being asked, by friendship id. */
  let asking: string | undefined;
  let list: FriendsResponse | undefined;
  let invites: readonly Invite[] = [];

  function say(text: string, error = false): void {
    said.textContent = text;
    said.toggleAttribute('data-error', error);
    input.setAttribute('aria-invalid', String(error));
  }

  function rowOf(group: FriendGroup, friend: FriendEntry): HTMLElement {
    const item = element('li', 'friends-row');
    item.dataset['friend'] = friend.id;
    const name = element('span', 'friends-name', friend.name);
    // The name, and under it a friend's status: the actions keep the row's right.
    const who = element('span', 'friends-who');
    who.append(name);
    const actions = element('span', 'friends-actions');
    item.append(who, actions);
    const change = (method: 'POST' | 'DELETE', path: string) => () =>
      send(host.api<FriendsResponse>(method, path));
    if (group.key === 'incoming') {
      const accept = element('button', 'hud-button hud-button-primary friends-accept', 'Accept');
      accept.type = 'button';
      accept.setAttribute('aria-label', `Accept ${friend.name}`);
      busyOnClick(accept, change('POST', `friends/${friend.id}/accept`));
      const decline = textButton('Decline', `Decline ${friend.name}`);
      busyOnClick(decline, change('DELETE', `friends/${friend.id}`));
      actions.append(accept, decline);
    } else if (group.key === 'outgoing') {
      const cancel = textButton('Cancel', `Cancel your request to ${friend.name}`);
      busyOnClick(cancel, change('DELETE', `friends/${friend.id}`));
      actions.append(element('span', 'friends-waiting', 'Waiting'), cancel);
    } else if (asking === friend.id) {
      // Removing is asked once, in place: Keep first, so a stray tap keeps the friend.
      name.textContent = removeQuestion(friend.name);
      const keep = textButton('Keep', `Keep ${friend.name}`);
      keep.addEventListener('click', () => {
        asking = undefined;
        draw();
      });
      const remove = textButton('Remove', `Remove ${friend.name}`);
      busyOnClick(remove, change('DELETE', `friends/${friend.id}`));
      actions.append(keep, remove);
    } else {
      // Its status: a dot and words (PR (d)), for accepted friends only.
      const status = friend.status ?? 'offline';
      const state = element('span', 'friends-status', STATUS_WORDS[status]);
      state.dataset['status'] = status;
      name.after(state);
      const challenge = host.challenge;
      if (challenge !== undefined) {
        const send = element('button', 'hud-button friends-challenge', 'Challenge');
        send.type = 'button';
        send.setAttribute('aria-label', `Challenge ${friend.name}`);
        send.addEventListener('click', () => {
          challenge(friend);
        });
        actions.append(send);
      }
      const remove = textButton('Remove', `Remove ${friend.name}`);
      remove.addEventListener('click', () => {
        asking = friend.id;
        draw();
      });
      actions.append(remove);
    }
    return item;
  }

  /** A friend's challenge: who and what, Accept and No thanks. */
  function challengeRow(invite: Invite): HTMLElement {
    const item = element('li', 'friends-row');
    item.dataset['invite'] = invite.token;
    const who = element('span', 'friends-who');
    who.append(
      element('span', 'friends-name', challengesYou(invite.from)),
      element('span', 'friends-status friends-challenge-what', challengeLine(invite)),
    );
    const actions = element('span', 'friends-actions');
    const accept = element('button', 'hud-button hud-button-primary friends-accept', 'Accept');
    accept.type = 'button';
    accept.setAttribute('aria-label', `Accept ${invite.from}’s challenge`);
    busyOnClick(accept, () => host.acceptInvite?.(invite.token));
    const decline = textButton('No thanks', `No thanks to ${invite.from}’s challenge`);
    busyOnClick(decline, async () => {
      const why = await host.declineInvite?.(invite.token);
      if (why !== undefined) say(why, true);
    });
    actions.append(accept, decline);
    item.append(who, actions);
    return item;
  }

  function draw(): void {
    if (list === undefined) return;
    code = list.code;
    codeText.textContent = shownFriendCode(code);
    const now = list;
    const box = (group: FriendGroup) => {
      const shown = element('section', 'friends-group');
      shown.dataset['group'] = group.key;
      const count = group.key === 'friends' ? ` · ${String(now.friends.length)}` : '';
      const title = element('h2', 'friends-group-title', `${group.title}${count}`);
      const items = element('ul', 'friends-list');
      items.append(...now[group.key].map((friend) => rowOf(group, friend)));
      shown.append(title, items);
      return shown;
    };
    const groups = FRIEND_GROUPS.filter(
      (group) => now[group.key].length > 0 || (group.key === 'incoming' && invites.length > 0),
    );
    // What waits on you and your friends lead; what you sent sits with your code (ADR 0081).
    lists.replaceChildren(...groups.filter((group) => group.key !== 'outgoing').map(box));
    // A friend's challenges come first in Waiting for you: they wait on a clock.
    lists
      .querySelector('.friends-group[data-group="incoming"] .friends-list')
      ?.prepend(...invites.map(challengeRow));
    sent.replaceChildren(...groups.filter((group) => group.key === 'outgoing').map(box));
    empty.hidden = hasAnyone(now);
    // With no friends yet, playing by a link comes first; with friends, last.
    const link = host.link;
    if (link !== undefined) {
      if (now.friends.length === 0) root.prepend(link);
      else root.append(link);
    }
  }

  /** A change's answer: the list drawn again, or why not under the field. */
  async function send<T extends FriendsResponse>(request: Promise<ApiResult<T | undefined>>) {
    const answer = await request;
    if (!answer.ok) {
      say(host.line(answer), true);
      return undefined;
    }
    asking = undefined;
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
    asking = undefined;
    say('');
    copy.textContent = 'Copy';
    const answer = await host.api<FriendsResponse>('GET', 'friends');
    if (!answer.ok) {
      problem.textContent = host.line(answer);
      problemBox.hidden = false;
      root.hidden = false;
      addCard.hidden = true;
      lists.replaceChildren();
      if (host.link !== undefined) root.append(host.link);
      return;
    }
    problemBox.hidden = true;
    addCard.hidden = false;
    list = answer.body;
    draw();
    root.hidden = false;
  }
  busyOnClick(retry, open);

  return {
    element: root,
    open,
    challenges(next) {
      if (JSON.stringify(next) === JSON.stringify(invites)) return;
      invites = next;
      if (list !== undefined && !root.hidden && asking === undefined) draw();
    },
    statuses(friends) {
      if (list === undefined || root.hidden) return;
      const before = JSON.stringify(list.friends);
      if (before === JSON.stringify(friends)) return;
      list = { ...list, friends };
      // Never under a question being asked: Remove's stays until it is answered.
      if (asking === undefined) draw();
    },
  };
}
