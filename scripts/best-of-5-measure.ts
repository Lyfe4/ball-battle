// Best of 3 against Best of 5, per format (docs/best-of-5-measurements.md). Not part of CI; the
// game itself is Best of 3 only. Two parts, both on round odds (the counter map's, or measured
// with --rates from `node scripts/reveal-measure.ts 200 --save rates.json`):
// - exact: best, worst and random play against each bot, over evenly spaced lineup pairs
//   (series-analysis.ts, which reads the bots' own weights), with 2-standard-error bars over pairs;
// - played out: --series N series per lineup pair and bot, the player choosing best or at random,
//   the bot drawing from its weights and each round a weighted coin, for what the exact part can't
//   give: how long a series runs, comebacks, and how many single decisions move the odds.
//   node scripts/best-of-5-measure.ts --size 5 --format reveal [--pairs 2000] [--series 4]  [--rates rates.json] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BALLS } from '../src/sim/balls/index.ts';
import { easyBot, hardBot, normalBot, type BotView, type LineupBot } from '../src/sim/bot.ts';
import { createStream } from '../src/sim/rng.ts';
import { forgetPositions, hardBotN } from './best-of-n-bot.ts';
import { bestOrder, combinations, fixedOrders } from './blind-orders.ts';
import { mapOdds, orders, type Odds } from './reveal-analysis.ts';
import {
  evaluator,
  outlook,
  samplePairs,
  type Lead,
  type Play,
  type Position,
} from './series-analysis.ts';

const { values } = parseArgs({
  options: {
    size: { type: 'string', default: '5' },
    format: { type: 'string', default: 'reveal' },
    pairs: { type: 'string', default: '2000' },
    series: { type: 'string', default: '4' },
    rates: { type: 'string' },
    json: { type: 'string' },
  },
});
const size = Number(values.size);
const format = values.format as 'blind' | 'reveal' | 'showdown';
const odds: Odds =
  values.rates === undefined
    ? mapOdds
    : (() => {
        const rates = JSON.parse(readFileSync(values.rates, 'utf8')) as Record<
          string,
          Record<string, number>
        >;
        return (a: string, b: string) => rates[a]?.[b] ?? 0.5;
      })();
const roster = BALLS.map((ball) => ball.id);
const pairs = samplePairs(combinations(roster, size), Number(values.pairs));
const bots: readonly LineupBot[] = [easyBot, normalBot, size === 3 ? hardBot : hardBotN];
const need = Math.floor(size / 2) + 1;
const bestOf = (bot: LineupBot) => evaluator(format, bot, odds, 'best');

/** Mean and two standard errors of the mean. */
function stat(xs: readonly number[]) {
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1);
  return { mean, err: 2 * Math.sqrt(variance / n) };
}

interface Exact {
  bot: string;
  best: ReturnType<typeof stat>;
  worst: ReturnType<typeof stat>;
  random: ReturnType<typeof stat>;
  gap: ReturnType<typeof stat>;
  moved: ReturnType<typeof stat>;
  firstDecidesBest: ReturnType<typeof stat>;
  firstDecidesRandom: ReturnType<typeof stat>;
}

function exactBlind(): Exact {
  const best: number[] = [];
  const worst: number[] = [];
  const random: number[] = [];
  for (const [you, theirs] of pairs) {
    const botOrders = orders(theirs);
    const vals = orders(you).map(
      (order) =>
        botOrders.reduce((s, b) => s + fixedOrders(order, b, odds, need), 0) / botOrders.length,
    );
    best.push(Math.max(...vals));
    worst.push(Math.min(...vals));
    random.push(vals.reduce((s, v) => s + v, 0) / vals.length);
  }
  const gaps = best.map((b, i) => b - (worst[i] ?? 0));
  return {
    bot: 'any',
    best: stat(best),
    worst: stat(worst),
    random: stat(random),
    gap: stat(gaps),
    moved: stat(gaps.map((g) => (g >= 0.03 ? 1 : 0))),
    firstDecidesBest: stat([0]),
    firstDecidesRandom: stat([0]),
  };
}

function exactLevel(bot: LineupBot): Exact {
  const f = format as 'reveal' | 'showdown';
  const best: number[] = [];
  const worst: number[] = [];
  const random: number[] = [];
  const fdBest: number[] = [];
  const fdRandom: number[] = [];
  for (const [you, theirs] of pairs) {
    const b = outlook(f, you, theirs, bot, odds, 'best');
    const r = outlook(f, you, theirs, bot, odds, 'random');
    best.push(b.win);
    worst.push(outlook(f, you, theirs, bot, odds, 'worst').win);
    random.push(r.win);
    fdBest.push(b.firstDecides);
    fdRandom.push(r.firstDecides);
  }
  const gaps = best.map((b, i) => b - (worst[i] ?? 0));
  return {
    bot: bot.id,
    best: stat(best),
    worst: stat(worst),
    random: stat(random),
    gap: stat(gaps),
    moved: stat(gaps.map((g) => (g >= 0.03 ? 1 : 0))),
    firstDecidesBest: stat(fdBest),
    firstDecidesRandom: stat(fdRandom),
  };
}

interface Played {
  bot: string;
  play: Play;
  series: number;
  win: ReturnType<typeof stat>;
  rounds: ReturnType<typeof stat>;
  /** Over before the last possible round. */
  early: ReturnType<typeof stat>;
  /** Taken by the side that lost round 1, among all series. */
  comebackAfter01: ReturnType<typeof stat>;
  /** Among series where a side was 0-2 down, how often that side took it. */
  comebackAfter02: ReturnType<typeof stat>;
  /** The player's decisions with more than one option, per series. */
  decisions: ReturnType<typeof stat>;
  /** Share of those decisions whose options' series chances differ by 3 points or more. */
  decisionsMatter: ReturnType<typeof stat>;
  /** Share of decisions made after seeing the bot's ball (answers), not before. */
  reads: ReturnType<typeof stat>;
}

function playOut(bot: LineupBot | undefined, play: Play, perPair: number, seed: number): Played {
  const random = createStream(seed);
  const any = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  const fromWeights = (weights: readonly (readonly [string, number])[]) => {
    const roll = random();
    let sum = 0;
    for (const [ball, w] of weights) {
      sum += w;
      if (roll < sum) return ball;
    }
    return weights.at(-1)?.[0] ?? '';
  };
  const wins: number[] = [];
  const rounds: number[] = [];
  const early: number[] = [];
  const back01: number[] = [];
  const back02: number[] = [];
  const decisions: number[] = [];
  const matter: number[] = [];
  const reads: number[] = [];
  for (const [you0, bot0] of pairs) {
    // Blind makes no bot choices, so its level is never read.
    const level = bot ?? easyBot;
    const best = bestOf(level);
    // Blind: the player's order (best, or at random) against the bot's random order, set beforehand.
    const blindYou = format === 'blind' ? orders(you0) : [];
    const blindBots = format === 'blind' ? orders(bot0) : [];
    const blindBest =
      format === 'blind' && play === 'best' ? bestOrder(you0, bot0, odds, need) : [];
    for (let n = 0; n < perPair; n++) {
      let you = [...you0];
      let them = [...bot0];
      const blindOrder = play === 'random' && format === 'blind' ? any(blindYou) : blindBest;
      const blindBot = format === 'blind' ? any(blindBots) : [];
      let w = 0;
      let l = 0;
      let round = 0;
      let lead: Lead = format === 'showdown' ? 'both' : random() < 0.5 ? 'a' : 'b';
      let firstLoser: 'a' | 'b' | undefined;
      let down02: 'a' | 'b' | undefined;
      let made = 0;
      while (w < need && l < need) {
        let mine: string;
        let theirs: string;
        if (format === 'blind') {
          mine = blindOrder[round] ?? '';
          theirs = blindBot[round] ?? '';
        } else if (you.length === 1) {
          mine = you[0] ?? '';
          theirs = them[0] ?? '';
        } else {
          const at: Position = { you, bot: them, wins: w, losses: l, round };
          const view = (role: 'show' | 'answer' | 'open', shown?: string) => ({
            format: format as 'reveal',
            seed: 0,
            round,
            role,
            own: them,
            opponent: you,
            wins: l,
            losses: w,
            ...(shown === undefined ? {} : { shown }),
          });
          const shown = lead === 'b' ? fromWeights(level.weights(view('show'))) : undefined;
          const options = best.choices(at, lead, shown);
          const top = Math.max(...options);
          matter.push(top - Math.min(...options) >= 0.03 ? 1 : 0);
          reads.push(lead === 'b' ? 1 : 0);
          made++;
          mine = play === 'random' ? any(you) : (you[options.indexOf(top)] ?? '');
          theirs =
            shown ?? fromWeights(level.weights(lead === 'a' ? view('answer', mine) : view('open')));
        }
        const won = random() < odds(mine, theirs);
        if (won) w++;
        else l++;
        if (round === 0) firstLoser = won ? 'b' : 'a';
        if (down02 === undefined && w === 0 && l === 2) down02 = 'a';
        if (down02 === undefined && l === 0 && w === 2) down02 = 'b';
        you = you.filter((id) => id !== mine);
        them = them.filter((id) => id !== theirs);
        round++;
        lead = format === 'showdown' ? (won ? 'a' : 'b') : lead === 'a' ? 'b' : 'a';
      }
      const winner = w >= need ? 'a' : 'b';
      wins.push(winner === 'a' ? 1 : 0);
      rounds.push(round);
      early.push(round < size ? 1 : 0);
      back01.push(winner === firstLoser ? 1 : 0);
      if (down02 !== undefined) back02.push(winner === down02 ? 1 : 0);
      decisions.push(format === 'blind' ? 1 : made);
    }
  }
  return {
    bot: bot?.id ?? 'any',
    play,
    series: wins.length,
    win: stat(wins),
    rounds: stat(rounds),
    early: stat(early),
    comebackAfter01: stat(back01),
    comebackAfter02: back02.length > 0 ? stat(back02) : { mean: NaN, err: NaN },
    decisions: stat(decisions),
    decisionsMatter: format === 'blind' ? { mean: NaN, err: NaN } : stat(matter),
    reads: format === 'blind' ? { mean: 0, err: 0 } : stat(reads),
  };
}

// ---------- run ----------

const started = Date.now();
const pct = (s: { mean: number; err: number }) =>
  `${(100 * s.mean).toFixed(1)}% ± ${(100 * s.err).toFixed(1)}`;
const exact = format === 'blind' ? [exactBlind()] : bots.map(exactLevel);
const exactSeconds = (Date.now() - started) / 1000;
const perPair = Number(values.series);
const playedOut: Played[] = [];
for (const play of ['best', 'random'] as const) {
  if (format === 'blind') playedOut.push(playOut(undefined, play, perPair, 0x5e7e5));
  else bots.forEach((bot, i) => playedOut.push(playOut(bot, play, perPair, 0x5e7e5 + i)));
}

// How long Hard takes to choose in this format and size, cold and warm.
const timing: Record<string, number> = {};
if (format !== 'blind') {
  const hard = size === 3 ? hardBot : hardBotN;
  const [own, opp] = pairs[0] ?? [[], []];
  const base = { format, seed: 0, round: 0, own, opponent: opp, wins: 0, losses: 0 };
  const views: BotView[] =
    format === 'showdown'
      ? [{ ...base, role: 'open' }]
      : [
          { ...base, role: 'show' },
          { ...base, role: 'answer', shown: opp[0] ?? '' },
        ];
  for (const view of views) {
    forgetPositions();
    const t = performance.now();
    hard.weights(view);
    timing[`${view.role} cold ms`] = performance.now() - t;
  }
}

console.log(
  `Best of ${String(size)}, ${format}, ${String(pairs.length)} lineup pairs, ${values.rates === undefined ? 'counter-map' : 'measured'} odds`,
);
console.log(
  'bot     best              worst             random            gap               moved',
);
for (const e of exact) {
  console.log(
    `${e.bot.padEnd(7)} ${pct(e.best).padEnd(17)} ${pct(e.worst).padEnd(17)} ${pct(e.random).padEnd(17)} ${pct(e.gap).padEnd(17)} ${pct(e.moved)}`,
  );
}
console.log(
  '\nplayed out: bot play  win  rounds  early  back-from-0-1  back-from-0-2  decisions  matter  reads',
);
for (const p of playedOut) {
  console.log(
    `${p.bot.padEnd(7)} ${p.play.padEnd(6)} ${pct(p.win)}  ${p.rounds.mean.toFixed(2)}±${p.rounds.err.toFixed(2)}  ${pct(p.early)}  ${pct(p.comebackAfter01)}  ${pct(p.comebackAfter02)}  ${p.decisions.mean.toFixed(2)}  ${pct(p.decisionsMatter)}  ${pct(p.reads)}`,
  );
}
console.log('\nHard choice time', timing);
console.error(
  `exact ${exactSeconds.toFixed(1)} s, total ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
if (values.json !== undefined) {
  writeFileSync(
    values.json,
    JSON.stringify({ size, format, pairs: pairs.length, exact, playedOut, timing }, null, 1),
  );
}
