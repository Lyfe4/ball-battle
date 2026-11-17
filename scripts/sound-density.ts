// How busy a fight sounds (ADR 0064): every pair of the roster, played tick by tick as the arena
// plays it, every cue through the gate on real time, at 1x and 2x. Prints the roster's typical
// match, the busiest pairs (sounds in their busiest second, and sounds a second over the match),
// and the share each gate rule held back. Not part of CI: a measurement for judging the mix.
//   node scripts/sound-density.ts [seeds=5]
import { BALLS, BALL_LOOKUP } from '../src/sim/balls/index.ts';
import { step } from '../src/sim/step.ts';
import { createWorld } from '../src/sim/world.ts';
import { cuesOf } from '../src/sound/cues.ts';
import { createGate } from '../src/sound/gate.ts';
import { FIGHT_RULES } from '../src/sound/rules.ts';

const SEEDS = Number(process.argv[2] ?? 5);

interface PairSound {
  readonly pair: string;
  /** Sounds played a second, over the whole match. */
  readonly rate: number;
  /** The most sounds played in any one second. */
  readonly busiest: number;
  /** Sounds wanted (before the gate) and played, per match. */
  readonly wanted: number;
  readonly played: number;
}

const quantile = (values: readonly number[], q: number): number => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
};

function measure(speed: number): PairSound[] {
  const results: PairSound[] = [];
  BALLS.forEach((a, i) => {
    for (const b of BALLS.slice(i)) {
      let wanted = 0;
      let played = 0;
      let seconds = 0;
      let busiest = 0;
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        let world = createWorld(seed, [a, b]);
        const gate = createGate(FIGHT_RULES);
        const times: number[] = [];
        while (world.match.status === 'running') {
          const result = step(world, BALL_LOOKUP);
          const cues = cuesOf(result.events, world, result.world);
          // The arena plays a frame's ticks together: 60 Hz frames, `speed` ticks a frame at 2x.
          const nowMs = Math.floor(result.world.tick / speed) * (1000 / 60);
          wanted += cues.length;
          for (const gain of gate.pass(cues, nowMs)) if (gain > 0) times.push(nowMs);
          world = result.world;
        }
        played += times.length;
        seconds += world.tick / 60 / speed;
        for (let start = 0, end = 0; start < times.length; start += 1) {
          while (end < times.length && (times[end] ?? 0) - (times[start] ?? 0) < 1000) end += 1;
          busiest = Math.max(busiest, end - start);
        }
      }
      results.push({
        pair: `${a.id} vs ${b.id}`,
        rate: played / seconds,
        busiest,
        wanted: wanted / SEEDS,
        played: played / SEEDS,
      });
    }
  });
  return results;
}

for (const speed of [1, 2]) {
  const results = measure(speed);
  const rates = results.map((one) => one.rate);
  const busiest = results.map((one) => one.busiest);
  console.log(
    `\n${String(speed)}x, ${String(results.length)} pairs x ${String(SEEDS)} seeds: sounds a second median ` +
      `${quantile(rates, 0.5).toFixed(1)}, p90 ${quantile(rates, 0.9).toFixed(1)}, max ${Math.max(...rates).toFixed(1)}; ` +
      `busiest second median ${String(quantile(busiest, 0.5))}, max ${String(Math.max(...busiest))}`,
  );
  console.log(
    '  busiest pairs: sounds in the busiest second, a second overall, wanted -> played a match',
  );
  for (const one of [...results]
    .sort((x, y) => y.busiest - x.busiest || y.rate - x.rate)
    .slice(0, 12)) {
    console.log(
      `  ${one.pair.padEnd(26)} ${String(one.busiest).padStart(3)}   ${one.rate.toFixed(1).padStart(4)}/s   ` +
        `${one.wanted.toFixed(0).padStart(4)} -> ${one.played.toFixed(0).padStart(4)}`,
    );
  }
}
