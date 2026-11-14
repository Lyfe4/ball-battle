// A series (ADR 0017, docs/vision.md): two lineups of three different balls, first to two round
// wins; or a Best of 5 (ADR 0048), five balls each, first to three. Draft formats (ADR 0019, 0021, 0035) decide who plays when: blind order; reveal, then
// take turns showing first; or showdown, where both open at once and then the winner of a round
// shows first and the loser answers. Pure and deterministic like the rest of the sim, so a server can replay a
// series from its setup to verify a reported result (series-verify.ts).
import {
  attemptSeed,
  firstToShowOf,
  roundSeedOf,
  suddenDeathWinner,
  type SeriesSeeds,
} from './series-seeds.ts';
import type { MatchResult, WorldState } from './types.ts';

export {
  attemptSeed,
  firstToShowOf,
  revealFirst,
  roundSeed,
  roundSeedOf,
  suddenDeathWinner,
} from './series-seeds.ts';
export type { SeriesSeeds } from './series-seeds.ts';

/**
 * How long a series is (ADR 0048): balls per lineup, and so the most rounds it can take. A side
 * needs a majority of them to win. Best of 3 is the default and what every setup without a
 * `bestOf` means.
 */
export type BestOf = 3 | 5;
export const BEST_OF: readonly BestOf[] = [3, 5];
export const DEFAULT_BEST_OF: BestOf = 3;
/** Plays of a round before a draw is settled by sudden death (docs/vision.md, mirror draws). */
export const MAX_ATTEMPTS = 3;

export type Side = 'a' | 'b';
/** A lineup of `bestOf` different balls, in order. */
export type Lineup = readonly string[];

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
  /** Undefined is Best of 3, the only length before ADR 0048. */
  readonly bestOf?: BestOf;
  /**
   * A server series' own seeds (ADR 0052): when given, nothing is derived from `seed`. A local
   * series and a link have none and derive every seed from `seed` (series-seeds.ts).
   */
  readonly seeds?: SeriesSeeds;
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
  /** Set once a side has `winsNeededOf` round wins. */
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

export const bestOfOf = (setup: SeriesSetup): BestOf => setup.bestOf ?? DEFAULT_BEST_OF;

/** Round wins that take a series of this length: a majority of its rounds. */
export const winsNeededOf = (bestOf: BestOf): number => (bestOf + 1) / 2;

/** A length a link or a save names, if it is one the game plays. */
export const asBestOf = (value: unknown): BestOf | undefined =>
  BEST_OF.find((length) => length === value);

/** True for `size` different ids, all in `validIds`. */
export function isValidLineup(
  ids: readonly string[],
  validIds: readonly string[],
  size: BestOf,
): ids is Lineup {
  return (
    ids.length === size && new Set(ids).size === size && ids.every((id) => validIds.includes(id))
  );
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
 * Who shows first in each round of a `reveal` series, then who answers (ADR 0021, 0029, 0048): the
 * toss winner shows first in round 1, then the sides alternate. The last round has no picks: each
 * side plays the ball it has left.
 */
export function revealTurnsOf(setup: SeriesSetup): readonly (readonly Side[])[] {
  const first = firstToShowOf(setup);
  return Array.from({ length: bestOfOf(setup) - 1 }, (_, round) => {
    const shows = round % 2 === 0 ? first : otherSide(first);
    return [shows, otherSide(shows)];
  });
}

/**
 * Who picks in each round of a `showdown` series, in the order the picks are recorded (ADR 0035,
 * 0048): round 1 both at once (A's recorded first, but neither sees the other's); in every later
 * round but the last, the winner of the round before shows first and the loser answers. The last
 * round has no picks. Only rounds whose turns are known yet are listed.
 */
export function showdownTurnsOf(state: SeriesState): readonly (readonly Side[])[] {
  const picking = bestOfOf(state.setup) - 1;
  const later = state.rounds
    .slice(0, picking - 1)
    .map((round): readonly Side[] => [round.winner, otherSide(round.winner)]);
  return [['a', 'b'], ...later];
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
  return { round, attempt, seed: attemptSeed(roundSeedOf(state.setup, round), attempt), a, b };
}

/**
 * Records how the next match ended. A win ends the round; a draw replays it with the next attempt
 * seed, and the MAX_ATTEMPTS-th draw goes to sudden death. The series ends as soon as a side has
 * the wins it needs, so a 2-0 never plays round 3 (nor a 3-0 or 3-1 round 5). Throws once the
 * series is decided.
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
  const seedOfRound = roundSeedOf(state.setup, match.round);
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
  const needed = winsNeededOf(bestOfOf(state.setup));
  const winner = score.a >= needed ? 'a' : score.b >= needed ? 'b' : undefined;
  return { ...next, winner };
}

/** Which side a finished match's result favours: slot A is ball-0, slot B is ball-1. */
export function outcomeOf(result: MatchResult, world: WorldState): Outcome {
  if (result.kind === 'draw') return 'draw';
  return result.winnerId === world.balls[0]?.id ? 'a' : 'b';
}
