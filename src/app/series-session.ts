// The series being played in the browser: the series state plus the match on screen. Pure, so the
// frame loop's bookkeeping is tested without a DOM: each match is recorded exactly once, however
// many frames show its finished world.
import {
  nextMatch,
  outcomeOf,
  recordOutcome,
  startSeries,
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
}

export function beginSession(setup: SeriesSetup): SeriesSession {
  const state = startSeries(setup);
  return { state, current: nextMatch(state), recorded: false };
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

/** Moves on to the next match (the next round, or a drawn round again) once one is recorded. */
export function advanceSession(session: SeriesSession): SeriesSession {
  if (!session.recorded) return session;
  return { state: session.state, current: nextMatch(session.state), recorded: false };
}
