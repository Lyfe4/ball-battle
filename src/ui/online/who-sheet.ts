// "Who do you want to play?" (ADR 0089, B1): Play against a friend, signed in, opens it when it has
// nobody to go straight to. The shared sheet (one ×, tap outside, Escape; Back closes it) with the
// Friends tab's rows: friends online first with Challenge (live, on the Play box's rules), then the
// rest with Play by turns where the build plays by turns (three, then "Show all N friends"), then
// "Anyone, with a link ›". With no friends, sending a link is the main button. The friends are the
// inbox's (no read of its own); before the inbox has answered, sized rows hold their place.
import type { FriendEntry } from '../../api/friends.ts';
import type { FriendSetup } from '../../app/modes.ts';
import { FRIEND_GROUPS } from '../../screens/friends-text.ts';
import {
  ADD_FRIEND,
  ANYONE,
  ANYONE_FIRST,
  liveLine,
  NO_FRIENDS,
  noneOnlineLine,
  onlineTitle,
  OTHERS_SHOWN,
  othersTitle,
  showAll,
  WHO_TITLE,
} from '../../screens/who-text.ts';
import { element } from '../dom.ts';
import { createSheet } from '../sheet.ts';
import { DEFAULT_SKELETON_ROWS, skeletonRows } from './friends-loading.ts';
import { personRow } from './person-row.ts';

export interface WhoSheetHost {
  /** A live match with a friend online, on the box's rules. */
  readonly challenge: (friend: FriendEntry) => void;
  /** By turns with a friend, where the build plays by turns; else undefined. */
  readonly turns: ((friend: FriendEntry) => void) | undefined;
  /** A live match by a link to anyone (what Play did before B1). */
  readonly anyone: () => void;
  /** The Friends tab, to add one. */
  readonly addFriend: () => void;
}

export interface WhoSheet {
  /** Opens it on `friends` (undefined: not known yet) and the rules Challenge starts. */
  open(friends: readonly FriendEntry[] | undefined, setup: FriendSetup): void;
  /** The inbox said who is a friend now: drawn again if it is open. */
  update(friends: readonly FriendEntry[]): void;
  close(): void;
}

const FRIENDS_GROUP = FRIEND_GROUPS.find((group) => group.key === 'friends') ?? {
  key: 'friends',
  title: 'Friends',
};

export function createWhoSheet(host: WhoSheetHost): WhoSheet {
  const sheet = createSheet({ id: 'who-sheet-title', title: WHO_TITLE, name: 'who-sheet' });
  const root = element('div', 'who-sheet-groups');
  sheet.content.append(root);
  let setup: FriendSetup | undefined;
  let all = false;

  /** Each choice closes the sheet first: what it starts takes over the screen. */
  const then =
    (act: (friend: FriendEntry) => void) =>
    (friend: FriendEntry): void => {
      sheet.close();
      act(friend);
    };

  function rows(people: readonly FriendEntry[]): HTMLElement {
    const list = element('ul', 'friends-list');
    for (const friend of people) {
      const online = friend.status === 'online';
      const pick = online ? host.challenge : host.turns;
      const row = personRow(FRIENDS_GROUP, friend, {
        waiting: false,
        // The whole row is the pick its button makes; a row with nothing to start opens nothing.
        open: () => {
          if (pick !== undefined) then(pick)(friend);
        },
        made: () => () => Promise.resolve(false),
        challenge: then(host.challenge),
        ...(host.turns === undefined ? {} : { turns: then(host.turns) }),
      });
      if (pick === undefined) row.querySelector('.friends-open')?.setAttribute('disabled', '');
      list.append(row);
    }
    return list;
  }

  function group(title: string, list: HTMLElement, line?: string): HTMLElement {
    const section = element('section', 'who-sheet-group');
    section.append(element('h3', 'friends-group-title', title));
    if (line !== undefined) section.append(element('p', 'who-sheet-line', line));
    section.append(list);
    return section;
  }

  function anyoneRow(first: boolean): HTMLElement {
    const button = element(
      'button',
      first ? 'hud-button hud-button-primary hud-button-main' : 'sheet-row',
      first ? ANYONE_FIRST : ANYONE,
    );
    button.type = 'button';
    button.setAttribute('aria-label', first ? ANYONE_FIRST : ANYONE);
    if (!first) button.dataset['opens'] = '';
    button.addEventListener('click', () => {
      sheet.close();
      host.anyone();
    });
    return button;
  }

  function draw(friends: readonly FriendEntry[] | undefined): void {
    if (setup === undefined) return;
    if (friends === undefined) {
      const loading = element('section', 'who-sheet-group');
      loading.append(skeletonRows(DEFAULT_SKELETON_ROWS));
      root.replaceChildren(loading, anyoneRow(false));
      return;
    }
    if (friends.length === 0) {
      const none = element('section', 'who-sheet-group who-sheet-none');
      const add = element('button', 'text-link who-sheet-add', ADD_FRIEND);
      add.type = 'button';
      add.setAttribute('aria-label', ADD_FRIEND);
      add.addEventListener('click', () => {
        sheet.close();
        host.addFriend();
      });
      none.append(element('p', 'friends-card-text', NO_FRIENDS), add);
      root.replaceChildren(none, anyoneRow(true));
      return;
    }
    const online = friends.filter((friend) => friend.status === 'online');
    const others = friends.filter((friend) => friend.status !== 'online');
    const parts: HTMLElement[] = [];
    if (online.length > 0) {
      parts.push(group(onlineTitle(online.length), rows(online), liveLine(setup)));
    } else {
      parts.push(element('p', 'who-sheet-line', noneOnlineLine(host.turns !== undefined)));
    }
    if (others.length > 0) {
      const shown = all ? others : others.slice(0, OTHERS_SHOWN);
      const section = group(othersTitle(online.length > 0, others.length), rows(shown));
      if (!all && others.length > OTHERS_SHOWN) {
        const more = element('button', 'sheet-row who-sheet-all', showAll(friends.length));
        more.type = 'button';
        more.addEventListener('click', () => {
          all = true;
          draw(friends);
          // Focus stays in the list it opened: the first friend it added.
          root
            .querySelectorAll<HTMLElement>('.friends-open')
            [online.length + OTHERS_SHOWN]?.focus();
        });
        section.append(more);
      }
      parts.push(section);
    }
    root.replaceChildren(...parts, anyoneRow(false));
  }

  let shownFriends: readonly FriendEntry[] | undefined;
  return {
    open(friends, next) {
      setup = next;
      all = false;
      shownFriends = friends;
      draw(friends);
      if (!sheet.element.isConnected) document.body.append(sheet.element);
      sheet.open();
    },
    update(friends) {
      shownFriends = friends;
      if (sheet.isOpen()) draw(shownFriends);
    },
    close() {
      sheet.close();
    },
  };
}
