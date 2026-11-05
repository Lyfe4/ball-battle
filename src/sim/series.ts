// A best-of-3 series (ADR 0017, docs/vision.md): two lineups of three different balls, first to two
// round wins. Draft formats (ADR 0019) decide how the order is set: blind, reveal-then-order, or
// loser-picks-next, where the loser of a round picks its next ball after seeing the winner's. Pure
// and deterministic like the rest of the sim, so a server can replay a series from its setup (seed,
// lineups, format and picks) to verify a reported result.
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

/**
 * How the order of each lineup is decided (ADR 0019):
 * - `blind`: each side sets its order without seeing the other's lineup (ADR 0017).
 * - `reveal`: both lineups are revealed, then each side secretly sets its order. The series then
 *   plays exactly like a blind one; only how the order was chosen differs.
 * - `loser`: each side sets an order blind; after a round, the loser picks its next ball from what
 *   it has left, having seen the winner's next ball, while the winner keeps its order.
 */
export type Format = 'blind' | 'reveal' | 'loser';
export const FORMATS: readonly Format[] = ['blind', 'reveal', 'loser'];

/** Everything that decides a series: replaying it needs nothing else. */
export interface SeriesSetup {
  readonly seed: number;
  /** The player's lineup (slot A in every round), in the order set before round 1. */
  readonly a: Lineup;
  /** The opponent's lineup (slot B). */
  readonly b: Lineup;
  /** Undefined is `blind`, the format every series had before ADR 0019. */
  readonly format?: Format;
  /** `loser` only: each pick made between rounds, in order. A replay takes them from here. */
  readonly picks?: readonly string[];
}

/** A pick made in a `loser` series: `side` chose `ball` to play round `round` (0-based). */
export interface PickRecord {
  readonly round: number;
  readonly side: Side;
  readonly ball: string;
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
  /** Picks made so far (`loser` series only). */
  readonly picks: readonly PickRecord[];
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
  return { setup, rounds: [], pending: [], winner: undefined, picks: [] };
}

export const formatOf = (setup: SeriesSetup): Format => setup.format ?? 'blind';

export const otherSide = (side: Side): Side => (side === 'a' ? 'b' : 'a');

/** A side's balls not yet played in a finished round, in the order it set. */
export function remainingOf(state: SeriesState, side: Side): readonly string[] {
  const played = new Set(state.rounds.map((round) => round[side]));
  return state.setup[side].filter((id) => !played.has(id));
}

/** The ball a side plays in the coming round: its pick for that round, else its next in order. */
export function nextBallOf(state: SeriesState, side: Side): string | undefined {
  const round = state.rounds.length;
  const pick = state.picks.find((p) => p.round === round && p.side === side);
  return pick?.ball ?? remainingOf(state, side)[0];
}

/**
 * The side that must pick its next ball before the next round, if any: in a `loser` series, the
 * loser of the last round, while it still has a choice (two or more balls left) and hasn't picked.
 */
export function awaitingPick(state: SeriesState): Side | undefined {
  if (formatOf(state.setup) !== 'loser' || state.winner !== undefined) return undefined;
  if (state.pending.length > 0) return undefined;
  const last = state.rounds.at(-1);
  if (last === undefined) return undefined;
  const loser = otherSide(last.winner);
  const round = state.rounds.length;
  if (state.picks.some((p) => p.round === round && p.side === loser)) return undefined;
  return remainingOf(state, loser).length >= 2 ? loser : undefined;
}

/** Records the due pick. Throws when no pick is due or the ball isn't one the side has left. */
export function recordPick(state: SeriesState, ball: string): SeriesState {
  const side = awaitingPick(state);
  if (side === undefined) throw new Error('No pick is due');
  if (!remainingOf(state, side).includes(ball)) {
    throw new Error(`"${ball}" is not a ball side ${side} has left`);
  }
  return { ...state, picks: [...state.picks, { round: state.rounds.length, side, ball }] };
}

/** The setup with every pick so far: what a link stores to replay the series. */
export function setupWithPicks(state: SeriesState): SeriesSetup {
  if (formatOf(state.setup) !== 'loser') return state.setup;
  return { ...state.setup, picks: state.picks.map((pick) => pick.ball) };
}

/** Round wins so far for each side. */
export function scoreOf(state: SeriesState): Readonly<Record<Side, number>> {
  const wins = (side: Side) => state.rounds.filter((round) => round.winner === side).length;
  return { a: wins('a'), b: wins('b') };
}

/** The next match to play, or undefined once the series is decided or while a pick is due. */
export function nextMatch(state: SeriesState): NextMatch | undefined {
  if (state.winner !== undefined || awaitingPick(state) !== undefined) return undefined;
  const round = state.rounds.length;
  const a = nextBallOf(state, 'a');
  const b = nextBallOf(state, 'b');
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
  if (match === undefined) {
    throw new Error(
      awaitingPick(state) === undefined
        ? 'The series is already decided'
        : 'A pick is due before the next round',
    );
  }
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
 * plays the same matches one at a time through `nextMatch`, `recordOutcome` and `recordPick`, so
 * both agree. Picks come from `setup.picks` in order; a missing or unused pick throws.
 */
export function playSeries(setup: SeriesSetup, definitions: DefinitionLookup): SeriesState {
  let state = startSeries(setup);
  const picks = setup.picks ?? [];
  for (;;) {
    if (awaitingPick(state) !== undefined) {
      const pick = picks[state.picks.length];
      if (pick === undefined) throw new Error('The series needs a pick it was not given');
      state = recordPick(state, pick);
      continue;
    }
    const match = nextMatch(state);
    if (match === undefined) break;
    const end = playToEnd(matchWorld(match, definitions), definitions);
    if (end.match.status !== 'finished') throw new Error('A match ended without a result');
    state = recordOutcome(state, outcomeOf(end.match.result, end));
  }
  if (picks.length > state.picks.length) {
    throw new Error('The series was given picks it never used');
  }
  return state;
}
