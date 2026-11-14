// Replaying and verifying a whole series headlessly (ADR 0017, 0022): the one rule for whether a
// series setup is valid. A server runs it to verify a reported result, and the browser runs it
// before replaying a series link, so the two can't disagree about what a link means.
import { BOTS, botPick } from './bot.ts';
import { getDefinition } from './definitions.ts';
import { RULESET_VERSION } from './ruleset.ts';
import { decodeSeriesSetup } from './series-decode.ts';
import {
  awaitingPick,
  DEFAULT_BEST_OF,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  startSeries,
  type NextMatch,
  type SeriesSetup,
  type SeriesState,
} from './series.ts';
import { step } from './step.ts';
import type { DefinitionLookup, WorldState } from './types.ts';
import { createWorld } from './world.ts';

/** The opening world of a series match. */
export function matchWorld(match: NextMatch, definitions: DefinitionLookup): WorldState {
  return createWorld(match.seed, [
    getDefinition(definitions, match.a),
    getDefinition(definitions, match.b),
  ]);
}

/** Plays a match to its end, headlessly. Every match ends (ADR 0002), so this terminates. */
export function playToEnd(world: WorldState, definitions: DefinitionLookup): WorldState {
  let current = world;
  while (current.match.status === 'running') current = step(current, definitions).world;
  return current;
}

export type SeriesVerdict =
  | { readonly ok: true; readonly state: SeriesState }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): SeriesVerdict => ({ ok: false, reason });

/**
 * Plays the whole series and says whether its setup is one the rules allow. It takes anything
 * (a link, a save, a request body) and never throws. Valid means: a setup in form
 * (`decodeSeriesSetup`: known fields, format and opponent; a length the game plays, Best of 3 or
 * 5, ADR 0048; two lineups of that many different balls from the roster); played under today's
 * ruleset; for a bot opponent, the lineup that bot picks from its lineup seed and, at every pick it
 * was due, the pick it makes; every pick legal when it was made, none missing and none left over.
 * The roster is the lookup's ids in insertion order (the order the bot picks from), which
 * `indexDefinitions` keeps.
 */
export function verifySeries(raw: unknown, definitions: DefinitionLookup): SeriesVerdict {
  const roster = [...definitions.keys()];
  const decoded = decodeSeriesSetup(raw, roster);
  if (!decoded.ok) return fail(decoded.reason);
  const { setup } = decoded;
  if (setup.ruleset !== RULESET_VERSION) {
    return fail(`Played under ruleset ${String(setup.ruleset)}, not ${String(RULESET_VERSION)}`);
  }
  const bestOf = setup.bestOf ?? DEFAULT_BEST_OF;
  const { opponent } = setup;
  const bot = opponent.kind === 'bot' ? BOTS.get(opponent.bot) : undefined;
  // The decoder has made sure a bot opponent names a bot and a lineup seed.
  if (opponent.kind === 'bot' && bot !== undefined) {
    const picked = bot.pickLineup(opponent.lineupSeed, roster, bestOf);
    if (picked.some((id, index) => setup.b[index] !== id)) {
      return fail(`Side B is not the lineup the ${opponent.bot} bot picks`);
    }
  }

  let state = startSeries(setup);
  const picks = setup.picks ?? [];
  for (;;) {
    const due = awaitingPick(state);
    if (due !== undefined) {
      const pick = picks[state.picks.length];
      if (pick === undefined) return fail('The series needs a pick it was not given');
      if (due === 'b' && bot !== undefined && pick !== botPick(bot, state)) {
        return fail(`Pick ${state.picks.length + 1} is not the one the bot makes`);
      }
      if (!remainingOf(state, due).includes(pick)) {
        return fail(`"${pick}" is not a ball side ${due} has left`);
      }
      state = recordPick(state, pick);
      continue;
    }
    const match = nextMatch(state);
    if (match === undefined) break;
    const end = playToEnd(matchWorld(match, definitions), definitions);
    if (end.match.status !== 'finished') return fail('A match ended without a result');
    state = recordOutcome(state, outcomeOf(end.match.result, end));
  }
  if (picks.length > state.picks.length) return fail('The series was given picks it never used');
  return { ok: true, state };
}

/**
 * The whole series, played headlessly: `verifySeries` for callers that hold a setup they know is
 * valid (tests, measurement scripts). Throws with the reason when it isn't.
 */
export function playSeries(setup: SeriesSetup, definitions: DefinitionLookup): SeriesState {
  const verdict = verifySeries(setup, definitions);
  if (!verdict.ok) throw new Error(verdict.reason);
  return verdict.state;
}
