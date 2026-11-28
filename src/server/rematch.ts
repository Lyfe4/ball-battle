// A rematch after a live friend match (ADR 0055): ask, answer, and once both say yes, the lineups
// picked together (a start, ADR 0080), whose clock makes the new match. Every move locks the old
// series' row, so two answers at once are decided one after the other on any host; an ask out of
// time is read against the database's `now()` and never written. The new match is a new live
// series between the same two players, in the same format and length, with new seeds.
// A rematch asked is a live invitation like a challenge to a friend (ADR 0089 addendum of
// 2026-11-28): one per pair, one out per player. Every move takes both players' locks first, in
// one order, then the series row, as a challenge sent or accepted does, so the two never cross.
import {
  REMATCH_ANSWER_MS,
  REMATCH_OFFER_MS,
  type RematchRequest,
  type RematchState,
  type RematchView,
} from '../api/rematch.ts';
import type { Side } from '../sim/index.ts';
import type { Config } from './config.ts';
import type { TransactionSql } from './db.ts';
import { lobbyWaitingFor, lockPlayers, supersedeOutgoing } from './db/challenges.ts';
import { checkNotLive } from './one-game.ts';
import {
  agreeRematch,
  askRematch,
  declineRematch,
  rematchRow,
  seriesPlayers,
  withdrawRematchAsks,
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
    // Both players first (a series' players never change), then the series row: the order a
    // challenge between them takes too, so a send and a rematch at once wait in turn.
    await lockPlayers(db, (await seriesPlayers(db, seriesId)) ?? []);
    const { row: before, side } = playerOf(await rematchRow(db, seriesId, true), userId);
    const { state } = rematchStateOf(before);
    const { a, b } = before.players;
    const other = side === 'a' ? b : a;
    if (answer === 'yes') {
      if (state === 'none' && offerable(before)) {
        // Their live challenge already waits for this player: one invitation per pair, so theirs
        // is answered (its banner is on this screen), not crossed with a rematch.
        if (other !== null && (await lobbyWaitingFor(db, other, userId)) !== undefined) {
          throw new ApiError(
            409,
            'their_challenge_waiting',
            'They challenged you already: answer theirs',
          );
        }
        // One live invitation out at a time: this player's waiting live challenge stops.
        await supersedeOutgoing(db, userId, undefined, true);
        await askRematch(db, seriesId, side);
      } else if (state === 'asked' && before.askedBy !== side) {
        await acceptRematchIn(db, deps.config, seriesId, before, userId);
      } else if (state !== 'asked' && state !== 'agreed' && state !== 'started') throw closed();
    } else if (state === 'asked') await declineRematch(db, seriesId, side);
    else if (state !== 'declined') throw closed();
    return viewOfRematch(playerOf(await rematchRow(db, seriesId), userId).row, side);
  });
}

/**
 * `agreer` says yes to the rematch asked of them on `seriesId` (`row`, read under its lock with
 * both players' locks held): their own live invitations still out stop (a challenge, another
 * rematch asked), both players are then in this match (one at a time, ADR 0053) and the lineups
 * start at once. Answers the start's id. Also a live challenge sent to the player who asked
 * (`createChallenge`): both want to play, so it is this yes, on the rematch's rules.
 */
export async function acceptRematchIn(
  db: TransactionSql,
  config: Config,
  seriesId: string,
  row: RematchRow,
  agreer: string,
): Promise<string> {
  const { a, b } = row.players;
  if (a === null || b === null) throw closed();
  await supersedeOutgoing(db, agreer, undefined, true);
  await withdrawRematchAsks(db, agreer, seriesId);
  for (const player of [a, b].sort()) await checkNotLive(db, config, player);
  await agreeRematch(db, seriesId);
  return openStart(db, {
    players: { a, b },
    format: row.format,
    bestOf: row.bestOf,
    rematchOf: seriesId,
  });
}
