// A best-of-3 series (ADR 0017, docs/vision.md): two lineups of three different balls, first to two
// round wins. Draft formats (ADR 0019, 0021, 0035) decide who plays when: blind order; reveal, then
// take turns showing first; or showdown, where both open at once and then the winner of a round
// shows first and the loser answers. Pure and deterministic like the rest of the sim, so a server can replay a
// series from its setup to verify a reported result (series-verify.ts).
import { deriveSeed, nextFloat } from './rng.ts';
import type { MatchResult, WorldState } from './types.ts';

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
/** Reveal's coin toss for who shows first in round 1 (ADR 0029). */
const TOSS_SALT = 0x70557055;

export type Side = 'a' | 'b';
export type Lineup = readonly [string, string, string];

/**
 * How the order of each lineup is decided (ADR 0019):
 * - `blind`: each side sets its order without seeing the other's lineup (ADR 0017).
 * - `reveal` (ADR 0021, 0029): both lineups are revealed, then the sides take turns showing first.
 *   A seeded coin toss picks who shows first in round 1 while the other answers; in round 2 the
 *   other side shows first. Round 3 is the ball each side has left. Every choice is a pick,
 *   recorded in order.
 * - `showdown` (ADR 0035): both lineups are revealed. In round 1 both sides pick at the same time,
 *   neither seeing the other's pick (recorded A then B; a bot's pick never reads A's). In round 2
 *   the winner of round 1 shows first and the loser answers. Round 3 is the ball each side has left.
 *   It replaced "loser picks next" (ADR 0019), whose links now open the lineup step.
 */
export type Format = 'blind' | 'reveal' | 'showdown';
export const FORMATS: readonly Format[] = ['blind', 'reveal', 'showdown'];

/**
 * Who plays side B (ADR 0022):
 * - a bot, named by its id, whose lineup is what it picks from `lineupSeed` (the series seed, or
 *   the first series' seed after a rematch), so a verifier can recompute its lineup and picks;
 * - a player, whose lineup and picks are their own, so only their legality can be checked. Links
 *   can't express this; it is for a server that knows who played.
 */
export type Opponent =
  | { readonly kind: 'bot'; readonly bot: string; readonly lineupSeed: number }
  | { readonly kind: 'player' };

/** Everything that decides a series: replaying it needs nothing else. */
export interface SeriesSetup {
  /** The RULESET_VERSION it is played under (ADR 0022); 0 for a link from before versions. */
  readonly ruleset: number;
  readonly seed: number;
  /** The player's lineup (slot A in every round), in the order set before round 1. */
  readonly a: Lineup;
  /** The opponent's lineup (slot B). */
  readonly b: Lineup;
  readonly opponent: Opponent;
  /** Undefined is `blind`, the format every series had before ADR 0019. */
  readonly format?: Format;
  /** `reveal` and `showdown`: every pick made, both sides', in order. A replay takes them from here. */
  readonly picks?: readonly string[];
}

/** A pick made in a `reveal` or `showdown` series: `side` chose `ball` for round `round` (0-based). */
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
  /** Picks made so far (`reveal` and `showdown` series). */
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
 * Reveal's coin toss (ADR 0029): the side that shows first in round 1. Seeded from the series seed
 * alone, so a link (which holds the seed) replays it and a verifier recomputes it.
 */
export function revealFirst(seriesSeed: number): Side {
  return nextFloat(deriveSeed([seriesSeed, TOSS_SALT])).value < 0.5 ? 'a' : 'b';
}

/**
 * Who shows first in each round of a `reveal` series, then who answers (ADR 0021, 0029): the toss
 * winner shows first in round 1 and answers in round 2. Round 3 has no picks: each side plays the
 * ball it has left.
 */
export function revealTurnsOf(setup: SeriesSetup): readonly (readonly Side[])[] {
  const first = revealFirst(setup.seed);
  const second = otherSide(first);
  return [
    [first, second],
    [second, first],
  ];
}

/**
 * Who picks in each round of a `showdown` series, in the order the picks are recorded (ADR 0035):
 * round 1 both at once (A's recorded first, but neither sees the other's), round 2 the winner of
 * round 1 shows first and the loser answers. Round 3 has no picks.
 */
export function showdownTurnsOf(state: SeriesState): readonly (readonly Side[])[] {
  const first = state.rounds[0]?.winner;
  return first === undefined
    ? [['a', 'b']]
    : [
        ['a', 'b'],
        [first, otherSide(first)],
      ];
}

/**
 * The side that must pick its ball before the next round, if any: whoever's turn it is in the
 * round (`revealTurnsOf`, `showdownTurnsOf`), until every side due has picked. A blind series has
 * no picks.
 */
export function awaitingPick(state: SeriesState): Side | undefined {
  const format = formatOf(state.setup);
  if (state.winner !== undefined || state.pending.length > 0 || format === 'blind')
    return undefined;
  const round = state.rounds.length;
  const turns = format === 'reveal' ? revealTurnsOf(state.setup) : showdownTurnsOf(state);
  const picked = (side: Side) => state.picks.some((p) => p.round === round && p.side === side);
  return turns[round]?.find((side) => !picked(side));
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
  if (formatOf(state.setup) === 'blind') return state.setup;
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
