// What the picker and the ball manual say about matchups, read from the counter map (ADR 0010) and
// the definitions, so the text can never drift from what the balance checks hold the game to.
// It names the level ("strongly" or "slightly favoured", ADR 0073) and that level's odds in words,
// never a measured win rate, which moves with tuning.
import { counterFor, matchupOf, type Level } from '../../sim/counter-map.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { MARKS, STRONG_MARKS } from './marks.ts';

/** How a ball should fare against one opponent. */
export type Lean = 'favoured' | 'unfavoured' | 'even';

export interface MatchupLine {
  readonly opponent: string;
  readonly lean: Lean;
  /** How far the favoured side is ahead; undefined when even. */
  readonly level: Level | undefined;
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
  const matchup = matchupOf(ball, opponent);
  if (matchup === undefined) return 'even';
  return matchup.favoured === ball ? 'favoured' : 'unfavoured';
}

/** How far the favoured side of a pair is ahead (ADR 0073), or undefined when even. */
export function levelOf(ball: string, opponent: string): Level | undefined {
  return matchupOf(ball, opponent)?.level;
}

/** A pair's mark as players read it: ▲▲ / ▼▼ strong, ▲ / ▼ an edge, = even. */
export function markOf(ball: string, opponent: string): string {
  const lean = leanOf(ball, opponent);
  if (lean === 'even') return MARKS.even;
  return levelOf(ball, opponent) === 'strong' ? STRONG_MARKS[lean] : MARKS[lean];
}

/** The symbol (symbols.ts) a pair's mark stands for. */
export function symbolOf(
  ball: string,
  opponent: string,
): Lean | 'strongFavoured' | 'strongUnfavoured' {
  const lean = leanOf(ball, opponent);
  if (lean === 'even' || levelOf(ball, opponent) !== 'strong') return lean;
  return lean === 'favoured' ? 'strongFavoured' : 'strongUnfavoured';
}

/** The words for a mark, before the other ball's name: "strongly favoured against Frost". */
export function leanWordsOf(ball: string, opponent: string): string {
  const lean = leanOf(ball, opponent);
  if (lean === 'even') return 'even with';
  return `${levelOf(ball, opponent) === 'strong' ? 'strongly' : 'slightly'} ${lean} against`;
}

/** A level's odds in words, never a measured rate: the middle of the band it is held to. */
export function oddsWordsOf(ball: string, opponent: string): string {
  const level = levelOf(ball, opponent);
  return level === 'strong' ? 'about 7 in 10' : level === 'edge' ? 'about 6 in 10' : 'about 1 in 2';
}

/** Sets a mark's text, and its lean and level for the stylesheets (`data-lean`, `data-level`). */
export function setMark(
  mark: { textContent: string | null; readonly dataset: Record<string, string | undefined> },
  ball: string,
  opponent: string,
): void {
  mark.textContent = markOf(ball, opponent);
  mark.dataset['lean'] = leanOf(ball, opponent);
  const level = levelOf(ball, opponent);
  if (level === undefined) delete mark.dataset['level'];
  else mark.dataset['level'] = level;
}

export function matchupLine(ball: string, opponent: string): MatchupLine {
  return {
    opponent,
    lean: leanOf(ball, opponent),
    level: levelOf(ball, opponent),
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
  return matchupOf(a, b)?.favoured;
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
 * A matchup mark's tooltip, naming both balls and saying plainly who has the edge and how much
 * (ADR 0037, 0073): "Your Chrono vs the bot's Storm: you're strongly favoured, about 7 in 10",
 * "Speedster vs Storm: Storm is slightly favoured, about 6 in 10". The counter map's one-line
 * reason follows as a second line, so a tap shows what to watch.
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
  const how = levelOf(ball, opponent) === 'strong' ? 'strongly' : 'slightly';
  const who = lean === 'favoured' ? (yours ? 'you’re' : `${mine} is`) : `${theirs} is`;
  const edge =
    lean === 'even'
      ? 'even, about 1 in 2 each'
      : `${who} ${how} favoured, ${oddsWordsOf(ball, opponent)}`;
  const reason = counterFor(ball, opponent)?.reason ?? '';
  return reason === '' ? [`${pair}: ${edge}`] : [`${pair}: ${edge}`, reason];
}
