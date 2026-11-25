// The Friends tab (ADR 0081, online builds): play a friend with a link, for everyone; then, signed
// in to an account, what waits on you, your friends, your code and Add (friends-section.ts, which
// places the link card first while there are no friends yet); for a guest or nobody, what signing
// in unlocks, with Sign in, never a wall; with accounts off, that friends lists are on the way. It
// reads `/me` (only where there may be a player) and `/me/friends` when it opens; never on a timer.
import type { FriendEntry, Invite, TurnWaiting } from '../api/friends.ts';
import type { PlayerResponse } from '../api/session.ts';
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import { callApi, failureKindOf, type Fetch } from '../app/api.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import { whoAmI } from '../app/who-am-i.ts';
import { busyOnClick } from '../ui/busy-button.ts';
import { element } from '../ui/dom.ts';
import { createFriendsSection } from '../ui/online/friends-section.ts';
import { createScreenHeader } from '../ui/screen-header.ts';
import { FRIENDS_SOON, LINK_CARD, SIGN_IN_CARD } from './friends-text.ts';
import { failureLine } from './online-failure-text.ts';

export interface FriendsTabHost {
  readonly storage: DeviceStorage;
  readonly cookies: () => string;
  /** In-app Back: Play, as the tab Back rule says (ADR 0081). */
  readonly back: () => void;
  /** The send screen: a live challenge by a link. */
  readonly sendLink: () => void;
  /** Sign in: its own screen. */
  readonly signIn: () => void;
  /** Challenge a friend from their row: the send screen, for them. */
  readonly challenge: (friend: FriendEntry) => void;
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
        challenge: host.challenge,
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

  /** `/me` didn't answer: the link card still works, and Try again asks again. */
  function unknownCard(): HTMLElement {
    const retry = element('button', 'hud-button', 'Try again');
    retry.type = 'button';
    busyOnClick(retry, open);
    return card(
      'friends-unknown-card',
      'Your friends',
      element('p', 'friends-card-text', 'We couldn’t reach the server to see who you are.'),
      retry,
    );
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
    // The link card at once: it never waits on the server.
    body.replaceChildren(link);
    const who = await whoAmI(host.storage, host.cookies(), () => api<PlayerResponse>('GET', 'me'));
    if (who.kind === 'account') {
      body.replaceChildren(friends.element);
      await friends.open();
    } else if (who.kind === 'unknown') body.replaceChildren(link, unknownCard());
    else body.replaceChildren(link, signInCard());
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
