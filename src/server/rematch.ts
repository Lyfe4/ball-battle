// A rematch after a live friend match (ADR 0055): ask, answer, then each player's new lineup, and
// the new live match once both are in. Every move locks the old series' row, so two answers at
// once are decided one after the other on any host; what the clock decided (an ask or the lineups
// out of time) is read against the database's `now()` and never written. The new match is a new
// live series between the same two players, in the same format and length, with new seeds.
import {
  REMATCH_ANSWER_MS,
  REMATCH_LINEUP_MS,
  REMATCH_OFFER_MS,
  type RematchRequest,
  type RematchState,
  type RematchView,
} from '../api/rematch.ts';
import type { Side } from '../sim/index.ts';
import { checkLineup, checkNotLive } from './challenges.ts';
import type { TransactionSql } from './db.ts';
import { markPresent } from './db/live.ts';
import {
  agreeRematch,
  askRematch,
  declineRematch,
  rematchRow,
  setRematchLineup,
  startedRematch,
  type RematchRow,
} from './db/rematch.ts';
import { ApiError, type Deps } from './http.ts';
import { createSeries } from './series-service.ts';
import { other, sideOf } from './view.ts';

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
  const deadline = row.agreed + REMATCH_LINEUP_MS;
  return { state: row.now < deadline ? 'agreed' : 'expired', deadline };
}

/** A rematch may be asked: a live match that ended with a result (not void) in the last 2 min. */
function offerable(row: RematchRow): boolean {
  return (
    row.live &&
    (row.status === 'finished' || row.status === 'forfeit') &&
    row.players.a !== null &&
    row.players.b !== null &&
    row.finished !== null &&
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
    lineupIn: row.lineups[side] !== null,
    seriesId: state === 'started' ? row.newSeriesId : null,
    offered: state === 'none' && offerable(row),
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

/** GET: where the rematch stands, for either player. */
export async function rematchOf(
  deps: Deps,
  seriesId: string,
  userId: string,
): Promise<RematchView> {
  const { row, side } = playerOf(await rematchRow(deps.sql, seriesId), userId);
  return viewOfRematch(row, side);
}

/** POST: ask, answer, or hand in the new lineup. Retries and double taps change nothing more. */
export async function moveRematch(
  deps: Deps,
  seriesId: string,
  userId: string,
  request: RematchRequest,
): Promise<RematchView> {
  return deps.sql.begin(async (db) => {
    const { row: before, side } = playerOf(await rematchRow(db, seriesId, true), userId);
    const { state } = rematchStateOf(before);
    if ('answer' in request) {
      if (request.answer === 'yes') {
        if (state === 'none' && offerable(before)) await askRematch(db, seriesId, side);
        else if (state === 'asked' && before.askedBy !== side) {
          // A player in another live match or lobby is told now, not after building a lineup.
          await checkNotLive(db, userId);
          await agreeRematch(db, seriesId);
        } else if (state !== 'asked' && state !== 'agreed' && state !== 'started') throw closed();
      } else if (state === 'asked') await declineRematch(db, seriesId, side);
      else if (state !== 'declined') throw closed();
    } else {
      if (state === 'started') return viewOfRematch(before, side);
      if (state !== 'agreed') throw closed();
      await checkLineup(request.lineup, before.bestOf);
      await setRematchLineup(db, seriesId, side, request.lineup);
      const theirs = before.lineups[other(side)];
      if (theirs !== null) await start(db, deps, seriesId, before, side, request.lineup, theirs);
    }
    return viewOfRematch(playerOf(await rematchRow(db, seriesId), userId).row, side);
  });
}

/** Both lineups are in: the new live match, the player who handed in last already here. */
async function start(
  db: TransactionSql,
  deps: Deps,
  seriesId: string,
  row: RematchRow,
  side: Side,
  lineup: readonly string[],
  theirs: readonly string[],
): Promise<void> {
  const { a, b } = row.players;
  if (a === null || b === null) throw closed();
  // One live match per player (ADR 0053), each locked in a fixed order so two hosts never wait
  // on each other.
  for (const player of [a, b].sort()) await checkNotLive(db, player);
  const lineups = side === 'a' ? { a: lineup, b: theirs } : { a: theirs, b: lineup };
  const id = await createSeries(db, deps.config, {
    format: row.format,
    bestOf: row.bestOf,
    players: { a, b },
    lineups,
    live: true,
  });
  if (side === 'a') await markPresent(db, id, 'a');
  await startedRematch(db, seriesId, id);
}
