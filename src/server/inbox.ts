// The inbox (ADR 0079, PR (d)): one read an account's page makes every 30 s while it is visible
// and the account has friends: each accepted friend's status, how many requests wait, and live
// challenges friends sent it that still wait. A complete, idempotent read, so a Realtime "poke"
// can later replace the timer without changing it.
import type { InboxResponse } from '../api/friends.ts';
import { tokenFor } from './challenges.ts';
import { friendStatuses, invitesFor, waitingRequests } from './db/inbox.ts';
import type { Deps } from './http.ts';

export async function inboxOf(deps: Deps, userId: string): Promise<InboxResponse> {
  // One query at a time: the pooler never answers two pipelined on one connection.
  const friends = await friendStatuses(deps.sql, userId);
  const requests = await waitingRequests(deps.sql, userId);
  const rows = await invitesFor(deps.sql, userId);
  const invites = [];
  for (const row of rows) {
    invites.push({
      token: await tokenFor(deps.config, row.creator, row.requestId),
      from: row.from,
      format: row.format,
      bestOf: row.bestOf,
    });
  }
  return { friends, requests, invites };
}
