// The account screen's Friends section (ADR 0079, PR (c)): a section of that screen, not a screen
// of its own. Your friend code with Copy, a field to add a friend by username or code, then the
// requests waiting on you (Accept, Decline), your friends (Remove, asked in place) and the requests
// you sent (Cancel). Every change answers with the whole list, drawn again. The field takes the
// notice's field look; every button that waits on the server is busy through busyOnClick.
import {
  shownFriendCode,
  type AddFriendResponse,
  type FriendEntry,
  type FriendsResponse,
} from '../../api/friends.ts';
import type { ApiFailure, ApiResult } from '../../app/api.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';
import {
  addedLine,
  FRIEND_GROUPS,
  hasAnyone,
  NO_FRIENDS,
  removeQuestion,
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
}

export interface FriendsSection {
  readonly element: HTMLElement;
  /** Reads the list afresh and draws it. */
  open(): Promise<void>;
}

function textButton(text: string, label: string): HTMLButtonElement {
  const button = element('button', 'text-link friends-action', text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  return button;
}

export function createFriendsSection(host: FriendsHost): FriendsSection {
  const root = element('section', 'friends');
  root.setAttribute('aria-labelledby', 'friends-heading');
  const heading = element('h2', 'friends-heading', 'Friends');
  heading.id = 'friends-heading';

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

  const lists = element('div', 'friends-lists');
  const problem = element('p', 'friends-problem');
  problem.setAttribute('role', 'alert');
  const retry = textButton('Try again', 'Try again');
  const problemBox = element('div', 'friends-problem-box');
  problemBox.append(problem, retry);
  problemBox.hidden = true;
  root.append(heading, codeRow, field, problemBox, lists);
  root.hidden = true;

  let code = '';
  /** The row whose Remove is being asked, by friendship id. */
  let asking: string | undefined;
  let list: FriendsResponse | undefined;

  function say(text: string, error = false): void {
    said.textContent = text;
    said.toggleAttribute('data-error', error);
    input.setAttribute('aria-invalid', String(error));
  }

  function rowOf(group: FriendGroup, friend: FriendEntry): HTMLElement {
    const item = element('li', 'friends-row');
    item.dataset['friend'] = friend.id;
    const name = element('span', 'friends-name', friend.name);
    const actions = element('span', 'friends-actions');
    item.append(name, actions);
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
      const remove = textButton('Remove', `Remove ${friend.name}`);
      remove.addEventListener('click', () => {
        asking = friend.id;
        draw();
      });
      actions.append(remove);
    }
    return item;
  }

  function draw(): void {
    if (list === undefined) return;
    code = list.code;
    codeText.textContent = shownFriendCode(code);
    const now = list;
    const groups = FRIEND_GROUPS.filter((group) => now[group.key].length > 0).map((group) => {
      const box = element('div', 'friends-group');
      box.dataset['group'] = group.key;
      const title = element('h3', 'friends-group-title', group.title);
      const items = element('ul', 'friends-list');
      items.append(...now[group.key].map((friend) => rowOf(group, friend)));
      box.append(title, items);
      return box;
    });
    lists.replaceChildren(
      ...(hasAnyone(now) ? groups : [element('p', 'friends-empty', NO_FRIENDS)]),
    );
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
      codeRow.hidden = true;
      field.hidden = true;
      lists.replaceChildren();
      return;
    }
    problemBox.hidden = true;
    codeRow.hidden = false;
    field.hidden = false;
    list = answer.body;
    draw();
    root.hidden = false;
  }
  busyOnClick(retry, open);

  return { element: root, open };
}
