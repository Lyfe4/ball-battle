// PROTOTYPE (proto/sound): how many sounds a whole match makes through the gate, at 1x and 2x, for
// the pairs with the most hits. Plays every tick as the arena does and times each on real time.
import { BALL_LOOKUP } from '../src/sim/balls/index.ts';
import { step } from '../src/sim/step.ts';
import { createWorld } from '../src/sim/world.ts';
import type { BallDefinition } from '../src/sim/types.ts';
import { cuesOf } from '../src/sound/cues.ts';
import { createGate } from '../src/sound/gate.ts';
import { FIGHT_RULES } from '../src/sound/rules.ts';

const PAIRS = [
  ['archer', 'venom'],
  ['quake', 'speedster'],
  ['venom', 'thorns'],
  ['hex', 'battery'],
  ['slime', 'archer'],
  ['necromancer', 'archer'],
] as const;
const SEEDS = 20;

function ballsOf(ids: readonly string[]): BallDefinition[] {
  return ids.map((id) => {
    const definition = BALL_LOOKUP.get(id);
    if (definition === undefined) throw new Error(`No ball ${id}`);
    return definition;
  });
}

for (const speed of [1, 2]) {
  console.log(`\n${String(speed)}x speed: wanted -> played per match; busiest second (played)`);
  for (const [a, b] of PAIRS) {
    let wanted = 0;
    let played = 0;
    let busiest = 0;
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const defs = ballsOf([a, b]);
      let world = createWorld(seed, defs);
      const gate = createGate(FIGHT_RULES);
      const times: number[] = [];
      while (world.match.status === 'running') {
        const result = step(world, BALL_LOOKUP);
        const cues = cuesOf(result.events, world, result.world);
        // The arena plays a frame's ticks together: 60 Hz frames, `speed` ticks per frame at 2x.
        const nowMs = Math.floor(result.world.tick / speed) * (1000 / 60);
        const gains = gate.pass(cues, nowMs);
        wanted += cues.length;
        for (const gain of gains) if (gain > 0) times.push(nowMs);
        world = result.world;
      }
      played += times.length;
      for (let i = 0; i < times.length; i += 1) {
        let j = i;
        while (j < times.length && (times[j] ?? 0) - (times[i] ?? 0) < 1000) j += 1;
        busiest = Math.max(busiest, j - i);
      }
    }
    console.log(
      `  ${`${a} vs ${b}`.padEnd(24)} ${(wanted / SEEDS).toFixed(0).padStart(4)} -> ${(played / SEEDS).toFixed(0).padStart(4)}   busiest second ${String(busiest)}`,
    );
  }
}

// The streams the next balls would voice, through a gate rule like the Archer's arrows.
const STREAMS = [
  [
    'quake',
    'speedster',
    (e: { type: string; ballId?: string; hook?: string }) =>
      e.type === 'abilityTriggered' && e.hook === 'onWallHit',
  ],
  [
    'venom',
    'brawler',
    (e: { type: string; via?: string }) => e.type === 'damage' && e.via === 'poison',
  ],
] as const;
console.log(
  '\nFuture streams at 2x (gap 90 ms, run 400 ms): raw -> played per match; busiest second raw / played',
);
for (const [a, b, isOne] of STREAMS) {
  let raw = 0;
  let played = 0;
  let busyRaw = 0;
  let busyPlayed = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    let world = createWorld(seed, ballsOf([a, b]));
    const gate = createGate({ wave: { gapMs: 90, runMs: 400 } });
    const rawTimes: number[] = [];
    const times: number[] = [];
    while (world.match.status === 'running') {
      const result = step(world, BALL_LOOKUP);
      const nowMs = Math.floor(result.world.tick / 2) * (1000 / 60);
      const hits = result.events
        .filter((e) => isOne(e as never))
        .map(() => ({ kind: 'wave' as const, strength: 0.5 }));
      rawTimes.push(...hits.map(() => nowMs));
      for (const gain of gate.pass(hits, nowMs)) if (gain > 0) times.push(nowMs);
      world = result.world;
    }
    raw += rawTimes.length;
    played += times.length;
    const busiest = (list: number[]) =>
      list.reduce(
        (most, at, i) => Math.max(most, list.slice(i).filter((t) => t - at < 1000).length),
        0,
      );
    busyRaw = Math.max(busyRaw, busiest(rawTimes));
    busyPlayed = Math.max(busyPlayed, busiest(times));
  }
  console.log(
    `  ${`${a} vs ${b}`.padEnd(24)} ${(raw / SEEDS).toFixed(0).padStart(4)} -> ${(played / SEEDS).toFixed(0).padStart(4)}   busiest second ${String(busyRaw)} / ${String(busyPlayed)}`,
  );
}
