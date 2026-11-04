// A best-of-3 series (ADR 0017, docs/vision.md): two lineups of three different balls, played in
// order, first to two round wins. Pure and deterministic like the rest of the sim, so a server can
// replay a series from its seed and lineups to verify a reported result.
import { getDefinition } from './definitions.ts';
import { deriveSeed, nextFloat } from './rng.ts';
import { step } from './step.ts';
import type { DefinitionLookup, MatchResult, WorldState } from './types.ts';
import { createWorld } from './world.ts';

/** Balls per lineup, and so the most rounds a series can take. */
export const LINEUP_SIZE = 3;
/** Round wins that take the series. */
export const WINS_NEEDED = 2;
/** Plays of a round before a draw is settled by sudden death (docs/vision.md, mirror draws). */
export const MAX_ATTEMPTS = 3;

/** Salts, so a round seed, an attempt seed and a coin flip never share a stream. */
const ROUND_SALT = 0x5e7105;
const ATTEMPT_SALT = 0xa77e3b7;
const SUDDEN_DEATH_SALT = 0x5dde47;

export type Side = 'a' | 'b';
export type Lineup = readonly [string, string, string];

/** Everything that decides a series: replaying it needs nothing else. */
export interface SeriesSetup {
  readonly seed: number;
  /** The player's lineup (slot A in every round). */
  readonly a: Lineup;
  /** The opponent's lineup (slot B). */
  readonly b: Lineup;
}

/** How one play of a round ended. */
export type Outcome = Side | 'draw';

export interface RoundRecord {
  /** 0-based. */
  readonly round: number;
  readonly a: string;
  readonly b: string;
  /** The seed each play used, in order; more than one only after draws. */
  readonly seeds: readonly number[];
  readonly outcomes: readonly Outcome[];
  readonly winner: Side;
  /** True when every attempt drew and a seeded coin flip decided the round. */
  readonly suddenDeath: boolean;
}

export interface SeriesState {
  readonly setup: SeriesSetup;
  /** Finished rounds, in order. */
  readonly rounds: readonly RoundRecord[];
  /** Outcomes so far of the round in progress (only draws, since a win ends it). */
  readonly pending: readonly Outcome[];
  /** Set once a side has WINS_NEEDED round wins. */
  readonly winner: Side | undefined;
}

/** The next match to play: which balls, which seed, and where it sits in the series. */
export interface NextMatch {
  readonly round: number;
  /** 0-based; above 0 only when replaying a drawn round. */
  readonly attempt: number;
  readonly seed: number;
  readonly a: string;
  readonly b: string;
}

/** True for three different ids, all in `validIds`. */
export function isValidLineup(ids: readonly string[], validIds: readonly string[]): ids is Lineup {
  return (
    ids.length === LINEUP_SIZE &&
    new Set(ids).size === LINEUP_SIZE &&
    ids.every((id) => validIds.includes(id))
  );
}

/** The seed of round `round` (0-based) of a series. 32-bit integer maths only, exact everywhere. */
export function roundSeed(seriesSeed: number, round: number): number {
  return deriveSeed([seriesSeed, ROUND_SALT, round]);
}

/** The seed of play `attempt` (0-based) of a round: the round seed first, then derived ones. */
export function attemptSeed(seedOfRound: number, attempt: number): number {
  return attempt === 0 ? seedOfRound : deriveSeed([seedOfRound, ATTEMPT_SALT, attempt]);
}

/** Who wins a round that drew MAX_ATTEMPTS times: a coin flip seeded from the round seed. */
export function suddenDeathWinner(seedOfRound: number): Side {
  return nextFloat(deriveSeed([seedOfRound, SUDDEN_DEATH_SALT])).value < 0.5 ? 'a' : 'b';
}

export function startSeries(setup: SeriesSetup): SeriesState {
  return { setup, rounds: [], pending: [], winner: undefined };
}

/** Round wins so far for each side. */
export function scoreOf(state: SeriesState): Readonly<Record<Side, number>> {
  const wins = (side: Side) => state.rounds.filter((round) => round.winner === side).length;
  return { a: wins('a'), b: wins('b') };
}

/** The next match to play, or undefined once the series is decided. */
export function nextMatch(state: SeriesState): NextMatch | undefined {
  if (state.winner !== undefined) return undefined;
  const round = state.rounds.length;
  const a = state.setup.a[round];
  const b = state.setup.b[round];
  if (a === undefined || b === undefined) return undefined;
  const attempt = state.pending.length;
  return { round, attempt, seed: attemptSeed(roundSeed(state.setup.seed, round), attempt), a, b };
}

/**
 * Records how the next match ended. A win ends the round; a draw replays it with the next attempt
 * seed, and the MAX_ATTEMPTS-th draw goes to sudden death. The series ends as soon as a side has
 * WINS_NEEDED rounds, so a 2-0 never plays round 3. Throws once the series is decided.
 */
export function recordOutcome(state: SeriesState, outcome: Outcome): SeriesState {
  const match = nextMatch(state);
  if (match === undefined) throw new Error('The series is already decided');
  const outcomes = [...state.pending, outcome];
  if (outcome === 'draw' && outcomes.length < MAX_ATTEMPTS) {
    return { ...state, pending: outcomes };
  }
  const seedOfRound = roundSeed(state.setup.seed, match.round);
  const suddenDeath = outcome === 'draw';
  const record: RoundRecord = {
    round: match.round,
    a: match.a,
    b: match.b,
    seeds: outcomes.map((_, attempt) => attemptSeed(seedOfRound, attempt)),
    outcomes,
    winner: suddenDeath ? suddenDeathWinner(seedOfRound) : outcome,
    suddenDeath,
  };
  const next: SeriesState = { ...state, rounds: [...state.rounds, record], pending: [] };
  const score = scoreOf(next);
  const winner = score.a >= WINS_NEEDED ? 'a' : score.b >= WINS_NEEDED ? 'b' : undefined;
  return { ...next, winner };
}

/** Which side a finished match's result favours: slot A is ball-0, slot B is ball-1. */
export function outcomeOf(result: MatchResult, world: WorldState): Outcome {
  if (result.kind === 'draw') return 'draw';
  return result.winnerId === world.balls[0]?.id ? 'a' : 'b';
}

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

/**
 * The whole series, played headlessly: what a server would run to verify a result. The browser
 * plays the same matches one at a time through `nextMatch` and `recordOutcome`, so both agree.
 */
export function playSeries(setup: SeriesSetup, definitions: DefinitionLookup): SeriesState {
  let state = startSeries(setup);
  for (let match = nextMatch(state); match !== undefined; match = nextMatch(state)) {
    const end = playToEnd(matchWorld(match, definitions), definitions);
    if (end.match.status !== 'finished') throw new Error('A match ended without a result');
    state = recordOutcome(state, outcomeOf(end.match.result, end));
  }
  return state;
}
