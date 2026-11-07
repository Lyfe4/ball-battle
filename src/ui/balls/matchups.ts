// What the picker and the ball manual say about matchups, read from the counter map (ADR 0010) and
// the definitions, so the text can never drift from what the balance checks hold the game to.
// It names the intended direction only ("favoured"), never a measured win rate, which moves with
// tuning.
import { counterFor, isFavoured } from '../../sim/counter-map.ts';
import type { BallDefinition } from '../../sim/types.ts';

/** How a ball should fare against one opponent. */
export type Lean = 'favoured' | 'unfavoured' | 'even';

export interface MatchupLine {
  readonly opponent: string;
  readonly lean: Lean;
  /** Why, in one line from the counter map; empty for a mirror. */
  readonly reason: string;
}

export interface Matchups {
  /** Balls it is strong vs (favoured against), in roster order. Favoured is never certain. */
  readonly strong: readonly MatchupLine[];
  /** Balls it is weak vs (favoured against it). */
  readonly weak: readonly MatchupLine[];
  /** Everyone else, the mirror excluded. */
  readonly even: readonly MatchupLine[];
}

export function leanOf(ball: string, opponent: string): Lean {
  if (isFavoured(ball, opponent)) return 'favoured';
  if (isFavoured(opponent, ball)) return 'unfavoured';
  return 'even';
}

export function matchupLine(ball: string, opponent: string): MatchupLine {
  return {
    opponent,
    lean: leanOf(ball, opponent),
    reason: counterFor(ball, opponent)?.reason ?? '',
  };
}

/** Every opponent of `ball` in `roster`, sorted into strong vs, weak vs and even. */
export function matchupsOf(ball: string, roster: readonly string[]): Matchups {
  const lines = roster.filter((id) => id !== ball).map((id) => matchupLine(ball, id));
  return {
    strong: lines.filter((line) => line.lean === 'favoured'),
    weak: lines.filter((line) => line.lean === 'unfavoured'),
    even: lines.filter((line) => line.lean === 'even'),
  };
}

/** The ball the counter map favours in a pair, if either; undefined for an even pair or a mirror. */
export function favouredOf(a: string, b: string): string | undefined {
  if (isFavoured(a, b)) return a;
  if (isFavoured(b, a)) return b;
  return undefined;
}

export interface StatShares {
  /** Each stat as a share of the roster's highest, 0 to 1, for bars that compare balls. */
  readonly health: number;
  readonly hit: number;
}

/**
 * Speed as a trait, only where it defines a ball: the roster's fastest or slowest by base speed.
 * The rest differ by a few percent, too little for a bar to show anything.
 */
export function speedTrait(
  ball: BallDefinition,
  roster: readonly BallDefinition[],
): 'Fastest ball' | 'Slowest ball' | undefined {
  const speeds = roster.map((b) => b.speed);
  if (ball.speed === Math.max(...speeds)) return 'Fastest ball';
  if (ball.speed === Math.min(...speeds)) return 'Slowest ball';
  return undefined;
}

/** A ball's base stats against the roster's best. Abilities change them in a match; this doesn't. */
export function statShares(ball: BallDefinition, roster: readonly BallDefinition[]): StatShares {
  const most = (pick: (b: BallDefinition) => number) => Math.max(...roster.map(pick));
  return {
    health: ball.maxHealth / most((b) => b.maxHealth),
    hit: ball.contactDamage / most((b) => b.contactDamage),
  };
}

/** Whose balls a matchup is told between: the player's against the bot's, or two balls. */
export type TipFraming = 'yours' | 'neutral';

/**
 * A matchup mark's tooltip, naming both balls and saying plainly who has the edge (ADR 0037):
 * "Your Chrono vs the bot's Storm: you're favoured", "Speedster vs Storm: Storm is favoured".
 * The counter map's one-line reason follows as a second line, so a tap shows what to watch.
 */
export function matchupTip(
  ball: string,
  opponent: string,
  nameOf: (id: string) => string,
  framing: TipFraming,
): readonly string[] {
  const mine = nameOf(ball);
  const theirs = nameOf(opponent);
  const yours = framing === 'yours';
  const pair = yours ? `Your ${mine} vs the bot’s ${theirs}` : `${mine} vs ${theirs}`;
  if (ball === opponent) return [`${pair}: a mirror, even`];
  const lean = leanOf(ball, opponent);
  const edge =
    lean === 'even'
      ? 'even'
      : lean === 'favoured'
        ? yours
          ? 'you’re favoured'
          : `${mine} is favoured`
        : `${theirs} is favoured`;
  const reason = counterFor(ball, opponent)?.reason ?? '';
  return reason === '' ? [`${pair}: ${edge}`] : [`${pair}: ${edge}`, reason];
}
