// Runs many matches headlessly with the real simulation and prints balance statistics.
// Usage: pnpm balance [seeds]   (default 1000; seeds 0..N-1, so results are reproducible)
import { blue } from '../src/sim/balls/blue.ts';
import { red } from '../src/sim/balls/red.ts';
import { MATCH_TIME_LIMIT_TICKS, TICK_RATE } from '../src/sim/constants.ts';
import { indexDefinitions } from '../src/sim/definitions.ts';
import { step } from '../src/sim/step.ts';
import type { BallDefinition, MatchState, WorldState } from '../src/sim/types.ts';
import { createWorld } from '../src/sim/world.ts';

const DEFAULT_SEEDS = 1000;
const roster: readonly BallDefinition[] = [red, blue];

type Finished = Extract<MatchState, { status: 'finished' }>;

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

function playMatch(seed: number): Finished {
  const definitions = indexDefinitions(roster);
  let world: WorldState = createWorld(seed, roster);
  // The time limit guarantees an end; the extra tick only guards against a sim bug looping forever.
  for (let i = 0; i <= MATCH_TIME_LIMIT_TICKS && world.match.status === 'running'; i++) {
    world = step(world, definitions).world;
  }
  if (world.match.status !== 'finished') {
    throw new Error(`Seed ${seed} did not finish within the time limit`);
  }
  return world.match;
}

function percent(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(1)}%`.padStart(6);
}

function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

const seeds = parseSeedCount(process.argv[2]);
const wins = new Map<string, number>();
let draws = 0;
let knockouts = 0;
const lengths: number[] = [];

for (let seed = 0; seed < seeds; seed++) {
  const match = playMatch(seed);
  if (match.result.kind === 'draw') {
    draws++;
  } else {
    wins.set(match.result.winnerId, (wins.get(match.result.winnerId) ?? 0) + 1);
  }
  if (match.reason === 'knockout') knockouts++;
  lengths.push(match.endTick / TICK_RATE);
}

lengths.sort((a, b) => a - b);
const mean = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;

console.log(`BallBattle balance: ${seeds} matches (seeds 0-${seeds - 1})\n`);
roster.forEach((definition, index) => {
  const label = `${definition.name} (ball-${index})`.padEnd(16);
  console.log(`  ${label} ${percent(wins.get(`ball-${index}`) ?? 0, seeds)} wins`);
});
console.log(`  ${'Draw'.padEnd(16)} ${percent(draws, seeds)}\n`);
console.log(`  Knockout         ${percent(knockouts, seeds)}`);
console.log(`  Time limit       ${percent(seeds - knockouts, seeds)}\n`);
console.log(`  Match length     median ${median(lengths).toFixed(1)} s, mean ${mean.toFixed(1)} s`);
console.log(
  `                   min ${(lengths[0] ?? 0).toFixed(1)} s, max ${(lengths.at(-1) ?? 0).toFixed(1)} s`,
);
