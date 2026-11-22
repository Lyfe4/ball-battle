// The sign-in screen's email code (ADR 0079): send a code to the address typed, then the code,
// with Resend once a minute has passed (Auth sends at most one a minute). A lost answer to the
// code may have signed in all the same, so it asks `/me` before saying it didn't.
import { normalCode, normalEmail, type SignInResponse } from '../api/accounts.ts';
import type { PlayerResponse } from '../api/session.ts';
import type { ApiFailure, ApiResult } from '../app/api.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import { codeCard } from './sign-in-text.ts';

/** Auth sends at most one code a minute to an address. */
export const RESEND_AFTER_MS = 60_000;

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
  /** The address the last code went to, and when it may be sent again. */
  let sent: { readonly to: string; readonly resendAt: number } | undefined;
  let resendTimer: number | undefined;

  async function send(): Promise<void> {
    const to = normalEmail(host.email());
    if (to === undefined) {
      host.choose(undefined, 'Type your email address');
      return;
    }
    const body = host.adult() ? { email: to, adult: true } : { email: to };
    const answer = await host.api<unknown>('POST', 'auth/email', body);
    if (!answer.ok) {
      host.failed(answer, send, (text) => {
        host.choose(undefined, text);
      });
      return;
    }
    sent = { to, resendAt: Date.now() + RESEND_AFTER_MS };
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
