// A live challenge sent to a friend (ADR 0079, PR (d)): an ordinary live link that also names who
// it is for, so it reaches their inbox while the sender's lobby waits. The link still works for
// anyone it is shared with; the friend may also say No thanks, which the lobby shows.
import type { Config } from './config.ts';
import type { TransactionSql } from './db.ts';
import { friendOf } from './db/inbox.ts';
import { hashOf } from './challenges.ts';
import { ApiError, type Deps } from './http.ts';

/**
 * The account a challenge from `creator` is for: their accepted friend by friendship `id`. Only an
 * account, only with accounts on, only a friend.
 */
export async function inviteeOf(
  db: TransactionSql,
  config: Config,
  creator: { readonly userId: string; readonly account: boolean },
  id: string,
): Promise<string> {
  if (!config.accounts) throw new ApiError(404, 'accounts_off', 'Accounts are switched off');
  if (!creator.account) throw new ApiError(403, 'not_an_account', 'Sign in to challenge friends');
  const friend = await friendOf(db, creator.userId, id);
  if (friend === undefined) throw new ApiError(404, 'not_found', 'That friend is gone');
  return friend;
}

/**
 * The friend a challenge was sent to says No thanks: it leaves their inbox and the sender's lobby
 * says so. Anyone else, or a link no longer waiting: nothing to say no to.
 */
export async function declineInvite(deps: Deps, token: string, userId: string): Promise<void> {
  const rows = await deps.sql`
    update game.challenges set invitee_declined_at = coalesce(invitee_declined_at, now())
    where token_hash = ${await hashOf(token)} and invitee = ${userId} and series_id is null
      and start_id is null
    returning 1`;
  if (rows.length === 0) throw new ApiError(404, 'not_found', 'No such challenge');
}
