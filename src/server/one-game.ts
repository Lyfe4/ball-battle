// One game at a time (ADR 0053's `in_a_match`, ADR 0089 addendum of 2026-11-27). A player picking
// lineups (a live start, ADR 0080) or in a live match starts nothing else: every challenge they
// send and every other one they accept is refused, live or by turns, whatever their page shows.
// Two players have one thing between them at a time: a friend's challenge still waiting is
// answered, not crossed with a second one, and a series by turns together is finished before
// another by turns (a live match beside it is fine: it lasts minutes, the other days).
import type { Config } from './config.ts';
import type { TransactionSql } from './db.ts';
import { betweenOf, lockPlayer } from './db/challenges.ts';
import { liveNowOf } from './db/live.ts';
import { ApiError } from './http.ts';
import { settleStartIn } from './start-settle.ts';

/**
 * Refuses a player who already has a live match, a lineup being picked or (unless `lobbyAside`) a
 * lobby waiting (one at a time). A lineup whose clock ran out is made into its series first: it may
 * have just ended. `lobbyAside`: the player's own lobby doesn't count (a challenge being sent calls
 * it off; an accept by turns leaves it waiting).
 */
export async function checkNotLive(
  db: TransactionSql,
  config: Config,
  player: string,
  lobbyAside = false,
): Promise<void> {
  await lockPlayer(db, player);
  let now = await liveNowOf(db, player);
  if (now?.kind === 'start' && (await settleStartIn(db, config, now.id))) {
    now = await liveNowOf(db, player);
  }
  if (now !== undefined && !(lobbyAside && now.kind === 'lobby')) {
    const where =
      now.kind === 'series'
        ? 'You are in a match already'
        : now.kind === 'start'
          ? 'You are choosing a lineup already'
          : 'Your lobby is waiting';
    throw new ApiError(409, 'in_a_match', `${where}: finish it first`);
  }
}

/**
 * Refuses a new challenge from `player` to `other` (`turns`: by turns) while one already stands
 * between them: `other`'s challenge to `player` still waiting (a live lobby for a live send is a
 * crossed accept, handled before this), or, by turns, their open series by turns. `accepting`:
 * `player` is accepting `other`'s challenge, which is the one waiting. Both players' locks are
 * held by the caller.
 */
export async function checkBetween(
  db: TransactionSql,
  player: string,
  other: string,
  turns: boolean,
  accepting = false,
): Promise<void> {
  const between = await betweenOf(db, player, other);
  if (between.theirs && !accepting) {
    throw new ApiError(
      409,
      'their_challenge_waiting',
      'They challenged you already: answer theirs',
    );
  }
  if (turns && between.turns) {
    throw new ApiError(
      409,
      'playing_together',
      'You have a game by turns together: finish it first',
    );
  }
}
