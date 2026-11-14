// Proto only: measures a Bloom/Glitch variant against the roster, with every other pair read from a
// baseline file, and prints each ball's shape against the proposed exceptions.
// node scripts/bloom-glitch/tune.ts <seeds> '<variant json>' [--focus bloom,glitch] [--baseline file]
// node scripts/bloom-glitch/tune.ts <seeds> '{}' --make-baseline file
import { readFileSync, writeFileSync } from 'node:fs';
import { BALLS } from '../../src/sim/balls/index.ts';
import { runPool } from '../worker-pool.ts';
import type { Variant } from './variants.ts';

const args = process.argv.slice(2);
const seeds = Number(args[0]);
const variant = JSON.parse(args[1] ?? '{}') as Variant;
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const makeBaseline = opt('--make-baseline');
const focus = (opt('--focus') ?? 'bloom,glitch').split(',');
const baselineFile = opt('--baseline') ?? 'scripts/bloom-glitch/runs/baseline-500.json';
const without = (opt('--without') ?? '').split(',');
const ids = BALLS.map((b) => b.id).filter((id) => !without.includes(id));

type Pair = readonly [string, string];
const allPairs: Pair[] = ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y] as const));
const pairs = makeBaseline
  ? allPairs.filter(([x, y]) => !focus.includes(x) && !focus.includes(y))
  : allPairs.filter(([x, y]) => focus.includes(x) || focus.includes(y));

const SLICE = 50;
const tasks = pairs.flatMap(([x, y]) =>
  Array.from({ length: Math.ceil(seeds / SLICE) }, (_, s) => ({
    x,
    y,
    variant,
    first: s * SLICE,
    end: Math.min(seeds, (s + 1) * SLICE),
  })),
);
interface R {
  wins: [number, number];
  draws: number;
  games: number;
  comebacks: number;
  lengths: number[];
  healed: [number, number];
}
const t0 = performance.now();
const results = await runPool<R>(new URL('./tune-worker.ts', import.meta.url), tasks);
console.error(`${((performance.now() - t0) / 1000).toFixed(0)} s`);

export interface PairStat {
  x: string;
  y: string;
  wins: [number, number];
  draws: number;
  games: number;
  comebacks: number;
  lengths: number[];
}
const merged = new Map<string, PairStat>();
tasks.forEach((t, i) => {
  const r = results[i];
  if (r === undefined) throw new Error('missing result');
  const key = `${t.x}|${t.y}`;
  const m = merged.get(key) ?? {
    x: t.x,
    y: t.y,
    wins: [0, 0],
    draws: 0,
    games: 0,
    comebacks: 0,
    lengths: [],
  };
  m.wins[0] += r.wins[0];
  m.wins[1] += r.wins[1];
  m.draws += r.draws;
  m.games += r.games;
  m.comebacks += r.comebacks;
  m.lengths.push(...r.lengths);
  merged.set(key, m);
});

if (makeBaseline) {
  writeFileSync(makeBaseline, JSON.stringify([...merged.values()]));
  console.log(`wrote ${merged.size} pairs`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(baselineFile, 'utf8')) as PairStat[];
const every = new Map<string, PairStat>(base.map((p) => [`${p.x}|${p.y}`, p]));
for (const [k, v] of merged) every.set(k, v);
const rate = (a: string, b: string): number => {
  const p = every.get(`${a}|${b}`);
  if (p) return p.wins[0] / p.games;
  const q = every.get(`${b}|${a}`);
  if (!q) throw new Error(`missing ${a} ${b}`);
  return q.wins[1] / q.games;
};

const EXC: Record<string, { fewest: number; most: number; within: number }> = {
  storm: { fewest: 1, most: 4, within: 1 },
  titan: { fewest: 1, most: 4, within: 1 },
  bomber: { fewest: 1, most: 4, within: 1 },
  berserker: { fewest: 2, most: 5, within: 3 },
  sniper: { fewest: 1, most: 4, within: 1 },
  quake: { fewest: 1, most: 4, within: 1 },
  vampire: { fewest: 1, most: 4, within: 3 },
};
const EVEN: Record<string, { beats: string[]; losesTo: string[] }> = {
  brawler: { beats: ['glitch'], losesTo: ['thorns'] },
  magnet: { beats: [], losesTo: ['thorns'] },
};
const short = (id: string): string => id.slice(0, 5);
const pct = (r: number): string => (r * 100).toFixed(1);
const problems: string[] = [];
const lines: string[] = [];
for (const id of ids) {
  const others = ids.filter((o) => o !== id);
  const rates = others.map((o) => [o, rate(id, o)] as const);
  const beats = rates.filter(([, r]) => r >= 0.62);
  const loses = others
    .map((o) => [o, 1 - rate(o, id)] as const)
    .filter(([o]) => rate(o, id) >= 0.62);
  const overall = rates.reduce((s, [, r]) => s + r, 0) / rates.length;
  let ok = '';
  const even = EVEN[id];
  if (even) {
    const same = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x) => b.includes(x));
    if (
      !same(
        beats.map(([o]) => o),
        even.beats,
      ) ||
      !same(
        loses.map(([o]) => o),
        even.losesTo,
      )
    )
      ok = 'EVEN-PICK';
  } else {
    const e = EXC[id] ?? { fewest: 2, most: 4, within: 1 };
    for (const c of [beats.length, loses.length]) if (c < e.fewest || c > e.most) ok = 'SHAPE';
    if (Math.abs(beats.length - loses.length) > e.within) ok = 'SHAPE';
  }
  if (overall < 0.45 || overall > 0.55) ok += ' OVERALL';
  if (ok) problems.push(`${id}: ${ok.trim()}`);
  if (focus.includes(id) || ok || args.includes('--all')) {
    lines.push(
      `${id.padEnd(11)} ${pct(overall)}% ${beats.length}-${loses.length} ${ok.padEnd(9)} beats ${beats.map(([o, r]) => `${short(o)} ${pct(r)}`).join(', ')} | loses ${loses.map(([o, r]) => `${short(o)} ${pct(1 - r)}`).join(', ')}`,
    );
  }
}
// The focus balls' full rows, and every pair's hard limits.
for (const f of focus.filter((id) => ids.includes(id))) {
  lines.push(
    `${f} row: ` +
      ids
        .filter((o) => o !== f)
        .map((o) => `${short(o)} ${pct(rate(f, o))}`)
        .join(' '),
  );
}
let worst = 1;
let worstPair = '';
let topCounter = 0;
let topPair = '';
let draws = 0;
let games = 0;
let comebacks = 0;
const lengths: number[] = [];
for (const p of every.values()) {
  if (!ids.includes(p.x) || !ids.includes(p.y)) continue;
  const a = p.wins[0] / p.games;
  const b = p.wins[1] / p.games;
  if (Math.min(a, b) < worst) {
    worst = Math.min(a, b);
    worstPair = `${p.x}|${p.y}`;
  }
  if (Math.max(a, b) > topCounter) {
    topCounter = Math.max(a, b);
    topPair = `${p.x}|${p.y}`;
  }
  draws += p.draws;
  games += p.games;
  comebacks += p.comebacks;
  lengths.push(...p.lengths);
}
lengths.sort((a, b) => a - b);
const thin = [
  'frost|berserker',
  'hex|inferno',
  'bloom|speedster',
  'titan|bloom',
  'titan|glitch',
  'brawler|glitch',
  'glitch|ghost',
].filter((k) => k.split('|').every((id) => ids.includes(id)));
lines.push(
  `thin: ${thin
    .map((k) => {
      const [a, b] = k.split('|') as [string, string];
      return `${k} ${pct(rate(a, b))}`;
    })
    .join(', ')}`,
);
lines.push(
  `worst side ${pct(worst)} (${worstPair}), top ${pct(topCounter)} (${topPair}), draws ${pct(draws / games)}%, comebacks ${pct(comebacks / games)}%, median ${lengths[Math.floor(lengths.length / 2)]?.toFixed(1)} s`,
);
lines.push(problems.length ? `OFF SHAPE: ${problems.join('; ')}` : 'all in shape');
console.log(`${JSON.stringify(variant)}\n${lines.join('\n')}`);
