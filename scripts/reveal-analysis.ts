// Pure analysis for the reveal measurements (docs/reveal-measurements.md, ADR 0021, 0029): how much the
// player's choices are worth in a best-of-3 under each way of setting who plays when. Exact
// expectations over the bot's choices, given each round's odds; no matches are played here.
//
// Rounds are independent and a drawn round counts as half a win (it is replayed). The series is
// first to two.
import { isFavoured } from '../src/sim/counter-map.ts';

/** The chance the player's `a` beats the bot's `b` in one round. */
export type Odds = (a: string, b: string) => number;

/** Odds from the counter map alone: favoured 64%, even 50%, unfavoured 36%. */
export const mapOdds: Odds = (a, b) => (isFavoured(a, b) ? 0.64 : isFavoured(b, a) ? 0.36 : 0.5);

/** The chance of taking a best-of-3 with round chances `x`, `y`, `z` (round 3 only at 1-1). */
export function seriesWin(x: number, y: number, z: number): number {
  return x * y + x * (1 - y) * z + (1 - x) * y * z;
}

/** Every order of `items`. */
export function orders<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    orders([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

/** The player's best and worst series chance over their choices (worst: the same choices, badly). */
export interface Spread {
  readonly best: number;
  readonly worst: number;
}

const average = (values: readonly number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/**
 * Before ADR 0021: both orders set in secret, the bot's at random. Every player order is worth the
 * same, so best and worst are equal.
 */
export function simultaneous(you: readonly string[], bot: readonly string[], odds: Odds): Spread {
  const values = orders(you).map((order) =>
    average(
      orders(bot).map((b) =>
        seriesWin(...(order.map((y, r) => odds(y, b[r] ?? '')) as [number, number, number])),
      ),
    ),
  );
  return { best: Math.max(...values), worst: Math.min(...values) };
}

/**
 * The bot's answer in reveal, whichever round it answers in (src/sim/bot.ts): its best counter by the counter map, ties
 * at random. Returns each ball it may answer with and how likely.
 */
export function answers(remaining: readonly string[], shown: string): [string, number][] {
  const rank = (id: string) => (isFavoured(id, shown) ? 2 : isFavoured(shown, id) ? 0 : 1);
  const best = Math.max(...remaining.map(rank));
  const pool = remaining.filter((id) => rank(id) === best);
  return pool.map((id) => [id, 1 / pool.length]);
}

/**
 * Reveal, take turns (ADR 0021): round 1 the bot shows a random ball and the player answers;
 * round 2 the player shows first, knowing the score, and the bot answers (`answers`); round 3 is
 * what is left. The player's best and worst play against that bot.
 */
export function takeTurns(you: readonly string[], bot: readonly string[], odds: Odds): Spread {
  const solve = (choose: (values: number[]) => number): number =>
    average(
      bot.map((b1) => {
        const botLeft = bot.filter((id) => id !== b1);
        return choose(
          you.map((y1) => {
            const left = you.filter((id) => id !== y1);
            const afterRound1 = (wins: number, losses: number) =>
              choose(
                left.map((y2) => {
                  const y3 = left.find((id) => id !== y2) ?? '';
                  return answers(botLeft, y2).reduce((sum, [b2, chance]) => {
                    const b3 = botLeft.find((id) => id !== b2) ?? '';
                    const q2 = odds(y2, b2);
                    const q3 = odds(y3, b3);
                    const next = (w: number, l: number) => (w >= 2 ? 1 : l >= 2 ? 0 : q3);
                    return (
                      sum +
                      chance * (q2 * next(wins + 1, losses) + (1 - q2) * next(wins, losses + 1))
                    );
                  }, 0);
                }),
              );
            const q1 = odds(y1, b1);
            return q1 * afterRound1(1, 0) + (1 - q1) * afterRound1(0, 1);
          }),
        );
      }),
    );
  return { best: solve((v) => Math.max(...v)), worst: solve((v) => Math.min(...v)) };
}

/**
 * Reveal when the player wins the coin toss (ADR 0029): round 1 the player shows first and the bot
 * answers (`answers`); round 2 the bot shows a random ball of its two left and the player answers,
 * knowing the score; round 3 is what is left. The player's best and worst play against that bot.
 */
export function playerFirst(you: readonly string[], bot: readonly string[], odds: Odds): Spread {
  const solve = (choose: (values: number[]) => number): number =>
    choose(
      you.map((y1) => {
        const left = you.filter((id) => id !== y1);
        return answers(bot, y1).reduce((total, [b1, answerChance]) => {
          const botLeft = bot.filter((id) => id !== b1);
          const afterRound1 = (wins: number, losses: number) =>
            average(
              botLeft.map((b2) => {
                const b3 = botLeft.find((id) => id !== b2) ?? '';
                return choose(
                  left.map((y2) => {
                    const y3 = left.find((id) => id !== y2) ?? '';
                    const q2 = odds(y2, b2);
                    const q3 = odds(y3, b3);
                    const next = (w: number, l: number) => (w >= 2 ? 1 : l >= 2 ? 0 : q3);
                    return q2 * next(wins + 1, losses) + (1 - q2) * next(wins, losses + 1);
                  }),
                );
              }),
            );
          const q1 = odds(y1, b1);
          return total + answerChance * (q1 * afterRound1(1, 0) + (1 - q1) * afterRound1(0, 1));
        }, 0);
      }),
    );
  return { best: solve((v) => Math.max(...v)), worst: solve((v) => Math.min(...v)) };
}

/**
 * Reveal with the coin toss (ADR 0029): a fair coin decides who shows first in round 1, so each
 * lineup pair is half `takeTurns` (the bot shows first) and half `playerFirst`. The toss is made
 * before any choice, so the best and the worst play are each the average of the two.
 */
export function coinToss(you: readonly string[], bot: readonly string[], odds: Odds): Spread {
  const botFirst = takeTurns(you, bot, odds);
  const youFirst = playerFirst(you, bot, odds);
  return {
    best: (botFirst.best + youFirst.best) / 2,
    worst: (botFirst.worst + youFirst.worst) / 2,
  };
}

/** Every lineup of three different balls from `roster`. */
export function lineupsOf(roster: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      for (let k = j + 1; k < roster.length; k++)
        out.push([roster[i] ?? '', roster[j] ?? '', roster[k] ?? '']);
    }
  }
  return out;
}

export interface Summary {
  readonly pairs: number;
  /** Average series chance with the best and the worst play. */
  readonly best: number;
  readonly worst: number;
  /** Share of lineup pairs where the player's choices move their chance by 3 points or more. */
  readonly matters: number;
}

/** A rule's spread averaged over every pair of lineups from `roster`. */
export function summarise(
  rule: (you: readonly string[], bot: readonly string[], odds: Odds) => Spread,
  roster: readonly string[],
  odds: Odds,
): Summary {
  const lineups = lineupsOf(roster);
  let best = 0;
  let worst = 0;
  let matters = 0;
  for (const you of lineups) {
    for (const bot of lineups) {
      const spread = rule(you, bot, odds);
      best += spread.best;
      worst += spread.worst;
      if (spread.best - spread.worst >= 0.03) matters++;
    }
  }
  const pairs = lineups.length ** 2;
  return { pairs, best: best / pairs, worst: worst / pairs, matters: matters / pairs };
}
