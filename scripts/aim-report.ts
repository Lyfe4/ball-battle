// Prints the aiming measurements as Markdown tables (docs/aiming-measurements.md).
// Usage: node scripts/aim-report.ts <dir>   (reads baseline, directions, evaluate .json there)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BALLS } from '../src/sim/balls/index.ts';
import { add, EMPTY, rate, summarise, type Tally } from './aim-analysis.ts';
import { directionHalves, get, index, readRows } from './aim-data.ts';
import { DIRECTIONS } from './aim-play.ts';
import { checkCounter, counterFor, type CounterVerdict } from './counter-map.ts';

const dir = process.argv[2];
if (dir === undefined) {
  console.error('Usage: node scripts/aim-report.ts <dir>');
  process.exit(1);
}
const file = (name: string) => join(dir, `${name}.json`);
const ids = BALLS.map((ball) => ball.id);
const nameOf = (id: string) => BALLS.find((ball) => ball.id === id)?.name ?? id;
const pairs = ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y] as const));
const pts = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}`;
const pct = (value: number) => (value * 100).toFixed(1);
const angles = Array.from({ length: DIRECTIONS / 2 + 1 }, (_, k) => (k * 360) / DIRECTIONS);
const LABEL: Readonly<Record<CounterVerdict, string>> = {
  ok: 'ok',
  warn: 'WARN',
  near: 'NEAR',
  miss: '**MISS**',
};

/** The counter-map verdict for P's rate and Q's rate against each other. */
function verdict(p: string, q: string, pTally: Tally): { text: string; verdict: CounterVerdict } {
  const entry = counterFor(p, q);
  if (entry === undefined) return { text: '?', verdict: 'miss' };
  const pRate = rate(pTally);
  const qRate = pTally.games === 0 ? NaN : pTally.losses / pTally.games;
  const [xRate, yRate] = entry.x === p ? [pRate, qRate] : [qRate, pRate];
  const v = checkCounter(entry, xRate, yRate);
  const intended =
    entry.intended === 'even' ? 'even' : nameOf(entry.intended === 'x' ? entry.x : entry.y);
  return { text: `${intended}: ${LABEL[v]}`, verdict: v };
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): void {
  console.log(`| ${header.join(' | ')} |`);
  console.log(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows) console.log(`| ${row.join(' | ')} |`);
  console.log('');
}

const count = (verdicts: readonly CounterVerdict[]) =>
  (['ok', 'warn', 'near', 'miss'] as const)
    .map((v) => `${v} ${verdicts.filter((x) => x === v).length}`)
    .join(', ');

// 1. Baseline, when it has been run (the start-spot variants have none).
if (existsSync(file('baseline'))) reportBaseline();

function reportBaseline(): void {
  const baseline = index(readRows(file('baseline')), ['p', 'q', 'start']);
  console.log('## 1. Baseline: fixed spots, random aim\n');
  const shifts: number[] = [];
  const baseVerdicts: CounterVerdict[] = [];
  const aimedVerdicts: CounterVerdict[] = [];
  table(
    ['Pair', 'Random start', 'Fixed spots', 'Shift', 'Map (random start)', 'Map (fixed spots)'],
    pairs.map(([p, q]) => {
      const before = get(baseline, p, q, 'random');
      const after = get(baseline, p, q, 'aimed');
      shifts.push(rate(after) - rate(before));
      const b = verdict(p, q, before);
      const a = verdict(p, q, after);
      baseVerdicts.push(b.verdict);
      aimedVerdicts.push(a.verdict);
      return [
        `${nameOf(p)} vs ${nameOf(q)}`,
        pct(rate(before)),
        pct(rate(after)),
        pts(rate(after) - rate(before)),
        b.text,
        a.text,
      ];
    }),
  );
  const absShifts = shifts.map(Math.abs);
  console.log(
    `Mean |shift| ${pct(absShifts.reduce((s, v) => s + v, 0) / absShifts.length)} pts, max ${pct(Math.max(...absShifts))} pts, ${absShifts.filter((v) => v > 0.05).length} pairs over 5 pts. Verdicts, random start: ${count(baseVerdicts)}; fixed spots: ${count(aimedVerdicts)}.\n`,
  );
  const perBall = (start: string) =>
    ids.map((id) => {
      let total = EMPTY;
      for (const [p, q] of pairs) {
        const t = get(baseline, p, q, start);
        if (p === id) total = add(total, t);
        if (q === id) total = add(total, { wins: t.losses, losses: t.wins, games: t.games });
      }
      return rate(total);
    });
  const ballBefore = perBall('random');
  const ballAfter = perBall('aimed');
  table(
    ['Ball', 'Random start', 'Fixed spots'],
    ids.map((id, i) => [nameOf(id), pct(ballBefore[i] ?? NaN), pct(ballAfter[i] ?? NaN)]),
  );
}

// 2, 3 and the cone: directions against random aim, when they have been run.
if (existsSync(file('directions'))) reportDirections();

function reportDirections(): void {
  const directions = index(readRows(file('directions')), ['p', 'q', 'aim', 'half']);
  console.log('## 2. How much aim matters (first ball aims, second aims randomly)\n');
  const summaries = new Map<
    string,
    ReturnType<typeof summarise> & {
      reference: number;
      measured: number;
      straight: number;
      perAngle: number[];
    }
  >();
  for (const p of ids) {
    for (const q of ids) {
      const { halves, reference, measuredRandom } = directionHalves(directions, p, q);
      const summary = summarise(halves, reference);
      const ref = rate(add(reference[0], reference[1]));
      const perAngle = halves[0].map((t, k) => rate(add(t, halves[1][k] ?? EMPTY)) - ref);
      summaries.set(`${p}|${q}`, {
        ...summary,
        reference: ref,
        measured: rate(measuredRandom),
        straight: perAngle[0] ?? NaN,
        perAngle,
      });
    }
  }
  const all = [...summaries.values()];
  table(
    [
      'Aiming ball',
      'vs',
      'Random aim',
      'Best angle',
      'Gain',
      'Spread',
      'Straight at it (0°)',
      'Worst angle',
    ],
    ids.flatMap((p) =>
      ids.map((q) => {
        const s = summaries.get(`${p}|${q}`);
        if (s === undefined) return [];
        return [
          nameOf(p),
          nameOf(q),
          pct(s.reference),
          `${angles[s.best]}°`,
          pts(s.gain),
          pct(s.spread),
          pts(s.straight),
          `${angles[s.worst]}°`,
        ];
      }),
    ),
  );
  const gains = all.map((s) => s.gain);
  const spreads = all.map((s) => s.spread);
  console.log(
    `Gain (best angle chosen on one seed half, measured on the other): median ${pts(gains.sort((a, b) => a - b)[Math.floor(gains.length / 2)] ?? NaN)}, ${gains.filter((g) => g >= 0.05).length} of ${gains.length} ordered matchups at +5 or more, max ${pts(Math.max(...gains))}. Spread: median ${pct(spreads.sort((a, b) => a - b)[Math.floor(spreads.length / 2)] ?? NaN)}, ${spreads.filter((v) => v > 0.15).length} over 15, ${spreads.filter((v) => v > 0.2).length} over 20, max ${pct(Math.max(...spreads))}.\n`,
  );
  const drift = all.map((s) => Math.abs(s.measured - s.reference));
  console.log(
    `Cross-check: measured random aim (300 games) against the every-direction average: mean difference ${pct(drift.reduce((sum, v) => sum + v, 0) / drift.length)} pts, max ${pct(Math.max(...drift))} (noise alone gives about 2.3 and 7).\n`,
  );

  console.log('## 3. Is there a solved angle?\n');
  const agree = all.filter((s) => s.bestByHalf[0] === s.bestByHalf[1]).length;
  console.log(`Best angle the same on both seed halves: ${agree} of ${all.length} matchups.\n`);
  table(
    ['Ball', ...angles.map((a) => `${a}°`), 'Best overall', 'Opponents where it is best'],
    ids.map((p) => {
      const rows = ids.map((q) => summaries.get(`${p}|${q}`));
      const mean = angles.map(
        (_, k) => rows.reduce((sum, s) => sum + (s?.perAngle[k] ?? 0), 0) / rows.length,
      );
      const best = mean.indexOf(Math.max(...mean));
      const sharing = rows.filter((s) => s?.best === best).length;
      return [nameOf(p), ...mean.map(pts), `${angles[best]}°`, `${sharing} / ${rows.length}`];
    }),
  );
  const bestCounts = angles.map((_, k) => all.filter((s) => s.best === k).length);
  console.log(
    `Best angle across all ${all.length} matchups: ${angles.map((a, k) => `${a}° ${bestCounts[k]}`).join(', ')}.\n`,
  );
  const straightRanks = all.map(
    (s) => [...s.perAngle].sort((a, b) => b - a).indexOf(s.straight) + 1,
  );
  console.log(
    `Straight at the opponent (0°): mean gain ${pts(all.reduce((sum, s) => sum + s.straight, 0) / all.length)}, best in ${bestCounts[0]} matchups, median rank ${[...straightRanks].sort((a, b) => a - b)[Math.floor(straightRanks.length / 2)]} of ${angles.length}.\n`,
  );

  // Mitigation: only directions within a forward cone are allowed.
  console.log('## Cone: aim limited to within ±C° of straight at the opponent\n');
  table(
    [
      'Cone',
      'Median gain',
      'Gain +5 or more',
      'Max gain',
      'Median spread',
      'Spread over 15',
      'Max spread',
    ],
    [45, 60, 90, 180].map((cone) => {
      const last = cone / (360 / DIRECTIONS);
      const coned = ids.flatMap((p) =>
        ids.map((q) => {
          const { halves } = directionHalves(directions, p, q);
          const inCone = halves.map((half) => half.slice(0, last + 1)) as [Tally[], Tally[]];
          const reference = inCone.map((half) => half.reduce(add, EMPTY)) as [Tally, Tally];
          return summarise(inCone, reference);
        }),
      );
      const g = coned.map((s) => s.gain).sort((a, b) => a - b);
      const sp = coned.map((s) => s.spread).sort((a, b) => a - b);
      return [
        `±${cone}°`,
        pts(g[Math.floor(g.length / 2)] ?? NaN),
        `${g.filter((v) => v >= 0.05).length} / ${g.length}`,
        pts(Math.max(...g)),
        pct(sp[Math.floor(sp.length / 2)] ?? NaN),
        `${sp.filter((v) => v > 0.15).length}`,
        pct(Math.max(...sp)),
      ];
    }),
  );
}

// 4. Evaluation of strategy profiles on held-out seeds, once it has been run.
if (existsSync(file('evaluate'))) reportEvaluation();

function reportEvaluation(): void {
  const evaluation = index(readRows(file('evaluate')), ['p', 'q', 'strategy']);
  console.log('## 4. Counters under good aiming (held-out seeds)\n');
  const profiles = ['random', 'naive', 'nash'] as const;
  const verdicts = new Map<string, CounterVerdict[]>(profiles.map((name) => [name, []]));
  const habitGains: number[] = [];
  const solvedGains: number[] = [];
  const shifts: number[] = [];
  table(
    [
      'Pair',
      'Random aim',
      'Both best angle',
      'Both solved',
      'Map (best angle)',
      'Map (solved)',
      'Exploit a habit',
      'Exploit the solved mix',
    ],
    pairs.map(([p, q]) => {
      const r = (name: string) => rate(get(evaluation, p, q, name));
      for (const name of profiles)
        verdicts.get(name)?.push(verdict(p, q, get(evaluation, p, q, name)).verdict);
      // What the better-placed side gains by best-responding: P's rate going up, or Q's (P's going
      // down). Held-out seeds, so a "best response" that was only matrix noise shows no gain.
      const habit = Math.max(r('brP-naive') - r('naive'), r('naive') - r('brQ-naive'));
      const solved = Math.max(r('brP-nash') - r('nash'), r('nash') - r('brQ-nash'));
      habitGains.push(habit);
      solvedGains.push(solved);
      shifts.push(Math.abs(r('nash') - r('random')));
      return [
        `${nameOf(p)} vs ${nameOf(q)}`,
        pct(r('random')),
        pct(r('naive')),
        pct(r('nash')),
        verdict(p, q, get(evaluation, p, q, 'naive')).text,
        verdict(p, q, get(evaluation, p, q, 'nash')).text,
        pts(habit),
        pts(solved),
      ];
    }),
  );
  for (const name of profiles)
    console.log(`Verdicts, ${name}: ${count(verdicts.get(name) ?? [])}.`);
  const describe = (values: readonly number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const over = (limit: number) => values.filter((v) => v > limit).length;
    return `median ${pts(sorted[Math.floor(sorted.length / 2)] ?? NaN)}, ${over(0.15)} over 15, ${over(0.2)} over 20, max ${pts(Math.max(...values))}`;
  };
  console.log(`\nExploiting a habitual angle: ${describe(habitGains)}.`);
  console.log(`Exploiting the solved mix: ${describe(solvedGains)}.`);
  console.log(`Solved against random aim, |shift|: ${describe(shifts)}.\n`);
}
