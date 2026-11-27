// "Who do you want to play?" (ADR 0089 and its addendum of 2026-11-27): the one vs Friend path,
// signed in. Play against a friend opens it, and so does a friend's Challenge on the Friends tab
// (that friend picked already). The shared sheet (one ×, tap outside, Escape; Back closes it): the
// rules from Play's box, then friends to pick (online first, the friend last picked first in each
// group), then "Send a link instead". Picking a row only selects it; one button at the bottom says
// what it sends ("Challenge Robin", "Play Jo by turns", "Send a link") and sends nothing before
// it is tapped. It stays busy on its own until the waiting screen can show, and a failure is said
// above it in the game's words, the pick kept for Try again. Live needs a friend online; else by
// turns where the build plays by turns; a friend neither can start is listed but can't be picked.
// The friends are the inbox's (no read of its own); before it answers, sized rows hold their place.
import type { FriendEntry } from '../../api/friends.ts';
import type { FriendSetup } from '../../app/modes.ts';
import {
  ADD_FRIEND,
  friendLine,
  howFor,
  LINK_ROW,
  LINK_ROW_LINE,
  NO_FRIENDS,
  onlineTitle,
  OTHERS_SHOWN,
  othersTitle,
  rulesLine,
  sendSpoken,
  sendWords,
  showAll,
  whoOrder,
  WHO_TITLE,
  type WhoPick,
} from '../../screens/who-text.ts';
import { busyOnClick } from '../busy-button.ts';
import { shapeIcon } from '../icons.ts';
import { element, setHidden, setText } from '../dom.ts';
import { BACK_TO_IT, inGameLine, type InGame } from '../../screens/friends-text.ts';
import { createSheet } from '../sheet.ts';
import { personDisc } from './friend-sheet.ts';
import { DEFAULT_SKELETON_ROWS, skeletonRows } from './friends-loading.ts';

export interface WhoSheetHost {
  /** Whether the build plays by turns (ADR 0085). */
  readonly turns: boolean;
  /**
   * Sends what was picked: calls `moving` just before the next screen shows (the sheet closes
   * then, so focus lands on that screen), or resolves with the line that says why it didn't, said
   * above the button.
   */
  readonly send: (
    pick: WhoPick,
    setup: FriendSetup,
    moving: () => void,
  ) => Promise<string | undefined>;
  /** The Friends tab, to add one. */
  readonly addFriend: () => void;
  /** The live game the player is in, if any: the sheet offers no new challenge then. */
  readonly inGame: () => InGame | undefined;
  /** Back to that game; resolves false when there is none any more (the sheet draws again). */
  readonly backToGame: () => Promise<boolean>;
}

/** What the sheet opens with picked: a friend (by the friendship's id), or the link. */
export type WhoPreset = { readonly friend: string } | { readonly link: true } | undefined;

export interface WhoSheet {
  /**
   * Opens on `friends` (undefined: not known yet) and the rules it sends on; `preset` picks a row
   * already (a friend's Challenge on the Friends tab); `first` is the friend last picked.
   */
  open(
    friends: readonly FriendEntry[] | undefined,
    setup: FriendSetup,
    preset?: WhoPreset,
    first?: string,
  ): void;
  /**
   * The inbox said who is a friend now, and whose live challenge waits for you (by friendship id):
   * drawn again if it is open, the pick kept if it still can.
   */
  update(friends: readonly FriendEntry[], waiting?: ReadonlySet<string>): void;
  isOpen(): boolean;
  close(): void;
}

export function createWhoSheet(host: WhoSheetHost): WhoSheet {
  const sheet = createSheet({ id: 'who-sheet-title', title: WHO_TITLE, name: 'who-sheet' });
  const rules = element('p', 'who-sheet-rules');
  const root = element('div', 'who-sheet-groups');
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-labelledby', 'who-sheet-title');
  // The one button and the line that says why it didn't work, kept at the sheet's foot.
  const foot = element('div', 'who-sheet-foot');
  const failure = element('p', 'who-sheet-failure');
  failure.setAttribute('role', 'alert');
  failure.hidden = true;
  const send = element('button', 'hud-button hud-button-primary hud-button-main who-sheet-send');
  send.type = 'button';
  send.dataset['sound'] = 'tap';
  foot.append(failure, send);
  sheet.content.append(rules, root, foot);

  let setup: FriendSetup | undefined;
  let friends: readonly FriendEntry[] | undefined;
  let picked: WhoPick | undefined;
  /** The friend last picked, listed first. */
  let first: string | undefined;
  /** A friend to pick once the inbox has answered (a Challenge before it had). */
  let wanted: string | undefined;
  /** Friends whose live challenge waits for this player: picking them accepts it (crossed). */
  let waiting: ReadonlySet<string> = new Set();
  const howOf = (friend: FriendEntry, rulesNow: FriendSetup) =>
    howFor(friend, rulesNow, host.turns, waiting.has(friend.id));
  let all = false;
  /** The game the player is in, as last drawn: one line and Back to it in the sheet's place. */
  let game: InGame | undefined;
  /** What the groups were last drawn as, so a redraw that changes nothing keeps the same rows. */
  let drawn = '';

  /**
   * Puts `parts` in the sheet, unless they are what it shows already: an inbox read that changes
   * nothing redraws nothing, so a tap whose press and release straddle the read still lands on
   * one row (a click needs both on the same element; WebKit's flow lost a tap to it).
   */
  function place(...parts: HTMLElement[]): void {
    const next = parts.map((part) => part.outerHTML).join('');
    if (next === drawn && root.childElementCount === parts.length) return;
    drawn = next;
    root.replaceChildren(...parts);
  }

  function say(line: string | undefined): void {
    failure.hidden = line === undefined;
    setText(failure, line ?? '');
  }

  function showSend(): void {
    if (setup === undefined) return;
    if (game !== undefined) {
      setText(send, BACK_TO_IT);
      send.setAttribute('aria-label', `${inGameLine(game)}: ${BACK_TO_IT}`);
      send.removeAttribute('aria-disabled');
      return;
    }
    setText(send, sendWords(picked));
    send.setAttribute('aria-label', sendSpoken(picked, setup));
    // Nothing picked: it says what to do and does nothing (never a request to refuse).
    if (picked === undefined) send.setAttribute('aria-disabled', 'true');
    else send.removeAttribute('aria-disabled');
  }

  // Nothing picked: no request, so the button never looks busy for it.
  busyOnClick(send, () => {
    // In a game: its one button goes back to it; gone meanwhile, the friends show again.
    if (game !== undefined) {
      return host.backToGame().then((moved) => {
        if (moved) sheet.close();
        else draw();
      });
    }
    const pick = picked;
    if (pick === undefined || setup === undefined) return undefined;
    say(undefined);
    const moving = () => {
      sheet.close();
    };
    return host.send(pick, setup, moving).then((line) => {
      if (line !== undefined) say(line);
    });
  });

  const isPicked = (key: string): boolean =>
    picked === undefined
      ? false
      : picked.kind === 'link'
        ? key === 'link'
        : picked.friend.id === key;

  function choose(next: WhoPick | undefined): void {
    picked = next;
    say(undefined);
    for (const row of root.querySelectorAll<HTMLElement>('.who-row')) {
      row.setAttribute('aria-checked', String(isPicked(row.dataset['who'] ?? '')));
    }
    showSend();
  }

  /** One row: a radio in the look of a chosen option, its disc, name and line. */
  function row(key: string, name: string, line: string, disc: HTMLElement, pick?: WhoPick) {
    const button = element('button', 'who-row choice');
    button.type = 'button';
    button.dataset['who'] = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(isPicked(key)));
    button.setAttribute('aria-label', `${name}: ${line}`);
    const words = element('span', 'friends-words');
    words.append(element('span', 'friends-name', name), element('span', 'friends-status', line));
    button.append(disc, words);
    if (pick === undefined) button.setAttribute('aria-disabled', 'true');
    button.addEventListener('click', () => {
      if (pick !== undefined) choose(pick);
    });
    return button;
  }

  function friendRows(people: readonly FriendEntry[], rulesNow: FriendSetup): HTMLElement {
    const list = element('div', 'who-sheet-rows');
    for (const friend of people) {
      const how = howOf(friend, rulesNow);
      const pick: WhoPick | undefined =
        how === undefined
          ? undefined
          : { kind: 'friend', friend, how, accepts: waiting.has(friend.id) };
      const disc = personDisc(friend, 'row');
      const line = friendLine(friend, how, rulesNow, waiting.has(friend.id));
      const item = row(friend.id, friend.name, line, disc, pick);
      item.dataset['status'] = friend.status ?? 'offline';
      list.append(item);
    }
    return list;
  }

  function group(title: string, list: HTMLElement): HTMLElement {
    const section = element('section', 'who-sheet-group');
    section.append(element('h3', 'friends-group-title', title), list);
    return section;
  }

  function linkRow(): HTMLElement {
    const disc = element('span', 'who-link-disc');
    disc.setAttribute('aria-hidden', 'true');
    disc.append(shapeIcon('link', 'who-link-icon'));
    return row('link', LINK_ROW, LINK_ROW_LINE, disc, { kind: 'link' });
  }

  /** The pick, again from `friends` (a status changed): kept while it still can start. */
  function keepPick(): void {
    if (picked?.kind !== 'friend' || setup === undefined) return;
    const id = picked.friend.id;
    const now = friends?.find((friend) => friend.id === id);
    const how = now === undefined ? undefined : howOf(now, setup);
    picked =
      now === undefined || how === undefined
        ? undefined
        : { kind: 'friend', friend: now, how, accepts: waiting.has(now.id) };
  }

  /** The friend a Challenge asked for, picked as soon as the inbox lists them. */
  function pickWanted(): void {
    if (wanted === undefined || friends === undefined || setup === undefined) return;
    const friend = friends.find((one) => one.id === wanted);
    wanted = undefined;
    const how = friend === undefined ? undefined : howOf(friend, setup);
    if (friend !== undefined && how !== undefined)
      picked = { kind: 'friend', friend, how, accepts: waiting.has(friend.id) };
  }

  function draw(): void {
    const rulesNow = setup;
    if (rulesNow === undefined) return;
    // One game at a time (ADR 0089 addendum of 2026-11-27): no friends to pick, no link, one line.
    game = host.inGame();
    setHidden(rules, game !== undefined);
    if (game !== undefined) {
      place(element('p', 'friends-card-text who-sheet-in-game', inGameLine(game)));
      showSend();
      return;
    }
    setText(rules, rulesLine(rulesNow));
    if (friends === undefined) {
      const loading = element('section', 'who-sheet-group');
      loading.append(skeletonRows(DEFAULT_SKELETON_ROWS));
      place(loading, linkRow());
      showSend();
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
      // The link is the only way: picked already, the button says what it does.
      picked ??= { kind: 'link' };
      place(none, linkRow());
      showSend();
      return;
    }
    const { online, others } = whoOrder(friends, first);
    const parts: HTMLElement[] = [];
    if (online.length > 0)
      parts.push(group(onlineTitle(online.length), friendRows(online, rulesNow)));
    if (others.length > 0) {
      // A picked friend is always shown, even past "Show all".
      const pickedId = picked?.kind === 'friend' ? picked.friend.id : undefined;
      const pickedAt = others.findIndex((one) => one.id === pickedId);
      const shown = all || pickedAt >= OTHERS_SHOWN ? others : others.slice(0, OTHERS_SHOWN);
      const section = group(
        othersTitle(online.length > 0, others.length),
        friendRows(shown, rulesNow),
      );
      if (shown.length < others.length) {
        const more = element('button', 'sheet-row who-sheet-all', showAll(friends.length));
        more.type = 'button';
        more.addEventListener('click', () => {
          all = true;
          draw();
          // Focus stays in the list it opened: the first friend it added.
          root.querySelectorAll<HTMLElement>('.who-row')[online.length + OTHERS_SHOWN]?.focus();
        });
        section.append(more);
      }
      parts.push(section);
    }
    place(...parts, linkRow());
    showSend();
  }

  return {
    open(next, rulesNow, preset, last) {
      setup = rulesNow;
      friends = next;
      first = last;
      all = false;
      picked = undefined;
      wanted = undefined;
      say(undefined);
      if (preset !== undefined && 'link' in preset) picked = { kind: 'link' };
      else if (preset !== undefined) {
        wanted = preset.friend;
        first = preset.friend;
        pickWanted();
      }
      draw();
      if (!sheet.element.isConnected) document.body.append(sheet.element);
      sheet.open();
    },
    update(next, waitingNow) {
      friends = next;
      if (waitingNow !== undefined) waiting = waitingNow;
      if (!sheet.isOpen()) return;
      keepPick();
      pickWanted();
      draw();
    },
    isOpen: () => sheet.isOpen(),
    close() {
      sheet.close();
    },
  };
}
