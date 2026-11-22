// "Switch to it?" (ADR 0079): a guest signed in to an account that already exists. Switching
// deletes the guest and keeps the account; Stay keeps the guest and drops the sign-in.
import type { SignInResponse } from '../api/accounts.ts';
import type { ApiFailure, ApiResult } from '../app/api.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import { switchCard } from './sign-in-text.ts';

export interface SwitchHost {
  readonly api: <T>(
    method: 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ) => Promise<ApiResult<T | undefined>>;
  readonly show: (content: NoticeContent) => void;
  /** Signed in to the account. */
  readonly done: () => void;
  /** Back to the ways in, with a line saying why. */
  readonly choose: (problem: string) => void;
  readonly failed: (
    answer: ApiFailure,
    retry: () => Promise<unknown>,
    line: (text: string) => void,
  ) => void;
  readonly back: () => void;
}

export function offerSwitch(host: SwitchHost, via: 'email' | 'google'): void {
  const switchTo = async (): Promise<void> => {
    const answer = await host.api<SignInResponse>('POST', 'auth/switch', {});
    if (answer.ok) host.done();
    else if (answer.kind === 'error' && answer.code === 'sign_in_expired')
      host.choose(answer.message);
    else host.failed(answer, switchTo, host.choose);
  };
  const stay = async (): Promise<void> => {
    await host.api('DELETE', 'auth/switch');
    host.back();
  };
  host.show(switchCard(via, switchTo, stay));
}
