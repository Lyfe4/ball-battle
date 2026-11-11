// Blind orders for a series of any lineup size (docs/best-of-5-measurements.md): both orders are
// set before round 1, so a series is just rounds in order, first to `need`.
import { orders, type Odds } from './reveal-analysis.ts';

/** Every choice of `k` of `items`, in their order. */
export function combinations(items: readonly string[], k: number): string[][] {
  if (k === 0) return [[]];
  return items.flatMap((item, i) =>
    combinations(items.slice(i + 1), k - 1).map((rest) => [item, ...rest]),
  );
}

/** The player's series chance with both orders fixed. */
export function fixedOrders(
  you: readonly string[],
  bot: readonly string[],
  odds: Odds,
  need: number,
): number {
  const go = (round: number, wins: number, losses: number): number => {
    if (wins >= need) return 1;
    if (losses >= need) return 0;
    const q = odds(you[round] ?? '', bot[round] ?? '');
    return q * go(round + 1, wins + 1, losses) + (1 - q) * go(round + 1, wins, losses + 1);
  };
  return go(0, 0, 0);
}

/** The player's best order against the bot's order drawn uniformly at random. */
export function bestOrder(
  you: readonly string[],
  theirs: readonly string[],
  odds: Odds,
  need: number,
): string[] {
  const botOrders = orders(theirs);
  let kept: string[] = [...you];
  let keptValue = -1;
  for (const order of orders(you)) {
    const v =
      botOrders.reduce((s, b) => s + fixedOrders(order, b, odds, need), 0) / botOrders.length;
    if (v > keptValue) [kept, keptValue] = [order, v];
  }
  return kept;
}
