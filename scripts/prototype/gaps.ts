// node gaps.ts <root> <seeds> <out.json> [pair,pair...|all] — no-contact stretches per pair.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [root, seedsArg, outFile, pairArg] = process.argv.slice(2) as [string, string, string, string?];
const { runPool } = await import(pathToFileURL('C:/Projects/BattleBall/scripts/worker-pool.ts').href);
const { BALLS } = await import(pathToFileURL(`${root}/src/sim/balls/index.ts`).href);
const seeds = Number(seedsArg);

export const SHOOTERS = ['archer', 'sniper', 'boomerang', 'spartan', 'storm'];
export const AREA = ['quake', 'inferno', 'bomber', 'necromancer'];
const kindOf = (id: string) => (SHOOTERS.includes(id) ? 'shooter' : AREA.includes(id) ? 'area' : 'contact');
const groupOf = (p: string, q: string) => {
  const k = [kindOf(p), kindOf(q)];
  return k.includes('shooter') ? 'has shooter' : k.includes('area') ? 'contact + area' : 'contact only';
};

const ids: string[] = BALLS.map((b: any) => b.id);
let pairs = ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y] as [string, string]));
if (pairArg !== undefined && pairArg !== 'all') {
  const want = pairArg.split(',').map((s) => s.split('-').sort().join('-'));
  pairs = pairs.filter(([x, y]) => want.includes([x, y].sort().join('-')));
}
const SLICE = 50;
const tasks = pairs.flatMap(([p, q]) =>
  Array.from({ length: Math.ceil(seeds / SLICE) }, (_, s) => ({
    root, p, q, firstSeed: s * SLICE, endSeed: Math.min(seeds, (s + 1) * SLICE),
  })),
);
const t0 = Date.now();
const results: any[] = await runPool(new URL('./gaps-worker.ts', import.meta.url), tasks);
console.error(`elapsed ${((Date.now() - t0) / 1000).toFixed(0)} s`);

const byPair = new Map<string, any>();
results.forEach((r, i) => {
  const t = tasks[i]!;
  const key = `${t.p}-${t.q}`;
  const acc = byPair.get(key) ?? {
    p: t.p, q: t.q, group: groupOf(t.p, t.q), games: 0, ticks: 0, contacts: 0, winsP: 0, draws: 0,
    longestContact: [], longestQuiet: [], lengths: [], gapsContact: 0, ticksInGaps: 0, gapsQuiet: 0,
    bothAxisTicks: 0, bothAxisInGap: 0, sameWayTicks: 0, sameWayInGap: 0, sameAxisTicks: 0, sameAxisIn5: 0, sameAxisIn15: 0, ticksIn15: 0, gaps15: 0, timeouts: 0, worst: { ticks: 0 },
  };
  for (const k of ['games', 'ticks', 'contacts', 'winsP', 'draws', 'gapsContact', 'ticksInGaps', 'gapsQuiet', 'bothAxisTicks', 'bothAxisInGap', 'sameWayTicks', 'sameWayInGap', 'sameAxisTicks', 'sameAxisIn5', 'sameAxisIn15', 'ticksIn15', 'gaps15', 'timeouts'])
    acc[k] += r[k];
  acc.longestContact.push(...r.longestContact);
  acc.longestQuiet.push(...r.longestQuiet);
  acc.lengths.push(...r.lengths);
  if (r.worst.ticks > acc.worst.ticks) acc.worst = r.worst;
  byPair.set(key, acc);
});

const q = (xs: number[], f: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(f * (s.length - 1))] ?? 0;
};
const sec = (t: number) => t / 60;
const rows = [...byPair.values()].map((a) => ({
  pair: `${a.p} vs ${a.q}`,
  group: a.group,
  games: a.games,
  winP: a.winsP / a.games,
  draws: a.draws / a.games,
  medianS: sec(q(a.lengths, 0.5)),
  // share of games with a 5 s+ no-contact stretch
  gameShare5: a.longestContact.filter((t: number) => t >= 300).length / a.games,
  gameShare10: a.longestContact.filter((t: number) => t >= 600).length / a.games,
  quietShare5: a.longestQuiet.filter((t: number) => t >= 300).length / a.games,
  stretchesPerGame: a.gapsContact / a.games,
  timeInGaps: a.ticksInGaps / a.ticks,
  p95LongestS: sec(q(a.longestContact, 0.95)),
  worstS: sec(a.worst.ticks),
  worstSeed: a.worst.seed,
  worstSlot: a.worst.pSlot,
  worstQuietS: sec(Math.max(...a.longestQuiet)),
  contactsPerMin: a.contacts / (a.ticks / 3600),
  bothAxisShare: a.bothAxisTicks / a.ticks,
  sameAxisShare: a.sameAxisTicks / a.ticks,
  sameAxisIn5Share: a.ticksInGaps > 0 ? a.sameAxisIn5 / a.ticksInGaps : 0,
  sameAxisIn15Share: a.ticksIn15 > 0 ? a.sameAxisIn15 / a.ticksIn15 : 0,
  ticksIn15: a.ticksIn15, sameAxisIn15: a.sameAxisIn15, gaps15PerGame: a.gaps15 / a.games, timeouts: a.timeouts / a.games,
  sameWayShare: a.sameWayTicks / a.ticks,
  sameWayInGapShare: a.ticksInGaps > 0 ? a.sameWayInGap / a.ticksInGaps : 0,
  bothAxisInGapShare: a.ticksInGaps > 0 ? a.bothAxisInGap / a.ticksInGaps : 0,
}));
writeFileSync(outFile, JSON.stringify({ root, seeds, rows }, null, 1));

const groups = ['contact only', 'contact + area', 'has shooter'];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
for (const g of groups) {
  const rs = rows.filter((r) => r.group === g);
  if (rs.length === 0) continue;
  const games = rs.reduce((s, r) => s + r.games, 0);
  const w = (f: (r: any) => number) => rs.reduce((s, r) => s + f(r) * r.games, 0) / games;
  console.log(
    `${g.padEnd(15)} pairs ${String(rs.length).padStart(3)}  games w/ 5s+ gap ${pct(w((r) => r.gameShare5))}  10s+ ${pct(w((r) => r.gameShare10))}  quiet 5s+ ${pct(w((r) => r.quietShare5))}  time in gaps ${pct(w((r) => r.timeInGaps))}  worst ${Math.max(...rs.map((r) => r.worstS)).toFixed(1)} s  median ${w((r) => r.medianS).toFixed(1)} s  contacts/min ${w((r) => r.contactsPerMin).toFixed(1)}  both-on-axis ${pct(w((r) => r.bothAxisShare))} (in gaps ${pct(w((r) => r.bothAxisInGapShare))})  same-way ${pct(w((r) => r.sameWayShare))} (in gaps ${pct(w((r) => r.sameWayInGapShare))})  same-axis ${pct(w((r) => r.sameAxisShare))} in 5s+ ${pct(w((r) => r.sameAxisIn5Share))} in 15s+ ${pct(rs.reduce((s, r) => s + r.sameAxisIn15, 0) / Math.max(1, rs.reduce((s, r) => s + r.ticksIn15, 0)))}  15s+/game ${w((r) => r.gaps15PerGame).toFixed(3)}  timeouts ${pct(w((r) => r.timeouts))}`,
  );
}
console.log('\nworst 15 pairs by share of games with a 5 s+ no-contact stretch:');
for (const r of [...rows].sort((a, b) => b.gameShare5 - a.gameShare5).slice(0, 15))
  console.log(
    `  ${r.pair.padEnd(26)} ${r.group.padEnd(15)} 5s+ ${pct(r.gameShare5).padStart(6)}  10s+ ${pct(r.gameShare10).padStart(6)}  p95 ${r.p95LongestS.toFixed(1)} s  worst ${r.worstS.toFixed(1)} s (seed ${r.worstSeed} slot ${r.worstSlot})  win ${pct(r.winP)}`,
  );
