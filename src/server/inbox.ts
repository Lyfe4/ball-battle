// The inbox (ADR 0079, PR (d)): one read an account's page makes every 30 s while it is visible
// and the account has friends: each accepted friend's status, how many requests wait, challenges
// friends sent it that still wait, and its series by turns where it is its turn (ADR 0085). A
// complete, idempotent read, so a Realtime "poke" can replace the timer without changing it.
import type { InboxResponse } from '../api/friends.ts';
import { tokenFor } from './challenges.ts';
import type { EndingOutcome } from '../api/friends.ts';
import { friendStatuses, gamesFor, invitesFor, waitingRequests, type GameRow } from './db/inbox.ts';
import { settleExpired } from './db/series.ts';
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
      ...(row.friend === null ? {} : { friend: row.friend }),
      format: row.format,
      bestOf: row.bestOf,
      live: row.live,
      ...(row.stopsInMs === null ? {} : { stopsInMs: row.stopsInMs }),
    });
  }
  // A turn that ran out is the forfeit it is before it is listed (no sweep outside production).
  await settleExpired(deps.sql, undefined, userId);
  // Turns, games and unseen endings in one statement (ADR 0086).
  const series = await gamesFor(deps.sql, userId);
  const waiting = (row: GameRow) => ({
    seriesId: row.seriesId,
    opponent: row.opponent,
    deadline: (row.deadline ?? new Date(0)).toISOString(),
  });
  const turns = series.filter((row) => row.open && row.yours).map(waiting);
  const games = series.filter((row) => row.open && !row.yours).map(waiting);
  const endings = series
    .filter((row) => !row.open)
    .map((row) => ({ seriesId: row.seriesId, opponent: row.opponent, outcome: outcomeOf(row) }));
  return { friends, requests, invites, turns, games, endings };
}

/** How a series by turns ended for its player: by a turn that ran out when it was forfeit. */
export function outcomeOf(row: Pick<GameRow, 'status' | 'won'>): EndingOutcome {
  if (row.status === 'forfeit') return row.won ? 'won-ran-out' : 'lost-ran-out';
  return row.won ? 'won' : 'lost';
}
