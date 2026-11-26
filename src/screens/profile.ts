// Profile (ADR 0081, 0087, accounts builds): who the player is and the account's own
// actions, which it shares with the sign-in screen (account-step.ts): the username, Log out and
// Delete account; for a guest, what signing in unlocks, Sign in and Forget me. It reads `/me` once
// when it opens (who-source.ts, shared with the avatar), and for an account its record
// (`/me/record`, ADR 0088: the stats card and Recent matches, profile-record.ts).
import { callApi, failureKindOf, type ApiFailure, type Fetch } from '../app/api.ts';
import { hasGuest, type DeviceStorage } from '../app/online-device.ts';
import type { WhoSource } from '../app/who-source.ts';
import { element } from '../ui/dom.ts';
import type { RecordResponse } from '../api/record.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createNotice, type NoticeContent } from '../ui/notice.ts';
import { createProfileRecord } from '../ui/online/profile-record.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import { askToDelete } from './account-delete.ts';
import { createAccountStep } from './account-step.ts';
import { onlineNotice } from './online-text.ts';
import { accountProfile, guestProfile, identityLines, unknownProfile } from './profile-text.ts';

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
  /** The balls, for the favourite's picture and name. */
  readonly lookup: DefinitionLookup;
  /** Opens a finished online series' own screen (ADR 0088), once it is read. */
  readonly openSeries: (id: string) => Promise<unknown>;
  /** The page's fetch; tests give their own. */
  readonly send?: Fetch;
}

export interface ProfileScreen {
  show(): void;
  setVisible(visible: boolean): void;
}

/** Who you are, under the title (your name): your disc, your @username, what opponents see. */
function identityBlock(username: string | null): HTMLElement {
  const block = element('div', 'profile-identity');
  const disc = element('span', 'friends-disc friends-disc-sheet', (username ?? 'P').slice(0, 1));
  disc.setAttribute('aria-hidden', 'true');
  const lines = element('div', 'profile-identity-lines');
  const [first, ...rest] = identityLines(username);
  if (username !== null && first !== undefined) lines.append(element('p', 'profile-handle', first));
  for (const line of username === null ? [first ?? ''] : rest) {
    lines.append(element('p', 'notice-text', line));
  }
  block.append(disc, lines);
  return block;
}

export function createProfile(
  roots: { readonly notice: HTMLElement; readonly loading: HTMLElement },
  host: ProfileHost,
): ProfileScreen {
  // The card, then Privacy · Terms at the end, quiet, as in settings' About (ADR 0069).
  const card = element('div', 'profile-card');
  const legal = element('p', 'profile-legal');
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
  const api = <T>(method: 'GET' | 'PUT', path: string, body?: unknown) =>
    callApi<T>(method, path, body, {}, host.send);
  // The record (ADR 0088): its own part of the card, kept across redraws, read when shown.
  const record = createProfileRecord({
    lookup: host.lookup,
    load: () => api<RecordResponse>('GET', 'me/record'),
    open: host.openSeries,
  });

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
    card: (username, change, actions) => ({
      part: withRecord(identityBlock(username)),
      ...accountProfile({
        username,
        change,
        ...(actions === undefined
          ? {}
          : {
              logOut: actions.logOut,
              deleteAccount: actions.deleteAccount,
              ...(actions.problem === undefined ? {} : { problem: actions.problem }),
            }),
      }),
    }),
  });

  /** Who you are, then your record under it (ADR 0088). */
  function withRecord(identity: HTMLElement): HTMLElement {
    const part = element('div', 'profile-part');
    part.append(identity, record.element);
    return part;
  }

  async function open(): Promise<void> {
    // An account this visit already knows shows at once, then refreshes in place (ADR 0087).
    const known = host.who.known();
    if (known?.kind === 'account') {
      account.show(known.username);
      void record.refresh();
    } else loading();
    const who = await host.who.ask();
    switch (who.kind) {
      case 'account':
        if (known?.kind !== 'account') void record.refresh();
        // The account already drawn: an answer that changes nothing draws nothing, so a card the
        // player opened meanwhile (Delete's confirm, Change username) stays as it is.
        if (known?.kind === 'account' && known.username === who.username) return;
        account.show(who.username);
        return;
      case 'unknown':
        // The one failure card's words (ADR 0087): offline said as offline.
        show(navigator.onLine ? unknownProfile(open) : onlineNotice('offline', open, host.home));
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
    show(guestProfile({ signIn: host.signIn, ...(forgetMe === undefined ? {} : { forgetMe }) }));
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
