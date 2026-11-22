// The sign-in screen once signed in (ADR 0079): straight after a sign-in, an account without a
// username is asked for one (once: Skip goes on); later, the screen shows the username with a way
// to change it, then Log out and Delete account (its addendum of 2026-11-22: the account screen is
// the one place for the player). The server checks every name and its words are shown under the
// field.
import type { UsernameResponse } from '../api/accounts.ts';
import type { PlayerResponse } from '../api/session.ts';
import type { ApiFailure, ApiResult } from '../app/api.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import { askToDelete } from './account-delete.ts';
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
  /**
   * Log out and Delete account: each resolves undefined when done (the page starts afresh), else
   * the line that says why not. Absent, the card offers neither.
   */
  readonly logOut?: () => Promise<string | undefined>;
  readonly forget?: () => Promise<string | undefined>;
}

export interface AccountStep {
  /** Shows the account; `justSignedIn` asks for a username when it has none. */
  open(justSignedIn: boolean): Promise<void>;
}

export function createAccountStep(host: AccountStepHost): AccountStep {
  let username: string | null = null;
  let typed = '';

  function signedIn(problem?: string): void {
    const { logOut, forget } = host;
    const actions =
      logOut === undefined || forget === undefined
        ? undefined
        : {
            logOut: async () => {
              const failed = await logOut();
              if (failed !== undefined) signedIn(failed);
            },
            deleteAccount: () => {
              askToDelete(host.show, true, forget, () => {
                signedIn();
              });
            },
            ...(problem === undefined ? {} : { problem }),
          };
    host.show(
      signedInCard(
        username,
        host.done,
        () => {
          choose();
        },
        actions,
      ),
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
