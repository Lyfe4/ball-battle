// Builds the aiming strategy profiles to evaluate on held-out seeds (docs/aiming-measurements.md):
// both sides' best direction against random aim, the solved blind aiming game, and best responses
// to each. Reads the directions and matrix results; writes a strategies file for
// `aim-measure.ts evaluate`, and the training values for the report.
// Usage: node scripts/aim-strategies.ts <directions.json> <matrix.json> <out.json> [cone]
//   cone: only directions within this many degrees of straight at the opponent (default 180, all)
import { writeFileSync } from 'node:fs';
import { BALLS } from '../src/sim/balls/index.ts';
import {
  add,
  columnPayoffs,
  EMPTY,
  rowPayoffs,
  solveZeroSum,
  summarise,
  type Tally,
} from './aim-analysis.ts';
import {
  directionHalves,
  foldedWeights,
  index,
  oneHot,
  payoffMatrix,
  readRows,
} from './aim-data.ts';
import { DIRECTIONS, foldedOf, type Strategy } from './aim-play.ts';

const [directionsFile, matrixFile, outFile, coneArg] = process.argv.slice(2);
if (directionsFile === undefined || matrixFile === undefined || outFile === undefined) {
  console.error(
    'Usage: node scripts/aim-strategies.ts <directions.json> <matrix.json> <out.json> [cone]',
  );
  process.exit(1);
}
const cone = Number(coneArg ?? 180);
/** The directions a player may choose. */
const allowed = Array.from({ length: DIRECTIONS }, (_, k) => k).filter((k) => foldedOf(k) <= cone);
const lastFolded = Math.floor(cone / (360 / DIRECTIONS));
const directions = index(readRows(directionsFile), ['p', 'q', 'aim', 'half']);
const matrix = index(readRows(matrixFile), ['p', 'q', 'i', 'j']);
const ids = BALLS.map((ball) => ball.id);
const pairs = ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y] as const));

/** P's best folded direction (within the cone) against random aim (within the cone). */
const bestAgainstRandom = (p: string, q: string): number => {
  const { halves } = directionHalves(directions, p, q);
  const inCone = halves.map((half) => half.slice(0, lastFolded + 1)) as [Tally[], Tally[]];
  const reference = inCone.map((half) => half.reduce(add, EMPTY)) as [Tally, Tally];
  return summarise(inCone, reference).best;
};
const mixed = (weights: readonly number[]) => ({ kind: 'mixed', weights }) as const;
/** Weights over the allowed directions, spread back over all 24. */
const expand = (weights: readonly number[]) => {
  const full = new Array<number>(DIRECTIONS).fill(0);
  allowed.forEach((k, i) => (full[k] = weights[i] ?? 0));
  return full;
};
const pickBest = (values: readonly number[], better: (a: number, b: number) => boolean) =>
  oneHot(
    allowed.reduce(
      (best, k) => (better(values[k] ?? 0, values[best] ?? 0) ? k : best),
      allowed[0] ?? 0,
    ),
  );

const strategies: Strategy[] = [];
const training: Record<string, { value: number; lower: number; upper: number }> = {};
for (const [p, q] of pairs) {
  // Each side's best folded direction against random aim, played as ±θ evenly.
  const naiveP = foldedWeights(bestAgainstRandom(p, q));
  const naiveQ = foldedWeights(bestAgainstRandom(q, p));
  const payoff = payoffMatrix(matrix, p, q);
  const sub = allowed.map((i) => allowed.map((j) => payoff[i]?.[j] ?? 0));
  const solved = solveZeroSum(sub);
  const nashP = expand(solved.row);
  const nashQ = expand(solved.column);
  training[`${p}|${q}`] = { value: solved.value, lower: solved.lower, upper: solved.upper };
  const bestP = (column: readonly number[]) =>
    pickBest(rowPayoffs(payoff, column), (a, b) => a > b);
  const bestQ = (row: readonly number[]) => pickBest(columnPayoffs(payoff, row), (a, b) => a < b);
  const push = (name: string, aimP: readonly number[], aimQ: readonly number[]) => {
    strategies.push({ p, q, name, aimP: mixed(aimP), aimQ: mixed(aimQ) });
  };
  const uniform = expand(allowed.map(() => 1));
  if (cone >= 180) {
    strategies.push({ p, q, name: 'random', aimP: { kind: 'random' }, aimQ: { kind: 'random' } });
  } else {
    push('random', uniform, uniform);
  }
  push('naive', naiveP, naiveQ);
  push('nash', nashP, nashQ);
  push('brP-naive', bestP(naiveQ), naiveQ);
  push('brQ-naive', naiveP, bestQ(naiveP));
  push('brP-nash', bestP(nashQ), nashQ);
  push('brQ-nash', nashP, bestQ(nashP));
}
writeFileSync(outFile, JSON.stringify(strategies));
writeFileSync(outFile.replace(/\.json$/, '.training.json'), JSON.stringify(training));
console.error(`  ${strategies.length} strategy profiles for ${pairs.length} pairs, cone ±${cone}°`);
