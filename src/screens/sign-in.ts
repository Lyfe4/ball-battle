// The sign-in screen (ADR 0079): an email code or Google, linking this device's guest to the same
// player, or signing a device without one in after the 16+ question. One notice in every state,
// the field kept while the words change (notice.ts). Google is a full navigation to our own
// `/api/v1/auth/google`, whose callback comes back here as `?view=signin&google=<result>`; the
// result is read once and dropped from the address, so a reload doesn't repeat it.
import { type AuthOptions, type GoogleResult, type SignInResponse } from '../api/accounts.ts';
import type { CurrentMatch } from '../api/live.ts';
import type { PlayerResponse } from '../api/session.ts';
import { callApi, failureKindOf, type ApiFailure, type Fetch } from '../app/api.ts';
import {
  hasAccount,
  hasGuest,
  rememberAccount,
  rememberGuest,
  type DeviceStorage,
} from '../app/online-device.ts';
import { writeSignInParams } from '../app/online-url.ts';
import { whoAmI } from '../app/who-am-i.ts';
import { createNotice, type NoticeContent } from '../ui/notice.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import { createAccountStep } from './account-step.ts';
import { askToDelete } from './account-delete.ts';
import { createCodeStep } from './sign-in-code.ts';
import { offerSwitch } from './sign-in-switch.ts';
import { inAMatchCard } from './current-match.ts';
import { onlineNotice } from './online-text.ts';
import { adultSignInCard, chooseCard, GOOGLE_PROBLEMS, signInOffCard } from './sign-in-text.ts';

const GOOGLE_START = '/api/v1/auth/google';

export interface SignInHost {
  readonly storage: DeviceStorage;
  /** In-app Back: the previous screen, else home. */
  readonly back: () => void;
  readonly home: () => void;
  /** Rewrites this entry's URL without showing it again. */
  readonly rewrite: (write: (params: URLSearchParams) => void) => void;
  readonly toMatch: (match: CurrentMatch) => Promise<void>;
  /** Leaves the page for `url` (Google's sign-in starts on our API). */
  readonly leaveFor: (url: string) => void;
  readonly userAgent: string;
  /** The page's fetch; tests give their own. */
  readonly send?: Fetch;
  /** The page's cookies (`document.cookie`): the player hint says whether to ask `/me`. */
  readonly cookies: () => string;
  /** Log out, and Delete account or Forget me (account-step.ts): undefined when done. */
  readonly logOut?: () => Promise<string | undefined>;
  readonly forget?: () => Promise<string | undefined>;
}

export interface SignInScreen {
  show(google: GoogleResult | undefined): void;
  setVisible(visible: boolean): void;
}

export function createSignIn(
  roots: { readonly notice: HTMLElement; readonly loading: HTMLElement },
  host: SignInHost,
): SignInScreen {
  const notice = createNotice(roots.notice, host.back);
  createSkeleton(roots.loading, 'card', host.back);
  const api = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
    callApi<T>(method, path, body, {}, host.send);

  let visible = false;
  let options: AuthOptions = { google: false, emailCodes: true };
  let email = '';
  /** The 16+ confirmation, on a device without a guest. */
  let adult = false;

  function show(content: NoticeContent, focus = true): void {
    roots.loading.hidden = true;
    roots.notice.hidden = !visible;
    notice.show(content, focus);
  }

  const codes = createCodeStep({
    api,
    show,
    choose,
    failed,
    signedIn,
    done: () => {
      done();
    },
    visible: () => visible,
    adult: () => adult,
    email: () => email,
    setEmail: (value) => {
      email = value;
    },
  });

  const account = createAccountStep({
    show: (content) => {
      show(content);
    },
    loading: () => {
      roots.notice.hidden = true;
      roots.loading.hidden = !visible;
    },
    api,
    done: host.back,
    failed: (answer, retry, line) => {
      failed(answer, retry, line);
    },
    ...(host.logOut === undefined ? {} : { logOut: host.logOut }),
    ...(host.forget === undefined ? {} : { forget: host.forget }),
  });

  /** Signed in: a sign-in just now asks for a username, once (ADR 0079). */
  function done(justSignedIn = true): void {
    rememberAccount(host.storage, true);
    void account.open(justSignedIn);
  }

  /** A refusal or a failure: in a match, signed in already, or a line under the field. */
  function failed(
    answer: ApiFailure,
    retry: () => Promise<unknown>,
    line: (text: string) => void,
  ): void {
    if (answer.kind === 'error') {
      switch (answer.code) {
        case 'in_a_match':
          show(inAMatchCard(answer.message, host.toMatch, host.home));
          return;
        case 'already_signed_in':
          done(false);
          return;
        case 'accounts_off':
          show(signInOffCard(host.home));
          return;
        case 'age_unconfirmed':
        case 'unauthenticated':
          // The device's guest is gone: it starts again with the 16+ question.
          rememberGuest(host.storage, false);
          adult = false;
          start();
          return;
        default:
          if (answer.status < 500 || answer.code === 'email_busy') {
            line(answer.message);
            return;
          }
      }
    }
    show(onlineNotice(failureKindOf(answer), retry, host.home));
  }

  function choose(problem?: string, fieldError?: string): void {
    const forget = host.forget;
    show(
      chooseCard({
        google: options.google,
        emailCodes: options.emailCodes,
        userAgent: host.userAgent,
        ...(problem === undefined ? {} : { problem }),
        email: {
          kind: 'email',
          label: 'Your email',
          onInput: (value) => {
            email = value;
          },
          ...(fieldError === undefined ? {} : { error: fieldError }),
        },
        sendCode: codes.send,
        withGoogle: () => {
          host.leaveFor(adult ? `${GOOGLE_START}?adult=1` : GOOGLE_START);
          // The button stays busy while the page leaves.
          return new Promise(() => undefined);
        },
        cancel: host.back,
        ...(forget === undefined || !hasGuest(host.storage)
          ? {}
          : {
              forgetMe: () => {
                askToDelete(show, false, forget, () => {
                  choose(problem);
                });
              },
            }),
      }),
    );
  }

  function signedIn(outcome: SignInResponse['outcome'] | undefined, via: 'email' | 'google') {
    if (outcome !== 'switch') {
      done();
      return;
    }
    offerSwitch({ api, show, done, choose, failed, back: host.back }, via);
  }

  /** Where the screen starts: signed in already, the 16+ question, or the ways in. */
  function start(problem?: string): void {
    if (hasAccount(host.storage)) {
      done(false);
      return;
    }
    if (hasGuest(host.storage) || adult) {
      choose(problem);
      return;
    }
    const confirm = () => {
      adult = true;
      choose(problem);
    };
    show(adultSignInCard(confirm, host.back));
  }

  async function open(google: GoogleResult | undefined): Promise<void> {
    roots.notice.hidden = true;
    roots.loading.hidden = !visible;
    const answer = await api<AuthOptions>('GET', 'auth/options');
    if (!answer.ok) {
      if (answer.kind === 'error' && answer.code === 'accounts_off') show(signInOffCard(host.home));
      else show(onlineNotice(failureKindOf(answer), () => open(google), host.home));
      return;
    }
    options = answer.body ?? options;
    if (google === undefined) {
      // Signed in as the server says: Safari clears the device's keys after 7 days without a
      // visit while the session cookie stays (ADR 0079 addendum of 2026-11-22). Not known
      // (offline, failing): the device's keys decide, as before.
      const who = await whoAmI(host.storage, host.cookies(), () =>
        api<PlayerResponse>('GET', 'me'),
      );
      if (who.kind === 'account') done(false);
      else start();
      return;
    }
    // Read once: a reload or Back shows the screen afresh.
    host.rewrite(writeSignInParams);
    if (google === 'signed_in') done();
    else if (google === 'switch') signedIn('switch', 'google');
    else if (google === 'in_a_match') {
      const line = 'Finish or leave your match first, then sign in';
      show(inAMatchCard(line, host.toMatch, host.home));
    } else start(GOOGLE_PROBLEMS[google]);
  }

  return {
    show(google) {
      codes.reset();
      email = '';
      void open(google);
    },
    setVisible(next) {
      visible = next;
      if (!next) {
        roots.notice.hidden = true;
        roots.loading.hidden = true;
        codes.stop();
      }
    },
  };
}
