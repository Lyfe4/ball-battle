// The sim's one public API (ADR 0051, 0052): what a server imports, and what each frozen ruleset
// bundle (`rulesets/`) exposes. Everything here that needs ball definitions is bound to this
// build's own roster, so a caller can't mix one ruleset's balls with another's rules, and the bot
// (which picks by index into the roster's order) can't be handed a different roster. Code beside
// the sim that a server shares (`src/api`, `src/server`) imports only this file (ESLint).
import { BALL_LOOKUP } from './balls/index.ts';
import { getDefinition } from './definitions.ts';
import {
  matchWorld as matchWorldWith,
  playSeries as playSeriesWith,
  playToEnd as playToEndWith,
  verifySeries as verifySeriesWith,
  type SeriesVerdict,
} from './series-verify.ts';
import type { NextMatch, SeriesSetup, SeriesState } from './series.ts';
import { step as stepWith } from './step.ts';
import type { StepResult, WorldState } from './types.ts';
import { createWorld as createWorldWith } from './world.ts';

export { RULESET_VERSION } from './ruleset.ts';
export { BOT_LEVELS, BOTS, botFor, botPick, botViewOf } from './bot.ts';
export type { BotRole, BotView, LineupBot } from './bot.ts';
export { decodeSeriesSetup, parseSeriesSetup } from './series-decode.ts';
export type { DecodedSetup } from './series-decode.ts';
export {
  awaitingPick,
  BEST_OF,
  bestOfOf,
  DEFAULT_BEST_OF,
  FORMATS,
  formatOf,
  nextBallOf,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  revealTurnsOf,
  scoreOf,
  setupWithPicks,
  showdownTurnsOf,
  startSeries,
  winsNeededOf,
} from './series.ts';
export type {
  BestOf,
  Format,
  Lineup,
  NextMatch,
  Opponent,
  Outcome,
  PickRecord,
  RoundRecord,
  SeriesSetup,
  SeriesState,
  Side,
} from './series.ts';
export type { SeriesVerdict, StepResult, WorldState };
export type { SimEvent } from './types.ts';
export type { SeriesSeeds } from './series-seeds.ts';

/** Every ball id, in the order the bot picks from. */
export const ROSTER: readonly string[] = [...BALL_LOOKUP.keys()];

/** The opening world of a match between two balls, by id. Throws on an id not in the roster. */
export const createWorld = (seed: number, a: string, b: string): WorldState =>
  createWorldWith(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);

/** One tick (ADR 0001): the next world and what happened in it. */
export const step = (world: WorldState): StepResult => stepWith(world, BALL_LOOKUP);

/** Plays a match to its end, headlessly. */
export const playToEnd = (world: WorldState): WorldState => playToEndWith(world, BALL_LOOKUP);

/** The opening world of a series match. */
export const matchWorld = (match: NextMatch): WorldState => matchWorldWith(match, BALL_LOOKUP);

/** Whether a series setup (from anywhere: a link, a save, a request body) is valid; never throws. */
export const verifySeries = (raw: unknown): SeriesVerdict => verifySeriesWith(raw, BALL_LOOKUP);

/** The whole series of a setup known to be valid. Throws with the reason when it isn't. */
export const playSeries = (setup: SeriesSetup): SeriesState => playSeriesWith(setup, BALL_LOOKUP);
