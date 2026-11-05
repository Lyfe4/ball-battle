// The series being played in the browser: the series state plus the match on screen. Pure, so the
// frame loop's bookkeeping and the series' rules for the page are tested without a DOM: each match
// is recorded exactly once, however many frames show its finished world; picks nobody needs to be
// asked for are made in order; and the address bar never shows the bot's lineup early.
import { botPick, type LineupBot } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  setupWithPicks,
  startSeries,
  type Format,
  type NextMatch,
  type SeriesSetup,
  type SeriesState,
} from '../sim/series.ts';
import type { WorldState } from '../sim/types.ts';

export interface SeriesSession {
  readonly state: SeriesState;
  /** The match on screen. Undefined only once the series is decided and none is left. */
  readonly current: NextMatch | undefined;
  /** True once the match on screen has been recorded in `state`. */
  readonly recorded: boolean;
  /**
   * A replayed link's picks (both sides'), made in order as they come due; undefined for a series
   * played live. The route only replays a link `verifySeries` accepted, so each one is legal.
   */
  readonly replay: readonly string[] | undefined;
}

/** Starts a series: played live, or `fromLink`, replaying a link's picks. */
export function beginSession(setup: SeriesSetup, fromLink = false): SeriesSession {
  const state = startSeries(setup);
  const replay = fromLink ? (setup.picks ?? []) : undefined;
  return { state, current: nextMatch(state), recorded: false, replay };
}

/**
 * Records the match on screen once its world has finished. Returns the same session otherwise
 * (still running, or already recorded), so it is safe to call every frame.
 */
export function settleCurrent(session: SeriesSession, world: WorldState): SeriesSession {
  if (session.recorded || session.current === undefined) return session;
  if (world.match.status !== 'finished') return session;
  const state = recordOutcome(session.state, outcomeOf(world.match.result, world));
  return { ...session, state, recorded: true };
}

/**
 * Moves on to the next match (the next round, or a drawn round again) once one is recorded. While
 * a pick is due (loser picks next, ADR 0019) there is no current match until `pickInSession`.
 */
export function advanceSession(session: SeriesSession): SeriesSession {
  if (!session.recorded) return session;
  return { ...session, current: nextMatch(session.state), recorded: false };
}

/** Records the due pick and makes the match it decides the current one. */
export function pickInSession(session: SeriesSession, ball: string): SeriesSession {
  const state = recordPick(session.state, ball);
  return { ...session, state, current: nextMatch(state), recorded: false };
}

/** The replayed link's pick that is due now, if the link holds one. */
export function replayPickDue(session: SeriesSession): string | undefined {
  if (awaitingPick(session.state) === undefined) return undefined;
  return session.replay?.[session.state.picks.length];
}

/**
 * Makes every pick that doesn't need the player, in order: a replayed link's next pick, else the
 * bot's whenever side B is due. Stops when the player is due (with no link pick) or nothing is.
 */
export function resolvePicks(from: SeriesSession, bot: LineupBot): SeriesSession {
  let session = from;
  for (;;) {
    if (awaitingPick(session.state) === undefined) return session;
    const pick = replayPickDue(session) ?? botPick(bot, session.state);
    if (pick === undefined) return session;
    session = pickInSession(session, pick);
  }
}

/**
 * What the address bar may hold during a series (ADR 0017): the whole link (both lineups, the seed
 * and every pick) once the series is decided, or from the start when it is a replayed link; until
 * then only the format, so the bot's lineup is never given away.
 */
export function seriesAddress(
  session: SeriesSession,
): { readonly setup: SeriesSetup } | { readonly format: Format | undefined } {
  if (session.state.winner !== undefined) return { setup: setupWithPicks(session.state) };
  if (session.replay !== undefined) return { setup: session.state.setup };
  return { format: session.state.setup.format };
}

/**
 * A rematch: the same lineups and format on a new series seed, under today's rules. The bot keeps
 * the lineup it picked, so its opponent (with the seed it picked from) is kept as well.
 */
export function rematchOf(setup: SeriesSetup, seed: number): SeriesSetup {
  const { a, b, opponent, format } = setup;
  return {
    ruleset: RULESET_VERSION,
    seed,
    a,
    b,
    opponent,
    ...(format === undefined ? {} : { format }),
  };
}
