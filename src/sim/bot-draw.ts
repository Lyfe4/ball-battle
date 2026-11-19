// The draws every bot makes (ADR 0035): its lineup, and a seeded choice from its weights, each on
// a stream of its own. Plain helpers for bot.ts; pure and seeded, like the rest of the sim.
import type { BotRole, Weights } from './bot.ts';
import { createStream, deriveSeed } from './rng.ts';
import { DEFAULT_BEST_OF, type Lineup } from './series.ts';

/** Keeps each of the bot's choices on its own stream, apart from the series' round seeds. */
const BOT_SALT = 0xb07;
const SHOW_SALT = 0x5409;
const ANSWER_SALT = 0xa45e;
const OPEN_SALT = 0x0be7;
/** Normal and Hard draw on streams of their own, so a level never shares another's draws. */
export const LEVEL_SALTS: Readonly<Record<string, number>> = {
  easy: 0xea5,
  normal: 0x707a1,
  hard: 0x4a7d,
};
export const ROLE_SALTS: Readonly<Record<BotRole, number>> = {
  show: SHOW_SALT,
  answer: ANSWER_SALT,
  open: OPEN_SALT,
};

/**
 * Different balls uniformly at random, in a random order: every level picks this way. Each ball is
 * one draw on the stream, so a Best of 5 lineup is its Best of 3 lineup and two more.
 */
export function pickLineup(
  seed: number,
  roster: readonly string[],
  size = DEFAULT_BEST_OF,
): Lineup {
  if (new Set(roster).size < size) {
    throw new Error(`A lineup needs ${String(size)} different balls`);
  }
  const random = createStream(deriveSeed([seed, BOT_SALT]));
  const pool = [...new Set(roster)];
  const picked: string[] = [];
  while (picked.length < size) {
    const index = Math.floor(random() * pool.length);
    picked.push(...pool.splice(index, 1));
  }
  return picked;
}

export const uniform = (balls: readonly string[]): Weights =>
  balls.map((ball) => [ball, 1 / balls.length] as const);

/** The balls in `balls` with the highest score, in their order. */
export function bestBy(balls: readonly string[], score: (ball: string) => number, margin = 1e-9) {
  const scores = balls.map(score);
  const best = Math.max(...scores);
  return balls.filter((_, index) => (scores[index] ?? -Infinity) >= best - margin);
}

/** Mixes two weightings: `share` of the first, the rest of the second. */
export function blend(share: number, first: Weights, second: Weights): Weights {
  const total = new Map<string, number>();
  for (const [ball, weight] of first) total.set(ball, (total.get(ball) ?? 0) + share * weight);
  for (const [ball, weight] of second)
    total.set(ball, (total.get(ball) ?? 0) + (1 - share) * weight);
  return [...total].filter(([, weight]) => weight > 0);
}

/** A seeded draw from `weights`, in their order. */
export function draw(weights: Weights, seed: number): string {
  const roll = createStream(seed)();
  let sum = 0;
  for (const [ball, weight] of weights) {
    sum += weight;
    if (roll < sum) return ball;
  }
  const last = weights.at(-1);
  if (last === undefined) throw new Error('No ball to choose from');
  return last[0];
}
