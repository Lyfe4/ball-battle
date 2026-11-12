// A series saved before a reload, put back exactly where it was (ADR 0042). What is saved is the
// series' setup with every pick made so far (the data `verifySeries` checks, ADR 0022), how many
// matches have been recorded and whether the last one's result is still on screen. Restoring it
// replays those matches headlessly through the same session functions the page used to play them,
// so the session it returns is the one the page had: the same round, picks, draws, sudden death
// and track, with the match on screen (if any) starting again from its Fight! moment.
//
// Nothing saved is trusted. A save is restored only when its picks lead, through the rules, to the
// position it names, and when the series it is part of is one `verifySeries` accepts: for a live
// series, the save's picks with the player's later choices filled in; for a replayed link, the
// link itself. Anything else (another ruleset, a tampered pick or lineup, a broken save) is
// refused, and the caller starts over.
import { botPick } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  setupWithPicks,
  type SeriesSetup,
  type SeriesState,
} from '../sim/series.ts';
import { matchWorld, playToEnd, verifySeries } from '../sim/series-verify.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import {
  advanceSession,
  beginSession,
  botOf,
  resolvePicks,
  settleCurrent,
  showBotBallNow,
  type SeriesSession,
} from './series-session.ts';

/** A series as it is saved: plain data, and nothing the setup alone doesn't decide. */
export interface SavedSeries {
  /** The setup with every pick made so far (`setupWithPicks`): what `verifySeries` checks. */
  readonly setup: SeriesSetup;
  /** Matches recorded so far, drawn plays included. */
  readonly plays: number;
  /** True while the last recorded match's result is on screen (between rounds, or the end). */
  readonly recorded: boolean;
  /** A replayed link (ADR 0017): all of its picks, so the replay carries on making them. */
  readonly link?: readonly string[];
}

/** What to save of a session: exactly enough to put it back with `restoreSeries`. */
export function savedOf(session: SeriesSession): SavedSeries {
  const { state, recorded, replay } = session;
  const plays = state.rounds.reduce((sum, round) => sum + round.outcomes.length, 0);
  return {
    setup: setupWithPicks({ ...state, setup: withoutPicks(state.setup) }),
    plays: plays + state.pending.length,
    recorded,
    ...(replay === undefined ? {} : { link: replay }),
  };
}

/** The setup without its picks: a live series' own setup, before any were made. */
function withoutPicks(setup: SeriesSetup): SeriesSetup {
  const { ruleset, seed, a, b, opponent, format, bestOf } = setup;
  return {
    ruleset,
    seed,
    a,
    b,
    opponent,
    ...(format === undefined ? {} : { format }),
    ...(bestOf === undefined ? {} : { bestOf }),
  };
}

/**
 * The session a save describes, or undefined when the save can't be trusted (see the top of this
 * file). Never throws.
 */
export function restoreSeries(
  saved: SavedSeries,
  definitions: DefinitionLookup,
): SeriesSession | undefined {
  try {
    return restore(saved, definitions);
  } catch {
    // A pick the rules refuse throws (`recordPick`): the save is broken or tampered with.
    return undefined;
  }
}

function restore(saved: SavedSeries, definitions: DefinitionLookup): SeriesSession | undefined {
  const { setup, plays, recorded, link } = saved;
  if (setup.ruleset !== RULESET_VERSION) return undefined;
  // Before the first match is recorded the session has always moved on to it.
  if (!Number.isInteger(plays) || plays < 0 || (plays === 0 && recorded)) return undefined;
  const picks = setup.picks ?? [];
  if (link !== undefined && !picks.every((pick, index) => link[index] === pick)) return undefined;
  // The link's own setup: a blind link has no picks at all.
  const whole =
    link === undefined
      ? undefined
      : link.length > 0
        ? { ...withoutPicks(setup), picks: link }
        : withoutPicks(setup);

  // A replayed link's state keeps the link's own setup, as `beginSession` made it; a live
  // series' keeps the setup it started with. The save's picks are made as they come due.
  const started = beginSession(whole ?? withoutPicks(setup), true);
  const bot = botOf(setup);
  let session: SeriesSession = resolvePicks({ ...started, replay: picks }, bot);
  for (let play = 1; play <= plays; play += 1) {
    const current = session.current;
    if (current === undefined) return undefined;
    const end = playToEnd(matchWorld(current, definitions), definitions);
    session = showBotBallNow(settleCurrent(session, end), bot);
    if (play < plays || !recorded) session = resolvePicks(advanceSession(session), bot);
  }
  // Every saved pick was made on the way, none is left over, and the position is the one named.
  if (session.state.picks.length !== picks.length || session.recorded !== recorded) {
    return undefined;
  }

  const series = whole ?? finishedLikeAPlayer(session.state, definitions);
  if (!verifySeries(series, definitions).ok) return undefined;
  return { ...session, replay: link };
}

/**
 * The whole series a live save is the start of: the saved picks, then the bot's picks and the
 * player's first ball left at every later turn. Any legal choices do, since `verifySeries` only
 * needs a whole series to check the saved part of it.
 */
function finishedLikeAPlayer(from: SeriesState, definitions: DefinitionLookup): SeriesSetup {
  const bot = botOf(from.setup);
  let state = from;
  for (;;) {
    const due = awaitingPick(state);
    if (due !== undefined) {
      const ball = due === 'a' ? remainingOf(state, 'a')[0] : botPick(bot, state);
      if (ball === undefined) throw new Error(`Side ${due} has no pick`);
      state = recordPick(state, ball);
      continue;
    }
    const match = nextMatch(state);
    if (match === undefined) return setupWithPicks(state);
    const end = playToEnd(matchWorld(match, definitions), definitions);
    if (end.match.status !== 'finished') throw new Error('A match ended without a result');
    state = recordOutcome(state, outcomeOf(end.match.result, end));
  }
}
