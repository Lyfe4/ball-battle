// A rematch after a live friend match (ADR 0055): ask, answer, and once both say yes, the lineups
// picked together (a start, ADR 0080), whose clock makes the new match. Every move locks the old
// series' row, so two answers at once are decided one after the other on any host; an ask out of
// time is read against the database's `now()` and never written. The new match is a new live
// series between the same two players, in the same format and length, with new seeds.
import {
  REMATCH_ANSWER_MS,
  REMATCH_OFFER_MS,
  type RematchRequest,
  type RematchState,
  type RematchView,
} from '../api/rematch.ts';
import type { Side } from '../sim/index.ts';
import { checkNotLive } from './challenges.ts';
import {
  agreeRematch,
  askRematch,
  declineRematch,
  rematchRow,
  type RematchRow,
} from './db/rematch.ts';
import { ApiError, type Deps } from './http.ts';
import { openStart } from './start.ts';
import { settleStart } from './start-settle.ts';
import { sideOf } from './view.ts';

/** Where a rematch stands at the row's `now`, and when its current wait ends. */
export function rematchStateOf(row: RematchRow): {
  readonly state: RematchState;
  readonly deadline: number | null;
} {
  if (row.askedBy === null || row.asked === null) return { state: 'none', deadline: null };
  if (row.newSeriesId !== null) return { state: 'started', deadline: null };
  if (row.declinedBy !== null) return { state: 'declined', deadline: null };
  if (row.agreed === null) {
    const deadline = row.asked + REMATCH_ANSWER_MS;
    return { state: row.now < deadline ? 'asked' : 'expired', deadline };
  }
  // Both said yes: the lineups' clock (its expiry makes the match). A yes from before lineups were
  // picked together (ADR 0080) has no start and can't move on: it ended.
  if (row.start === null) return { state: 'expired', deadline: null };
  return { state: 'agreed', deadline: row.start.deadline };
}

/**
 * A rematch may be asked: a live match that ended with a result (not void) in the last 2 min, from
 * the end both players watched (never while its last fight still plays).
 */
function offerable(row: RematchRow): boolean {
  return (
    row.live &&
    (row.status === 'finished' || row.status === 'forfeit') &&
    row.players.a !== null &&
    row.players.b !== null &&
    row.finished !== null &&
    row.now >= row.finished &&
    row.now - row.finished < REMATCH_OFFER_MS
  );
}

function viewOfRematch(row: RematchRow, side: Side): RematchView {
  const { state, deadline } = rematchStateOf(row);
  return {
    state,
    askedBy: row.askedBy,
    declinedBy: row.declinedBy,
    deadline,
    now: row.now,
    lineupIn: row.start?.locked[side] ?? false,
    seriesId: state === 'started' ? row.newSeriesId : null,
    offered: state === 'none' && offerable(row),
    startId: row.start?.id ?? null,
  };
}

/** The series as one of its players sees it, or a 404 for anyone else. */
function playerOf(
  row: RematchRow | undefined,
  userId: string,
): { readonly row: RematchRow; readonly side: Side } {
  const side = row === undefined ? undefined : sideOf(row.players, userId);
  if (row === undefined || side === undefined) {
    throw new ApiError(404, 'not_found', 'No such series');
  }
  return { row, side };
}

const closed = () => new ApiError(409, 'rematch_closed', 'This rematch is over');

/** GET: where the rematch stands, for either player; lineups out of time make the match first. */
export async function rematchOf(
  deps: Deps,
  seriesId: string,
  userId: string,
): Promise<RematchView> {
  const { row, side } = playerOf(await rematchRow(deps.sql, seriesId), userId);
  if (row.start === null || row.newSeriesId !== null) return viewOfRematch(row, side);
  await settleStart(deps.sql, deps.config, row.start.id);
  return viewOfRematch(playerOf(await rematchRow(deps.sql, seriesId), userId).row, side);
}

/**
 * POST: ask or answer; the lineups are then picked on the start (ADR 0080). Retries and double taps
 * change nothing more.
 */
export async function moveRematch(
  deps: Deps,
  seriesId: string,
  userId: string,
  request: RematchRequest,
): Promise<RematchView> {
  const answer = request.answer;
  return deps.sql.begin(async (db) => {
    const { row: before, side } = playerOf(await rematchRow(db, seriesId, true), userId);
    const { state } = rematchStateOf(before);
    const { a, b } = before.players;
    if (answer === 'yes') {
      if (state === 'none' && offerable(before)) await askRematch(db, seriesId, side);
      else if (state === 'asked' && before.askedBy !== side && a !== null && b !== null) {
        // Both players are in this match from the yes (one at a time, ADR 0053), each locked in a
        // fixed order so two hosts never wait on each other; the lineups start at once.
        for (const player of [a, b].sort()) await checkNotLive(db, deps.config, player);
        await agreeRematch(db, seriesId);
        await openStart(db, {
          players: { a, b },
          format: before.format,
          bestOf: before.bestOf,
          rematchOf: seriesId,
        });
      } else if (state !== 'asked' && state !== 'agreed' && state !== 'started') throw closed();
    } else if (state === 'asked') await declineRematch(db, seriesId, side);
    else if (state !== 'declined') throw closed();
    return viewOfRematch(playerOf(await rematchRow(db, seriesId), userId).row, side);
  });
}
