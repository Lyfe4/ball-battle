// Plays every matchup headlessly with the real simulation and prints a balance matrix.
// Usage: pnpm balance [seeds]   (default 500 per slot order; seeds 0..N-1, so results reproduce)
import { BALL_LOOKUP, BALLS } from '../src/sim/balls/index.ts';
import { MATCH_TIME_LIMIT_TICKS, TICK_RATE } from '../src/sim/constants.ts';
import { step } from '../src/sim/step.ts';
import type { BallDefinition, WorldState } from '../src/sim/types.ts';
import { createWorld } from '../src/sim/world.ts';

const DEFAULT_SEEDS = 500;

/** Balance targets; the summary marks each one as met or not. */
const TARGETS = {
  ballWinRate: [0.4, 0.6],
  worstMatchup: 0.25,
  drawRate: 0.05,
  medianSeconds: [15, 30],
} as const;

type Outcome = 'a' | 'b' | 'draw';

interface Tally {
  a: number;
  b: number;
  draw: number;
  readonly lengths: number[];
}

function parseSeedCount(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SEEDS;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1) {
    console.error(`Seed count must be a positive integer, got "${raw}".`);
    console.error('Usage: pnpm balance [seeds]');
    process.exit(1);
  }
  return count;
}

function playMatch(a: BallDefinition, b: BallDefinition, seed: number) {
  let world: WorldState = createWorld(seed, [a, b]);
  // The time limit guarantees an end; the extra tick only guards against a sim bug looping forever.
  for (let i = 0; i <= MATCH_TIME_LIMIT_TICKS && world.match.status === 'running'; i++) {
    world = step(world, BALL_LOOKUP).world;
  }
  if (world.match.status !== 'finished') {
    throw new Error(`${a.id} vs ${b.id}, seed ${seed}: did not finish within the time limit`);
  }
  const { result, endTick } = world.match;
  const outcome: Outcome =
    result.kind === 'draw' ? 'draw' : result.winnerId === 'ball-0' ? 'a' : 'b';
  return { outcome, seconds: endTick / TICK_RATE };
}

function tally(a: BallDefinition, b: BallDefinition, seeds: number): Tally {
  const counts: Tally = { a: 0, b: 0, draw: 0, lengths: [] };
  for (let seed = 0; seed < seeds; seed++) {
    const { outcome, seconds } = playMatch(a, b, seed);
    counts[outcome]++;
    counts.lengths.push(seconds);
  }
  return counts;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

const percent = (part: number, whole: number): string =>
  `${((part / whole) * 100).toFixed(1)}%`.padStart(6);
const check = (ok: boolean): string => (ok ? 'ok  ' : 'MISS');

const seeds = parseSeedCount(process.argv[2]);
const wins = new Map<string, number>(BALLS.map((ball) => [ball.id, 0]));
const games = new Map<string, number>(BALLS.map((ball) => [ball.id, 0]));
const lengths: number[] = [];
let draws = 0;
let total = 0;
let worstShare = 1;

console.log(`BallBattle balance: ${seeds} seeds per slot order (seeds 0-${seeds - 1})\n`);
console.log(`  ${'Matchup'.padEnd(24)} ${'Wins'.padEnd(15)}  Draw   Median`);

BALLS.forEach((x, i) => {
  for (const y of BALLS.slice(i + 1)) {
    // Both slot orders, so any advantage from starting on the left or right cancels out.
    const xFirst = tally(x, y, seeds);
    const yFirst = tally(y, x, seeds);
    const xWins = xFirst.a + yFirst.b;
    const yWins = xFirst.b + yFirst.a;
    const matchDraws = xFirst.draw + yFirst.draw;
    const played = seeds * 2;
    const matchLengths = [...xFirst.lengths, ...yFirst.lengths];

    wins.set(x.id, (wins.get(x.id) ?? 0) + xWins);
    wins.set(y.id, (wins.get(y.id) ?? 0) + yWins);
    games.set(x.id, (games.get(x.id) ?? 0) + played);
    games.set(y.id, (games.get(y.id) ?? 0) + played);
    draws += matchDraws;
    total += played;
    lengths.push(...matchLengths);
    worstShare = Math.min(worstShare, xWins / played, yWins / played);

    const label = `${x.name} vs ${y.name}`.padEnd(24);
    console.log(
      `  ${label} ${percent(xWins, played)} / ${percent(yWins, played)}  ${percent(matchDraws, played)}  ${median(matchLengths).toFixed(1).padStart(5)} s`,
    );
  }
});

console.log('\n  Mirror matches (not counted in the totals)');
for (const ball of BALLS) {
  const mirror = tally(ball, ball, seeds);
  const label = `${ball.name} vs ${ball.name}`.padEnd(24);
  console.log(
    `  ${label} ${percent(mirror.a, seeds)} / ${percent(mirror.b, seeds)}  ${percent(mirror.draw, seeds)}  ${median(mirror.lengths).toFixed(1).padStart(5)} s`,
  );
}

console.log('\n  Overall win rate (non-mirror)');
let ballsInRange = true;
for (const ball of BALLS) {
  const rate = (wins.get(ball.id) ?? 0) / (games.get(ball.id) ?? 1);
  ballsInRange &&= rate >= TARGETS.ballWinRate[0] && rate <= TARGETS.ballWinRate[1];
  console.log(`  ${ball.name.padEnd(24)} ${percent(rate, 1)}`);
}

const drawRate = draws / total;
const medianLength = median(lengths);
console.log(`\n  ${'Draws'.padEnd(24)} ${percent(drawRate, 1)}`);
console.log(`  ${'Median match length'.padEnd(24)} ${medianLength.toFixed(1)} s\n`);

console.log('  Targets');
console.log(`  ${check(ballsInRange)} every ball wins 40-60% overall`);
console.log(
  `  ${check(worstShare >= TARGETS.worstMatchup)} no matchup worse than 25/75 (worst side ${percent(worstShare, 1).trim()})`,
);
console.log(`  ${check(drawRate < TARGETS.drawRate)} draws under 5%`);
console.log(
  `  ${check(medianLength >= TARGETS.medianSeconds[0] && medianLength <= TARGETS.medianSeconds[1])} median match 15-30 s`,
);
