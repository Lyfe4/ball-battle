// What the best-of-3 screens show, as pure functions of the series state, so the visuals (the
// round track, the pick rows, the next pairing; ADR 0025) are tested without a DOM. Only what the
// player is allowed to know is ever returned: the bot's hidden balls are `undefined`.
import {
  awaitingPick,
  formatOf,
  LINEUP_SIZE,
  nextBallOf,
  nextMatch,
  remainingOf,
  type NextMatch,
  type SeriesState,
  type Side,
} from '../../sim/series.ts';
import { leanOf, type Lean } from '../balls/matchups.ts';

/** One side of one round on the track. */
export interface TrackCell {
  /** The ball, when the player may know it. */
  readonly ball?: string;
  /** Reveal: the bot's balls not yet played, any of which may come next. */
  readonly pool?: readonly string[];
  readonly result?: 'won' | 'lost';
}

export interface TrackColumn {
  /** 0-based. */
  readonly round: number;
  /** Played, the one being played or coming next, or later. */
  readonly when: 'played' | 'now' | 'later';
  readonly you: TrackCell;
  readonly bot: TrackCell;
  /** Draws replayed in this round (↻). */
  readonly draws: number;
  /** All three plays drew and a coin decided it (⚡). */
  readonly suddenDeath: boolean;
}

const picked = (state: SeriesState, round: number, side: Side) =>
  state.picks.find((pick) => pick.round === round && pick.side === side)?.ball;

/**
 * The ball a side plays in the round coming up, if the player may know it. In reveal a ball is
 * known once picked, or when it is the last one left (round 3); in loser-picks-next the winner's
 * next ball is shown to the loser; the bot's lineup is otherwise hidden. The player always knows
 * their own ball unless they still have to choose it.
 */
export function knownNextBall(state: SeriesState, side: Side): string | undefined {
  const format = formatOf(state.setup);
  const round = state.rounds.length;
  const left = remainingOf(state, side);
  if (format === 'reveal')
    return picked(state, round, side) ?? (left.length === 1 ? left[0] : undefined);
  if (side === 'a') return awaitingPick(state) === 'a' ? undefined : nextBallOf(state, 'a');
  if (format === 'loser' && awaitingPick(state) === 'a') return nextBallOf(state, 'b');
  return undefined;
}

/** Every round of the series as the track shows it: played, now, later (only rounds to play). */
export function trackOf(state: SeriesState, current: NextMatch | undefined): TrackColumn[] {
  const format = formatOf(state.setup);
  const played = state.rounds.length;
  const total = state.winner === undefined ? LINEUP_SIZE : played;
  return Array.from({ length: total }, (_, round): TrackColumn => {
    const record = state.rounds[round];
    if (record !== undefined) {
      const result = (side: Side) => (record.winner === side ? 'won' : 'lost');
      return {
        round,
        when: 'played',
        you: { ball: record.a, result: result('a') },
        bot: { ball: record.b, result: result('b') },
        draws: record.suddenDeath ? 0 : record.outcomes.length - 1,
        suddenDeath: record.suddenDeath,
      };
    }
    if (round === played) {
      const match = current?.round === round ? current : undefined;
      const botBall = match?.b ?? knownNextBall(state, 'b');
      const pool = remainingOf(state, 'b');
      return {
        round,
        when: 'now',
        you: { ...optional(match?.a ?? knownNextBall(state, 'a')) },
        bot: botBall === undefined && format === 'reveal' ? { pool } : { ...optional(botBall) },
        draws: state.pending.length,
        suddenDeath: false,
      };
    }
    // Later rounds: in a blind series the player's own order is set; everything else is open,
    // except that in Reveal the bot's balls not yet in a column wait under the next round.
    const own = format === 'blind' ? remainingOf(state, 'a')[round - played] : undefined;
    const nowBall = current?.round === played ? current.b : knownNextBall(state, 'b');
    const waiting = remainingOf(state, 'b').filter((id) => id !== nowBall);
    const pool = format === 'reveal' && round === played + 1 && nowBall !== undefined;
    return {
      round,
      when: 'later',
      you: { ...optional(own) },
      bot: pool ? { pool: waiting } : {},
      draws: 0,
      suddenDeath: false,
    };
  });
}

const optional = (ball: string | undefined) => (ball === undefined ? {} : { ball });

/**
 * Reveal, round 2: the balls the bot may answer `shown` with, by its public rule (ADR 0021): its
 * best counter by the counter map, favoured over even over unfavoured, a seeded coin between
 * equals. A test checks the bot's real answer is always one of these.
 */
export function botAnswers(remaining: readonly string[], shown: string): readonly string[] {
  const rank: Readonly<Record<Lean, number>> = { favoured: 2, even: 1, unfavoured: 0 };
  const ranks = remaining.map((id) => rank[leanOf(id, shown)]);
  const best = Math.max(...ranks);
  return remaining.filter((_, index) => ranks[index] === best);
}

/** A choice the player is asked for, and what each option would face. */
export interface PickChoice {
  /** `answer`: the bot's ball is known; `show`: the player shows first and the bot answers. */
  readonly kind: 'answer' | 'show';
  readonly options: readonly { readonly ball: string; readonly faces: readonly string[] }[];
}

/** The pick the player must make now, if any (loser picks next, or a reveal turn). */
export function pickChoiceOf(state: SeriesState): PickChoice | undefined {
  if (awaitingPick(state) !== 'a') return undefined;
  const mine = remainingOf(state, 'a');
  const botBall = knownNextBall(state, 'b');
  if (botBall !== undefined) {
    return { kind: 'answer', options: mine.map((ball) => ({ ball, faces: [botBall] })) };
  }
  const botLeft = remainingOf(state, 'b');
  return {
    kind: 'show',
    options: mine.map((ball) => ({ ball, faces: botAnswers(botLeft, ball) })),
  };
}

/** The coming round when nothing is asked of the player: its balls as far as the player knows. */
export interface Pairing {
  readonly round: number;
  readonly you: string | undefined;
  readonly bot: string | undefined;
  /** Above 0 when a drawn round is replayed. */
  readonly attempt: number;
}

export function pairingOf(state: SeriesState): Pairing | undefined {
  if (state.winner !== undefined || awaitingPick(state) === 'a') return undefined;
  const next = nextMatch(state);
  return {
    round: state.rounds.length,
    you: next?.a ?? knownNextBall(state, 'a'),
    bot: knownNextBall(state, 'b') ?? (formatOf(state.setup) === 'reveal' ? next?.b : undefined),
    attempt: next?.attempt ?? 0,
  };
}
