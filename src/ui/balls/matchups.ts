// What the picker and the ball manual say about matchups, read from the counter map (ADR 0010) and
// the definitions, so the text can never drift from what the balance checks hold the game to.
// It names the intended direction only ("favoured"), never a measured win rate, which moves with
// tuning.
import { counterFor, levelOf, type Strength } from '../../sim/counter-map.ts';
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
  const level = levelOf(ball, opponent);
  if (level === undefined || ball === opponent) return 'even';
  return level.favoured === ball ? 'favoured' : 'unfavoured';
}

/** PROTOTYPE: how far the favoured side is ahead, or undefined when even. */
export function strengthOf(ball: string, opponent: string): Strength | undefined {
  return ball === opponent ? undefined : levelOf(ball, opponent)?.strength;
}

/** A pair's level as players read it: ▲▲ / ▼▼ strong, ▲ / ▼ an edge, = even. */
export function markOf(ball: string, opponent: string): string {
  const lean = leanOf(ball, opponent);
  if (lean === 'even') return '=';
  const arrow = lean === 'favoured' ? '▲' : '▼';
  return strengthOf(ball, opponent) === 'strong' ? arrow + arrow : arrow;
}

/** The words for a mark, before the other ball's name: "strongly favoured against Frost". */
export function leanWordsOf(ball: string, opponent: string): string {
  const lean = leanOf(ball, opponent);
  if (lean === 'even') return 'even with';
  const how = strengthOf(ball, opponent) === 'strong' ? 'strongly' : 'slightly';
  return `${how} ${lean} against`;
}

/** Rough odds by level, never a measured rate: what each level is held to by `pnpm balance`. */
export function oddsWordsOf(ball: string, opponent: string): string {
  const strength = strengthOf(ball, opponent);
  return strength === 'strong'
    ? 'about 7 in 10'
    : strength === 'edge'
      ? 'about 6 in 10'
      : 'about 1 in 2';
}

/** Sets a mark's text and its lean and level for the stylesheet. */
export function setMark(
  mark: { textContent: string | null; readonly dataset: Record<string, string | undefined> },
  ball: string,
  opponent: string,
): void {
  mark.textContent = markOf(ball, opponent);
  mark.dataset['lean'] = leanOf(ball, opponent);
  const strength = strengthOf(ball, opponent);
  if (strength === undefined) delete mark.dataset['strength'];
  else mark.dataset['strength'] = strength;
}

export function matchupLine(ball: string, opponent: string): MatchupLine {
  return {
    opponent,
    lean: leanOf(ball, opponent),
    reason: reasonOf(ball, opponent),
  };
}

/**
 * PROTOTYPE: the map's reason, unless the measured level turned an even pair into an edge, whose
 * reason is still to be written (the proposal writes one for each).
 */
export function reasonOf(ball: string, opponent: string): string {
  const entry = counterFor(ball, opponent);
  if (entry === undefined) return '';
  const wasEven = entry.intended === 'even';
  const isEven = leanOf(ball, opponent) === 'even';
  return wasEven && !isEven
    ? 'A slight edge, measured; its reason is still to be written.'
    : entry.reason;
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
  return a === b ? undefined : levelOf(a, b)?.favoured;
}

export interface StatShares {
  /** Each stat as a share of the roster's highest, 0 to 1, for bars that compare balls. */
  readonly health: number;
  readonly hit: number;
  /** Top speed (`topSpeed`, else its base cruise speed, ADR 0008, 0056) against the roster's. */
  readonly speed: number;
}

/**
 * Speed as a trait, only where it defines a ball: the roster's fastest by the top speed it reaches
 * in a fight (the Speedster, ADR 0056) or slowest by base speed.
 * Its bar starts from zero like the others, so a few percent barely shows; the chip names the two
 * extremes.
 */
export function speedTrait(
  ball: BallDefinition,
  roster: readonly BallDefinition[],
): 'Fastest ball' | 'Slowest ball' | undefined {
  const speeds = roster.map((b) => b.speed);
  // The fastest is named by the speed it reaches in a fight (ADR 0056), the slowest by its base.
  const top = (b: BallDefinition) => b.topSpeed ?? b.speed;
  if (top(ball) === Math.max(...roster.map(top))) return 'Fastest ball';
  if (ball.speed === Math.min(...speeds)) return 'Slowest ball';
  return undefined;
}

/** A ball's base stats against the roster's best. Abilities change them in a match; this doesn't. */
export function statShares(ball: BallDefinition, roster: readonly BallDefinition[]): StatShares {
  const most = (pick: (b: BallDefinition) => number) => Math.max(...roster.map(pick));
  return {
    health: ball.maxHealth / most((b) => b.maxHealth),
    hit: ball.contactDamage / most((b) => b.contactDamage),
    speed: (ball.topSpeed ?? ball.speed) / most((b) => b.topSpeed ?? b.speed),
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
  const how = strengthOf(ball, opponent) === 'strong' ? 'strongly' : 'slightly';
  const edge =
    lean === 'even'
      ? 'even'
      : lean === 'favoured'
        ? yours
          ? `you’re ${how} favoured`
          : `${mine} is ${how} favoured`
        : `${theirs} is ${how} favoured`;
  const odds = lean === 'even' ? 'about 1 in 2 each' : `wins ${oddsWordsOf(ball, opponent)}`;
  const reason = reasonOf(ball, opponent);
  return reason === '' ? [`${pair}: ${edge}, ${odds}`] : [`${pair}: ${edge}, ${odds}`, reason];
}
