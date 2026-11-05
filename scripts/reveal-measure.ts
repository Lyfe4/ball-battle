// Measures what the player's choices are worth in Reveal, before and after ADR 0021
// (docs/reveal-measurements.md). Plays every ordered pair from the player's slot (A) to get each
// round's odds, then computes every pair of lineups exactly (reveal-analysis.ts).
//   node scripts/reveal-measure.ts [seeds=200] [--rates file.json] [--save file.json]
// --rates reuses a saved measurement instead of playing matches (about 11 ms a match, so 200 seeds
// is about 24,000 matches); --save writes the one just measured. Not part of CI.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BALL_LOOKUP, BALLS } from '../src/sim/balls/index.ts';
import { getDefinition } from '../src/sim/definitions.ts';
import { deriveSeed } from '../src/sim/rng.ts';
import { playToEnd } from '../src/sim/series.ts';
import { createWorld } from '../src/sim/world.ts';
import { mapOdds, simultaneous, summarise, takeTurns, type Odds } from './reveal-analysis.ts';

type Rates = Record<string, Record<string, number>>;

/** Each ordered pair's round odds for slot A, draws as half, over `seeds` seeds of its own salt. */
function measure(seeds: number): Rates {
  const ids = BALLS.map((ball) => ball.id);
  const rates: Rates = {};
  for (const a of ids) {
    const row: Record<string, number> = {};
    for (const b of ids) {
      let score = 0;
      for (let s = 0; s < seeds; s++) {
        const definitions = [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)];
        const end = playToEnd(createWorld(deriveSeed([0x5e9, s]), definitions), BALL_LOOKUP);
        if (end.match.status !== 'finished') throw new Error('A match ended without a result');
        const result = end.match.result;
        if (result.kind === 'draw') score += 0.5;
        else if (result.winnerId === end.balls[0]?.id) score += 1;
      }
      row[b] = score / seeds;
    }
    rates[a] = row;
  }
  return rates;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { rates: { type: 'string' }, save: { type: 'string' } },
});
const seeds = Number(positionals[0] ?? 200);
const started = Date.now();
const rates: Rates =
  values.rates === undefined
    ? measure(seeds)
    : (JSON.parse(readFileSync(values.rates, 'utf8')) as Rates);
if (values.save !== undefined) writeFileSync(values.save, JSON.stringify(rates));
const measured: Odds = (a, b) => rates[a]?.[b] ?? 0.5;

const roster = BALLS.map((ball) => ball.id);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const pts = (x: number) => `${(100 * x).toFixed(1)} pts`;
for (const [label, odds] of [
  ['Counter-map odds (favoured 64%, even 50%, unfavoured 36%)', mapOdds],
  ['Measured odds', measured],
] as const) {
  console.log(`\n${label}`);
  for (const [name, rule] of [
    ['Before ADR 0021: both orders secret', simultaneous],
    ['ADR 0021: take turns (bot answers with its best counter)', takeTurns],
  ] as const) {
    const s = summarise(rule, roster, odds);
    console.log(
      `  ${name}: best play ${pct(s.best)}, worst ${pct(s.worst)}, gap ${pts(s.best - s.worst)}; ` +
        `choices move the odds by 3+ pts in ${pct(s.matters)} of ${String(s.pairs)} lineup pairs`,
    );
  }
}
console.error(`${((Date.now() - started) / 1000).toFixed(1)} s`);
