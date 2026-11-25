// Profile (ADR 0081, accounts builds): who the player is, the stats to come, and the account's own
// actions, which it shares with the sign-in screen (account-step.ts): the username, Log out and
// Delete account; for a guest, what signing in unlocks, Sign in and Forget me. It reads `/me` once
// when it opens (who-am-i.ts) and nothing else; the stats card reads nothing.
import { callApi, failureKindOf, type ApiFailure, type Fetch } from '../app/api.ts';
import { hasGuest, type DeviceStorage } from '../app/online-device.ts';
import type { WhoSource } from '../app/who-source.ts';
import { createComingSoon } from '../ui/coming-soon.ts';
import { element } from '../ui/dom.ts';
import { createNotice, type NoticeContent } from '../ui/notice.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import { askToDelete } from './account-delete.ts';
import { createAccountStep } from './account-step.ts';
import { onlineNotice } from './online-text.ts';
import { accountProfile, guestProfile, PROFILE_STATS, unknownProfile } from './profile-text.ts';

export interface ProfileHost {
  /** Who this device plays as: one `/me` shared with the avatar, kept for the visit (ADR 0087). */
  readonly who: WhoSource;
  readonly storage: DeviceStorage;
  /** In-app Back: the previous screen, else Play. */
  readonly back: () => void;
  readonly home: () => void;
  /** Sign in: its own screen (ADR 0081). */
  readonly signIn: () => void;
  readonly cookies: () => string;
  /** Log out, and Delete account or Forget me: undefined when done (the page starts afresh). */
  readonly logOut: () => Promise<string | undefined>;
  readonly forget: () => Promise<string | undefined>;
  /** The page's fetch; tests give their own. */
  readonly send?: Fetch;
}

export interface ProfileScreen {
  show(): void;
  setVisible(visible: boolean): void;
}

export function createProfile(
  roots: { readonly notice: HTMLElement; readonly loading: HTMLElement },
  host: ProfileHost,
): ProfileScreen {
  // The card, then Privacy · Terms at the end, quiet, as on the Play tab (ADR 0069).
  const card = element('div', 'profile-card');
  const legal = element('p', 'home-footer profile-legal');
  for (const [text, href] of [
    ['Privacy', '/privacy.html'],
    ['Terms', '/terms.html'],
  ] as const) {
    const anchor = element('a', 'text-link', text);
    anchor.href = href;
    legal.append(anchor);
  }
  roots.notice.append(card, legal);
  const notice = createNotice(card, host.back);
  createSkeleton(roots.loading, 'card', host.back);
  const stats = createComingSoon(
    'Your stats',
    PROFILE_STATS.map((label) => ({ label })),
    undefined,
    true,
  );
  const api = <T>(method: 'GET' | 'PUT', path: string, body?: unknown) =>
    callApi<T>(method, path, body, {}, host.send);

  let visible = false;
  function show(content: NoticeContent): void {
    roots.loading.hidden = true;
    roots.notice.hidden = !visible;
    notice.show(content);
  }
  function loading(): void {
    roots.notice.hidden = true;
    roots.loading.hidden = !visible;
  }
  /** A refusal's words under the field; anything else, the screen's own failure with Try again. */
  function failed(answer: ApiFailure, retry: () => Promise<unknown>, line: (text: string) => void) {
    if (answer.kind === 'error' && answer.status < 500) {
      line(answer.message);
      return;
    }
    show(onlineNotice(failureKindOf(answer), retry, host.home));
  }

  const account = createAccountStep({
    show,
    loading,
    api,
    done: host.back,
    failed,
    logOut: host.logOut,
    forget: host.forget,
    card: (username, change, actions) =>
      accountProfile({
        username,
        stats,
        change,
        ...(actions === undefined
          ? {}
          : {
              logOut: actions.logOut,
              deleteAccount: actions.deleteAccount,
              ...(actions.problem === undefined ? {} : { problem: actions.problem }),
            }),
      }),
  });

  async function open(): Promise<void> {
    // An account this visit already knows shows at once, then refreshes in place (ADR 0087).
    const known = host.who.known();
    if (known?.kind === 'account') account.show(known.username);
    else loading();
    const who = await host.who.ask();
    switch (who.kind) {
      case 'account':
        account.show(who.username);
        return;
      case 'unknown':
        show(unknownProfile(open));
        return;
      default:
        showGuest();
    }
  }

  function showGuest(): void {
    const forgetMe = hasGuest(host.storage)
      ? () => {
          askToDelete(show, false, host.forget, showGuest);
        }
      : undefined;
    show(
      guestProfile({ stats, signIn: host.signIn, ...(forgetMe === undefined ? {} : { forgetMe }) }),
    );
  }

  return {
    show() {
      void open();
    },
    setVisible(next) {
      visible = next;
      if (!next) {
        roots.notice.hidden = true;
        roots.loading.hidden = true;
      }
    },
  };
}
