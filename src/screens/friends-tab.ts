// The Friends tab (ADR 0081, online builds): play a friend with a link, for everyone; then, signed
// in to an account, what waits on you, your friends, your code and Add (friends-section.ts, which
// places the link card first while there are no friends yet); for a guest or nobody, what signing
// in unlocks, with Sign in, never a wall; with accounts off, that friends lists are on the way. It
// reads `/me` (only where there may be a player) and `/me/friends` when it opens; never on a timer.
import type { FriendEntry, Invite, TurnWaiting } from '../api/friends.ts';
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import { TURNS_BUILD } from '../app/turns-build.ts';
import { callApi, failureKindOf, type Fetch } from '../app/api.ts';
import { hasAccount, type DeviceStorage } from '../app/online-device.ts';
import type { WhoAmI } from '../app/who-am-i.ts';
import type { WhoSource } from '../app/who-source.ts';
import { element } from '../ui/dom.ts';
import { failureCard } from '../ui/online/friends-loading.ts';
import { createFriendsSection } from '../ui/online/friends-section.ts';
import { createScreenHeader } from '../ui/screen-header.ts';
import { FRIENDS_FAILED_TITLE, FRIENDS_SOON, LINK_CARD, SIGN_IN_CARD } from './friends-text.ts';
import { failureLine } from './online-failure-text.ts';

export interface FriendsTabHost {
  /** Who this device plays as: one `/me` shared with the avatar, kept for the visit (ADR 0087). */
  readonly who: WhoSource;
  readonly storage: DeviceStorage;
  readonly cookies: () => string;
  /** In-app Back: Play, as the tab Back rule says (ADR 0081). */
  readonly back: () => void;
  /** The send screen: a live challenge by a link. */
  readonly sendLink: () => void;
  /** Sign in: its own screen. */
  readonly signIn: () => void;
  /**
   * Challenge a friend: the send screen, for them; `turns` (Take turns in their sheet, where
   * TURNS_BUILD, ADR 0085) goes by turns straight to its lineup.
   */
  readonly challenge: (friend: FriendEntry, turns?: boolean) => void;
  /** The friends changed here: the inbox reads now. */
  readonly changed?: () => void;
  /** Accept and No thanks on a friend's challenge (the inbox's, ADR 0081). */
  readonly acceptInvite?: (token: string) => Promise<void>;
  readonly declineInvite?: (token: string) => Promise<string | undefined>;
  /** A series by turns waiting on your pick: Play opens it (ADR 0085). */
  readonly openSeries?: (seriesId: string) => Promise<void>;
  /** The page's fetch; tests give their own. */
  readonly send?: Fetch;
}

export interface FriendsTab {
  show(): void;
  setVisible(visible: boolean): void;
  /** The friends' status from the inbox, drawn if the list shows. */
  statuses(friends: readonly FriendEntry[]): void;
  /** The friends' open challenges and turns (ADR 0085) from the inbox, first in Waiting for you. */
  invites(invites: readonly Invite[], turns?: readonly TurnWaiting[]): void;
}

/** A card of the tab: its title, then what it holds. */
function card(name: string, title: string, ...parts: HTMLElement[]): HTMLElement {
  const root = element('section', `friends-card ${name}`);
  const heading = element('h2', 'friends-card-title', title);
  heading.id = `${name}-title`;
  root.setAttribute('aria-labelledby', heading.id);
  root.append(heading, ...parts);
  return root;
}

export function createFriendsTab(root: HTMLElement, host: FriendsTabHost): FriendsTab {
  root.classList.add('friends-screen');
  const header = createScreenHeader('Friends', 'Back', host.back, { tab: 'friends' });
  const body = element('div', 'friends-tab');
  root.append(header.element, body);

  const challenge = element('button', 'hud-button hud-button-primary', LINK_CARD.button);
  challenge.type = 'button';
  challenge.addEventListener('click', host.sendLink);
  const link = card(
    'friends-link-card',
    LINK_CARD.title,
    element('p', 'friends-card-text', LINK_CARD.body),
    challenge,
  );

  const api = <T>(method: 'GET' | 'POST' | 'DELETE', path: string, payload?: unknown) =>
    callApi<T>(method, path, payload, {}, host.send);
  // Only a build with accounts holds the lists' code (`scripts/check-bundle.ts`).
  const friends = ACCOUNTS_BUILD
    ? createFriendsSection({
        api,
        line: (answer) =>
          failureLine(failureKindOf(answer), answer.kind === 'error' ? answer.message : undefined),
        copy: async (text) => {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch {
            return false;
          }
        },
        challenge: (friend) => {
          host.challenge(friend);
        },
        // Take turns only where the build plays by turns (ADR 0085).
        ...(TURNS_BUILD
          ? {
              takeTurns: (friend: FriendEntry) => {
                host.challenge(friend, true);
              },
            }
          : {}),
        ...(host.changed === undefined ? {} : { changed: host.changed }),
        ...(host.acceptInvite === undefined ? {} : { acceptInvite: host.acceptInvite }),
        ...(host.declineInvite === undefined ? {} : { declineInvite: host.declineInvite }),
        ...(host.openSeries === undefined ? {} : { openSeries: host.openSeries }),
        link,
      })
    : undefined;

  function signInCard(): HTMLElement {
    const unlocks = element('ul', 'friends-unlocks');
    unlocks.append(...SIGN_IN_CARD.unlocks.map((line) => element('li', '', line)));
    const signIn = element('button', 'hud-button hud-button-primary', SIGN_IN_CARD.button);
    signIn.type = 'button';
    signIn.addEventListener('click', host.signIn);
    return card(
      'friends-sign-in-card',
      SIGN_IN_CARD.title,
      unlocks,
      signIn,
      element('p', 'friends-card-note', SIGN_IN_CARD.note),
    );
  }

  /**
   * `/me` didn't answer: the one failure card (ADR 0087), offline said as offline, and Try again
   * asks again; the link card still works.
   */
  function unknownCard(): HTMLElement {
    const kind = navigator.onLine ? 'error' : 'offline';
    return failureCard(FRIENDS_FAILED_TITLE, failureLine(kind), open);
  }

  let visible = false;
  async function open(): Promise<void> {
    if (friends === undefined) {
      body.replaceChildren(
        link,
        card(
          'friends-soon-card',
          FRIENDS_SOON.title,
          element('p', 'friends-card-text', FRIENDS_SOON.body),
        ),
      );
      return;
    }
    // What this visit already knows shows at once (an account's friends from the visit cache), and
    // the link card never waits on the server; then `/me`, shared with the avatar, says who.
    const shown = (who: WhoAmI | undefined): void => {
      if (who?.kind === 'account') {
        if (friends.element.parentElement !== body) body.replaceChildren(friends.element);
      } else if (who?.kind === 'unknown') body.replaceChildren(link, unknownCard());
      else if (who?.kind === 'none' || who?.kind === 'guest')
        body.replaceChildren(link, signInCard());
      else body.replaceChildren(link);
    };
    // A device that remembers an account draws the account's layout at once: its parts don't move
    // when `/me` agrees (the device's keys are a cache; `/me` still decides).
    const known =
      host.who.known() ??
      (hasAccount(host.storage) ? ({ kind: 'account', username: null } as const) : undefined);
    shown(known);
    if (known?.kind === 'account') void friends.open();
    const who = await host.who.ask();
    if (who.kind === known?.kind) return;
    shown(who);
    if (who.kind === 'account') await friends.open();
  }

  return {
    show() {
      void open();
      header.focus();
    },
    setVisible(next) {
      visible = next;
      root.hidden = !visible;
    },
    statuses(list) {
      friends?.statuses(list);
    },
    invites(list, turns) {
      friends?.challenges(list, turns);
    },
  };
}
