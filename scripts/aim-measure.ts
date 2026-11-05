// Plays the aiming measurements (docs/aiming-measurements.md) across all cores and writes the raw
// counts as JSON for aim-report.ts. Measurement only: nothing in the game changes.
// Usage: node scripts/aim-measure.ts <experiment> --out <file> [--seeds N] [--wobble D]
//                                    [--strategies <file>]
//   baseline    every pair, both sides aiming randomly from the fixed spots, and today's random
//               start on the same seeds (default 500 seeds per slot order)
//   directions  every ordered pair (mirrors too): the first ball tries each of the 24 directions,
//               the second aims randomly; seeds split into two halves (default 300)
//   matrix      every pair: all 24 x 24 direction pairs (default 16 seeds)
//   evaluate    the strategy profiles in --strategies on held-out seeds 10000.. (default 500)
//   --wobble D  turn every launch by a seeded random angle up to D degrees either way
//   --start-x X stand side A X units from its wall (side B mirrored) instead of the sim's 250
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BALLS } from '../src/sim/balls/index.ts';
import {
  DIRECTIONS,
  PLAIN,
  type AimResult,
  type AimSpec,
  type AimTask,
  type Strategy,
} from './aim-play.ts';
import { runPool } from './worker-pool.ts';

/** Held-out seeds for evaluation start here, far from every seed used to choose a strategy. */
export const EVALUATION_SEED = 10_000;
/** Seeds per task: small enough to spread evenly over the cores. */
const SLICE = 50;

export interface Labelled {
  /** What the task measured, for the report: experiment-specific keys. */
  readonly label: Readonly<Record<string, string | number>>;
  readonly task: AimTask;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    seeds: { type: 'string' },
    wobble: { type: 'string', default: '0' },
    'start-x': { type: 'string' },
    strategies: { type: 'string' },
  },
});
const experiment = positionals[0];
if (values.out === undefined || experiment === undefined) {
  console.error('Usage: node scripts/aim-measure.ts <experiment> --out <file> [--seeds N]');
  process.exit(1);
}
const startX = values['start-x'] === undefined ? undefined : Number(values['start-x']);
const variant = { ...PLAIN, wobbleDegrees: Number(values.wobble), startX };
const ids = BALLS.map((ball) => ball.id);
const pairs = ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y] as const));
const random: AimSpec = { kind: 'random' };
const dir = (index: number): AimSpec => ({ kind: 'dir', index });

/** Tasks over seeds first..end-1, in slices, each carrying its label. */
function sliced(
  label: Labelled['label'],
  base: Omit<AimTask, 'firstSeed' | 'endSeed'>,
  first: number,
  end: number,
): Labelled[] {
  const out: Labelled[] = [];
  for (let from = first; from < end; from += SLICE) {
    out.push({ label, task: { ...base, firstSeed: from, endSeed: Math.min(end, from + SLICE) } });
  }
  return out;
}

function tasksFor(name: string): Labelled[] {
  switch (name) {
    case 'baseline': {
      const seeds = Number(values.seeds ?? 500);
      return pairs.flatMap(([p, q]) => [
        ...sliced(
          { p, q, start: 'aimed' },
          { p, q, aimP: random, aimQ: random, variant },
          0,
          seeds,
        ),
        ...sliced(
          { p, q, start: 'random' },
          { p, q, aimP: random, aimQ: random, variant: { ...variant, randomStart: true } },
          0,
          seeds,
        ),
      ]);
    }
    case 'directions': {
      const seeds = Number(values.seeds ?? 300);
      const half = Math.floor(seeds / 2);
      const aims: readonly (readonly [string | number, AimSpec])[] = [
        ...Array.from({ length: DIRECTIONS }, (_, index) => [index, dir(index)] as const),
        ['random', random] as const,
      ];
      return ids.flatMap((p) =>
        ids.flatMap((q) =>
          aims.flatMap(([aim, spec]) => [
            ...sliced({ p, q, aim, half: 0 }, { p, q, aimP: spec, aimQ: random, variant }, 0, half),
            ...sliced(
              { p, q, aim, half: 1 },
              { p, q, aimP: spec, aimQ: random, variant },
              half,
              seeds,
            ),
          ]),
        ),
      );
    }
    case 'matrix': {
      const seeds = Number(values.seeds ?? 16);
      return pairs.flatMap(([p, q]) =>
        Array.from({ length: DIRECTIONS * DIRECTIONS }, (_, cell) => {
          const i = Math.floor(cell / DIRECTIONS);
          const j = cell % DIRECTIONS;
          return sliced({ p, q, i, j }, { p, q, aimP: dir(i), aimQ: dir(j), variant }, 0, seeds);
        }).flat(),
      );
    }
    case 'evaluate': {
      if (values.strategies === undefined) throw new Error('evaluate needs --strategies <file>');
      const seeds = Number(values.seeds ?? 500);
      const strategies = JSON.parse(readFileSync(values.strategies, 'utf8')) as Strategy[];
      return strategies.flatMap(({ p, q, name: strategy, aimP, aimQ }) =>
        sliced(
          { p, q, strategy },
          { p, q, aimP, aimQ, variant },
          EVALUATION_SEED,
          EVALUATION_SEED + seeds,
        ),
      );
    }
    default:
      throw new Error(`Unknown experiment "${name}"`);
  }
}

const labelled = tasksFor(experiment);
const started = performance.now();
let lastReport = 0;
const results = await runPool<AimResult>(
  new URL('./aim-worker.ts', import.meta.url),
  labelled.map(({ task }) => task),
  (done, total) => {
    const now = performance.now();
    if (now - lastReport > 30_000 || done === total) {
      lastReport = now;
      console.error(`  ${done}/${total} tasks, ${((now - started) / 1000).toFixed(0)} s`);
    }
  },
);

// Merge slices with the same label.
const merged = new Map<string, { label: Labelled['label']; result: AimResult }>();
labelled.forEach(({ label }, index) => {
  const key = JSON.stringify(label);
  const result = results[index];
  if (result === undefined) return;
  const existing = merged.get(key);
  merged.set(key, {
    label,
    result:
      existing === undefined
        ? result
        : {
            winsP: existing.result.winsP + result.winsP,
            winsQ: existing.result.winsQ + result.winsQ,
            draws: existing.result.draws + result.draws,
            games: existing.result.games + result.games,
            ticks: existing.result.ticks + result.ticks,
          },
  });
});
writeFileSync(
  values.out,
  JSON.stringify({ experiment, variant, rows: [...merged.values()] }, undefined, 0),
);
console.error(
  `  ${experiment}: ${merged.size} rows in ${((performance.now() - started) / 1000).toFixed(0)} s`,
);
