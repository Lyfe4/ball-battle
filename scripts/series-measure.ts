// Measures what the player's choices are worth against each bot level, in Reveal and Showdown
// (docs/series-measurements.md, ADR 0035). Exact over evenly spaced lineup pairs with
// series-analysis.ts, using counter-map odds and, with --rates, measured odds saved by
// `node scripts/reveal-measure.ts 200 --save rates.json`. --series N also plays N whole series per
// format and level headlessly, a random player against the real bot, as a check on the model.
//   node scripts/series-measure.ts [pairs=3000] [--rates rates.json] [--series 1000]
// Not part of CI.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BALL_LOOKUP, BALLS } from '../src/sim/balls/index.ts';
import { BOT_LEVELS, botPick, randomBot, type LineupBot } from '../src/sim/bot.ts';
import { createStream } from '../src/sim/rng.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  startSeries,
} from '../src/sim/series.ts';
import { matchWorld, playToEnd } from '../src/sim/series-verify.ts';
import { lineupsOf, mapOdds, type Odds } from './reveal-analysis.ts';
import { samplePairs, summariseLevel } from './series-analysis.ts';

type Rates = Record<string, Record<string, number>>;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { rates: { type: 'string' }, series: { type: 'string' } },
});
const roster = BALLS.map((ball) => ball.id);
const pairs = samplePairs(lineupsOf(roster), Number(positionals[0] ?? 3000));
const bots: readonly LineupBot[] = [...BOT_LEVELS, randomBot];
const formats = ['reveal', 'showdown'] as const;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6);

const sources: [string, Odds][] = [['Counter-map odds', mapOdds]];
if (values.rates !== undefined) {
  const rates = JSON.parse(readFileSync(values.rates, 'utf8')) as Rates;
  sources.push(['Measured odds', (a, b) => rates[a]?.[b] ?? 0.5]);
}

const started = Date.now();
for (const [label, odds] of sources) {
  console.log(
    `\n${label}, ${String(pairs.length)} lineup pairs from ${String(roster.length)} balls`,
  );
  console.log('format    bot      best  worst random    gap  moved  r1 decides (best / random)');
  for (const format of formats) {
    for (const bot of bots) {
      const s = summariseLevel(format, bot, pairs, odds);
      console.log(
        `${format.padEnd(9)} ${bot.id.padEnd(7)} ${pct(s.best)} ${pct(s.worst)} ${pct(s.random)}` +
          ` ${pct(s.best - s.worst)} ${pct(s.matters)}  ${pct(s.firstDecidesBest)} / ${pct(s.firstDecidesRandom)}`,
      );
    }
  }
}

/** Plays `count` whole series: random lineups, a player choosing at random, the real bot. */
function playMany(format: (typeof formats)[number], bot: LineupBot, count: number): number {
  const random = createStream(0x5e7e5);
  const any = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) throw new Error('Nothing to choose from');
    return item;
  };
  const lineups = lineupsOf(roster);
  let wins = 0;
  for (let n = 0; n < count; n++) {
    const a = any(lineups);
    const b = any(lineups);
    let state = startSeries({
      ruleset: RULESET_VERSION,
      opponent: { kind: 'bot', bot: bot.id, lineupSeed: n },
      seed: n,
      a: [a[0] ?? '', a[1] ?? '', a[2] ?? ''],
      b: [b[0] ?? '', b[1] ?? '', b[2] ?? ''],
      format,
    });
    while (state.winner === undefined) {
      const due = awaitingPick(state);
      if (due !== undefined) {
        const ball = due === 'b' ? botPick(bot, state) : any(remainingOf(state, 'a'));
        state = recordPick(state, ball ?? '');
        continue;
      }
      const match = nextMatch(state);
      if (match === undefined) break;
      const end = playToEnd(matchWorld(match, BALL_LOOKUP), BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('A match ended without a result');
      state = recordOutcome(state, outcomeOf(end.match.result, end));
    }
    if (state.winner === 'a') wins++;
  }
  return wins / count;
}

if (values.series !== undefined) {
  const count = Number(values.series);
  console.log(`\nWhole series played, a random player, ${String(count)} per row`);
  for (const format of formats) {
    for (const bot of BOT_LEVELS) {
      const rate = playMany(format, bot, count);
      const error = Math.sqrt((rate * (1 - rate)) / count);
      console.log(`${format.padEnd(9)} ${bot.id.padEnd(7)} ${pct(rate)} ± ${pct(2 * error)}`);
    }
  }
}
console.error(`${((Date.now() - started) / 1000).toFixed(1)} s`);
