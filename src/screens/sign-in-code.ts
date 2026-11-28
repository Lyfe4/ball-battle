// The sign-in screen's email code (ADR 0079): send a code to the address typed, then the code,
// with Resend once a minute has passed (Auth sends at most one a minute). A lost answer to the
// code may have signed in all the same, so it asks `/me` before saying it didn't. Where the build
// checks first codes (ADR 0079 addendum of 2026-11-28), a first code to an address waits for the
// check's token; Send a new code to the same address within its code's life doesn't.
import { normalCode, normalEmail, type SignInResponse } from '../api/accounts.ts';
import type { PlayerResponse } from '../api/session.ts';
import type { ApiFailure, ApiResult } from '../app/api.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import type { Captcha } from '../ui/captcha.ts';
import { codeCard } from './sign-in-text.ts';

/** Auth sends at most one code a minute to an address. */
export const RESEND_AFTER_MS = 60_000;

/**
 * How long Send a new code goes without a new check: inside the server's pass, the sign-in cookie's
 * 10 minutes, with a margin for the clocks and the request.
 */
export const RESEND_UNCHECKED_MS = 9 * 60_000;

export interface CodeStepHost {
  readonly api: <T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ) => Promise<ApiResult<T | undefined>>;
  readonly show: (content: NoticeContent, focus?: boolean) => void;
  /** Back to the ways in, with a problem above them or under the email field. */
  readonly choose: (problem?: string, fieldError?: string) => void;
  readonly failed: (
    answer: ApiFailure,
    retry: () => Promise<unknown>,
    line: (text: string) => void,
  ) => void;
  readonly signedIn: (outcome: SignInResponse['outcome'] | undefined, via: 'email') => void;
  /** Signed in, found after a lost answer. */
  readonly done: () => void;
  readonly visible: () => boolean;
  /** The 16+ confirmation, on a device without a guest. */
  readonly adult: () => boolean;
  readonly email: () => string;
  readonly setEmail: (email: string) => void;
  /** The check before a first code, in a build with one (undefined: none, as before). */
  readonly captcha?: Captcha | undefined;
  /** The check didn't load or refused this browser: its failure card, Try again to the ways in. */
  readonly captchaFailed: () => void;
}

export interface CodeStep {
  readonly send: () => Promise<void>;
  /** A new visit: no code sent, nothing typed. */
  reset(): void;
  /** The screen went: no Resend later. */
  stop(): void;
}

export function createCodeStep(host: CodeStepHost): CodeStep {
  let code = '';
  /** The address the last code went to, when it may be sent again, and when it went. */
  let sent: { readonly to: string; readonly resendAt: number; readonly at: number } | undefined;
  let resendTimer: number | undefined;

  async function send(): Promise<void> {
    const to = normalEmail(host.email());
    if (to === undefined) {
      host.choose(undefined, 'Type your email address');
      return;
    }
    const again = sent?.to === to;
    const passed = again && Date.now() < (sent?.at ?? 0) + RESEND_UNCHECKED_MS;
    const check = passed ? undefined : host.captcha;
    if (check !== undefined && again) {
      // Send a new code long after the first: the server's pass has run out, so back to the
      // ways in, where the check is.
      sent = undefined;
      host.choose();
      return;
    }
    const captcha = check === undefined ? undefined : await check.token();
    if (check !== undefined && captcha === undefined) {
      host.captchaFailed();
      return;
    }
    const body = {
      email: to,
      ...(host.adult() ? { adult: true } : {}),
      ...(captcha === undefined ? {} : { captcha }),
    };
    const answer = await host.api<unknown>('POST', 'auth/email', body);
    if (!answer.ok) {
      // A token is spent once sent: trying again goes back to the ways in for a new one.
      const retry =
        check === undefined
          ? send
          : () => {
              host.choose();
              return Promise.resolve();
            };
      host.failed(answer, retry, (text) => {
        host.choose(undefined, text);
      });
      return;
    }
    sent = { to, resendAt: Date.now() + RESEND_AFTER_MS, at: Date.now() };
    code = '';
    window.clearTimeout(resendTimer);
    resendTimer = window.setTimeout(() => {
      if (host.visible()) askCode(undefined, false);
    }, RESEND_AFTER_MS);
    askCode();
  }

  function askCode(error?: string, focus = true): void {
    if (sent === undefined) {
      host.choose();
      return;
    }
    const to = sent.to;
    const resend = () => {
      host.setEmail(to);
      return send();
    };
    host.show(
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
          host.choose();
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
    const answer = await host.api<SignInResponse>('POST', 'auth/email/verify', { code: typed });
    if (answer.ok) {
      host.signedIn(answer.body?.outcome, 'email');
      return;
    }
    if (answer.kind === 'error' && answer.code === 'sign_in_expired') {
      sent = undefined;
      host.choose(undefined, answer.message);
      return;
    }
    // A lost answer may have signed in all the same: ask before saying it didn't.
    if (answer.kind !== 'error') {
      const me = await host.api<PlayerResponse>('GET', 'me');
      if (me.ok && me.body?.account === true) {
        host.done();
        return;
      }
    }
    host.failed(answer, verify, (text) => {
      askCode(text);
    });
  }

  return {
    send,
    reset() {
      sent = undefined;
      code = '';
    },
    stop() {
      window.clearTimeout(resendTimer);
    },
  };
}
