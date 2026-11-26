// Unblock from a blocked sender's challenge card (ADR 0086). Only a build with accounts can have
// blocked anyone, so only that build holds the friends route (check-bundle.ts): elsewhere a block
// never reaches the card, and this answers as accounts being off.
import { callApi, type ApiFailure, type ApiResult } from '../app/api.ts';
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';

export const unblockPair: (pair: string) => Promise<ApiResult<unknown>> = ACCOUNTS_BUILD
  ? (pair) => callApi<unknown>('POST', `friends/${pair}/unblock`, {})
  : () =>
      Promise.resolve({
        ok: false,
        kind: 'error',
        status: 404,
        code: 'accounts_off',
        message: 'Accounts are switched off',
      });

/** Unblocks `pair`, then reads the card again (`again`), or shows why not (`failed`). */
export async function unblockThen(
  pair: string,
  again: () => Promise<void>,
  failed: (answer: ApiFailure, retry: () => Promise<unknown>) => Promise<void>,
): Promise<void> {
  const done = await unblockPair(pair);
  await (done.ok ? again() : failed(done, again));
}
