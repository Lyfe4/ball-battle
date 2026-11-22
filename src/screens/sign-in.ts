// The sign-in screen (ADR 0079): an email code or Google, linking this device's guest to the same
// player, or signing a device without one in after the 16+ question. One notice in every state,
// the field kept while the words change (notice.ts). Google is a full navigation to our own
// `/api/v1/auth/google`, whose callback comes back here as `?view=signin&google=<result>`; the
// result is read once and dropped from the address, so a reload doesn't repeat it.
import {
  normalCode,
  normalEmail,
  type AuthOptions,
  type GoogleResult,
  type SignInResponse,
} from '../api/accounts.ts';
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
import { createNotice, type NoticeContent } from '../ui/notice.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import { inAMatchCard } from './current-match.ts';
import { onlineNotice } from './online-text.ts';
import {
  adultSignInCard,
  chooseCard,
  codeCard,
  GOOGLE_PROBLEMS,
  signedInCard,
  signInOffCard,
  switchCard,
} from './sign-in-text.ts';

/** Auth sends at most one code a minute to an address. */
export const RESEND_AFTER_MS = 60_000;
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
  const api = <T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown) =>
    callApi<T>(method, path, body, {}, host.send);

  let visible = false;
  let options: AuthOptions = { google: false, emailCodes: true };
  let email = '';
  let code = '';
  /** The address the last code went to, and when it may be sent again. */
  let sent: { readonly to: string; readonly resendAt: number } | undefined;
  let resendTimer: number | undefined;
  /** The 16+ confirmation, on a device without a guest. */
  let adult = false;

  function show(content: NoticeContent, focus = true): void {
    roots.loading.hidden = true;
    roots.notice.hidden = !visible;
    notice.show(content, focus);
  }

  function done(): void {
    rememberAccount(host.storage, true);
    show(signedInCard(host.back));
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
          done();
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
        sendCode,
        withGoogle: () => {
          host.leaveFor(adult ? `${GOOGLE_START}?adult=1` : GOOGLE_START);
          // The button stays busy while the page leaves.
          return new Promise(() => undefined);
        },
        cancel: host.back,
      }),
    );
  }

  async function sendCode(): Promise<void> {
    const to = normalEmail(email);
    if (to === undefined) {
      choose(undefined, 'Type your email address');
      return;
    }
    const body = adult ? { email: to, adult } : { email: to };
    const answer = await api<unknown>('POST', 'auth/email', body);
    if (!answer.ok) {
      failed(answer, sendCode, (text) => {
        choose(undefined, text);
      });
      return;
    }
    sent = { to, resendAt: Date.now() + RESEND_AFTER_MS };
    code = '';
    window.clearTimeout(resendTimer);
    resendTimer = window.setTimeout(() => {
      if (visible) askCode(undefined, false);
    }, RESEND_AFTER_MS);
    askCode();
  }

  function askCode(error?: string, focus = true): void {
    if (sent === undefined) {
      choose();
      return;
    }
    const to = sent.to;
    const resend = () => {
      email = to;
      return sendCode();
    };
    show(
      codeCard({
        email: to,
        code: {
          kind: 'code',
          label: 'The code',
          onInput: (value) => {
            code = value;
          },
          ...(error === undefined ? {} : { error }),
        },
        verify,
        anotherEmail: () => {
          sent = undefined;
          choose();
        },
        resend: Date.now() >= sent.resendAt ? resend : undefined,
      }),
      focus,
    );
  }

  async function verify(): Promise<void> {
    const typed = normalCode(code);
    if (typed === undefined) {
      askCode('Type the 6 digits from the email');
      return;
    }
    const answer = await api<SignInResponse>('POST', 'auth/email/verify', { code: typed });
    if (answer.ok) {
      signedIn(answer.body?.outcome, 'email');
      return;
    }
    if (answer.kind === 'error' && answer.code === 'sign_in_expired') {
      sent = undefined;
      choose(undefined, answer.message);
      return;
    }
    // A lost answer may have signed in all the same: ask before saying it didn't.
    if (answer.kind !== 'error' && (await isAccount())) {
      done();
      return;
    }
    failed(answer, verify, (text) => {
      askCode(text);
    });
  }

  function signedIn(outcome: SignInResponse['outcome'] | undefined, via: 'email' | 'google') {
    if (outcome !== 'switch') {
      done();
      return;
    }
    const switchTo = async (): Promise<void> => {
      const answer = await api<SignInResponse>('POST', 'auth/switch', {});
      if (answer.ok) done();
      else if (answer.kind === 'error' && answer.code === 'sign_in_expired') choose(answer.message);
      else
        failed(answer, switchTo, (text) => {
          choose(text);
        });
    };
    const stay = async (): Promise<void> => {
      await api('DELETE', 'auth/switch');
      host.back();
    };
    show(switchCard(via, switchTo, stay));
  }

  async function isAccount(): Promise<boolean> {
    const me = await api<PlayerResponse>('GET', 'me');
    return me.ok && me.body?.account === true;
  }

  /** Where the screen starts: signed in already, the 16+ question, or the ways in. */
  function start(problem?: string): void {
    if (hasAccount(host.storage)) {
      done();
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
      start();
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
      sent = undefined;
      email = '';
      code = '';
      void open(google);
    },
    setVisible(next) {
      visible = next;
      if (!next) {
        roots.notice.hidden = true;
        roots.loading.hidden = true;
        window.clearTimeout(resendTimer);
      }
    },
  };
}
