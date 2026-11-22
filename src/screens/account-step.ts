// The sign-in screen once signed in (ADR 0079): straight after a sign-in, an account without a
// username is asked for one (once: Skip goes on); later, the screen shows the username with a way
// to change it. The server checks every name and its words are shown under the field.
import type { UsernameResponse } from '../api/accounts.ts';
import type { PlayerResponse } from '../api/session.ts';
import type { ApiFailure, ApiResult } from '../app/api.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import { signedInCard, usernameCard } from './account-text.ts';

export interface AccountStepHost {
  readonly show: (content: NoticeContent) => void;
  /** The screen's skeleton, while /me loads. */
  readonly loading: () => void;
  readonly api: <T>(
    method: 'GET' | 'PUT',
    path: string,
    body?: unknown,
  ) => Promise<ApiResult<T | undefined>>;
  /** Done: back where the player came from. */
  readonly done: () => void;
  /**
   * A failure: a refusal's words under the field (`line`), or the screen's own handling (the
   * session gone, offline, the server failing) with `retry`.
   */
  readonly failed: (
    answer: ApiFailure,
    retry: () => Promise<unknown>,
    line: (text: string) => void,
  ) => void;
}

export interface AccountStep {
  /** Shows the account; `justSignedIn` asks for a username when it has none. */
  open(justSignedIn: boolean): Promise<void>;
}

export function createAccountStep(host: AccountStepHost): AccountStep {
  let username: string | null = null;
  let typed = '';

  function signedIn(): void {
    host.show(
      signedInCard(username, host.done, () => {
        choose();
      }),
    );
  }

  /** The username's field; a new visit starts empty, an error keeps what was typed. */
  function choose(error?: string): void {
    if (error === undefined) typed = '';
    host.show(
      usernameCard({
        current: username,
        field: {
          kind: 'username',
          label: 'Username',
          onInput: (value) => {
            typed = value;
          },
          ...(error === undefined ? {} : { error }),
        },
        save,
        skip: signedIn,
      }),
    );
  }

  async function save(): Promise<void> {
    const answer = await host.api<UsernameResponse>('PUT', 'me/username', { username: typed });
    if (answer.ok) {
      username = answer.body?.username ?? typed.trim();
      signedIn();
      return;
    }
    host.failed(answer, save, choose);
  }

  async function open(justSignedIn: boolean): Promise<void> {
    host.loading();
    const me = await host.api<PlayerResponse>('GET', 'me');
    if (!me.ok) {
      host.failed(me, () => open(justSignedIn), signedIn);
      return;
    }
    username = me.body?.username ?? null;
    if (justSignedIn && username === null) choose();
    else signedIn();
  }

  return { open };
}
