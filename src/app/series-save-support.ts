// Test support for saved series (series-save.test.ts and the reload flows): series against each
// bot, and every position the page can be at while playing one, reached with the same session
// functions the series controller calls.
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { botFor, DEFAULT_BOT } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { awaitingPick, remainingOf, type Format, type SeriesSetup } from '../sim/series.ts';
import { matchWorld, playToEnd } from '../sim/series-verify.ts';
import {
  advanceSession,
  beginSession,
  botOf,
  pickInSession,
  resolvePicks,
  settleCurrent,
  showBotBallNow,
  type SeriesSession,
} from './series-session.ts';

const ROSTER = [...BALL_LOOKUP.keys()];

/**
 * A series as the setup screens start one: the bot's lineup picked from the series seed. Five
 * balls in `a` make it a Best of 5 (ADR 0048).
 */
export function seriesAgainst(
  format: Format,
  bot: string,
  seed: number,
  a: readonly string[] = ['frost', 'thorns', 'sniper'],
): SeriesSetup {
  const bestOf = a.length === 5 ? 5 : 3;
  // Blind has no choices for a bot to make, so the setup screens always play it with the default.
  const level = format === 'blind' ? DEFAULT_BOT.id : bot;
  const opponent = { kind: 'bot', bot: level, lineupSeed: seed } as const;
  return {
    ruleset: RULESET_VERSION,
    seed,
    a,
    b: botFor(opponent).pickLineup(seed, ROSTER, bestOf),
    opponent,
    ...(format === 'blind' ? {} : { format }),
    ...(bestOf === 5 ? { bestOf } : {}),
  };
}

/**
 * A Blind series whose round 1 draws three times and goes to sudden death (found by search): the
 * player's Speedster against the bot's.
 */
export const SUDDEN_DEATH: SeriesSetup = seriesAgainst('blind', DEFAULT_BOT.id, 28534, [
  'speedster',
  'vampire',
  'archer',
]);

/**
 * Every position of a series on the page, in order: each match about to be fought, each result on
 * screen, each pick asked for. The player picks a different ball each turn (the one at the turn's
 * index, wrapping), so not every pick is the first ball left.
 */
export function pagePositions(setup: SeriesSetup, from?: SeriesSession): SeriesSession[] {
  const bot = botOf(setup);
  let session = from ?? resolvePicks(beginSession(setup), bot);
  const positions = [session];
  for (let guard = 0; guard < 40; guard += 1) {
    const { current, state } = session;
    if (current !== undefined && !session.recorded) {
      const end = playToEnd(matchWorld(current, BALL_LOOKUP), BALL_LOOKUP);
      session = showBotBallNow(settleCurrent(session, end), bot);
    } else if (session.recorded) {
      if (state.winner !== undefined) return positions;
      session = resolvePicks(advanceSession(session), bot);
    } else if (awaitingPick(state) === 'a') {
      const left = remainingOf(state, 'a');
      const ball = left[state.picks.length % left.length];
      if (ball === undefined) throw new Error('No ball left to pick');
      session = resolvePicks(pickInSession(session, ball), bot);
    } else {
      throw new Error('A position with no way on');
    }
    positions.push(session);
  }
  throw new Error('The series never ended');
}
