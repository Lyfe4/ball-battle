// How often a newcomer wins the guided first series (ADR 0090 and its addendum "Tuned to teach"):
// Best of 3 · Reveal against the Easy bot, on the seed the lineup step chooses for the player's
// lineup (`firstSeriesSeed`), as the client starts it. Whole series are played headlessly with real
// fights. Two players: one who picks a ▲ (▲▲ first) whenever one exists, else at random; one who
// picks at random. Each with a random lineup and with Pick for me's starter trio. Also counts the
// grids with two or more ▲ for the player, and their shape.
//   node scripts/first-series-measure.ts [series=2000]
// Not part of CI.
import { STARTER_TRIO } from '../src/app/first-series-setup.ts';
import { firstSeriesSeed, gridOf, isNaturalGrid } from '../src/app/first-series-seed.ts';
import { BALL_LOOKUP, BALLS } from '../src/sim/balls/index.ts';
import { botPick, easyBot } from '../src/sim/bot.ts';
import { standingOf } from '../src/sim/counter-map.ts';
import { createStream, deriveSeed } from '../src/sim/rng.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  startSeries,
  type SeriesState,
} from '../src/sim/series.ts';
import { firstToShowOf } from '../src/sim/series-seeds.ts';
import { matchWorld, playToEnd } from '../src/sim/series-verify.ts';

const count = Number(process.argv.find((arg) => /^\d+$/.test(arg)) ?? 2000);
const roster = BALLS.map((ball) => ball.id);

type Policy = 'favoured' | 'random';
type Pick = (items: readonly string[]) => string;

/** The player's pick: a ▲ against what it faces when one exists (the highest), else any. */
function playerPick(policy: Policy, state: SeriesState, any: Pick): string {
  const own = remainingOf(state, 'a');
  if (policy === 'random') return any(own);
  const round = state.rounds.length;
  const shown = state.picks.find((p) => p.round === round && p.side === 'b')?.ball;
  // Answering, the shown ball; showing first, the bot's balls left (the pick screen's rows).
  const facing = shown === undefined ? remainingOf(state, 'b') : [shown];
  const score = (ball: string) => facing.reduce((sum, y) => sum + standingOf(ball, y), 0);
  const best = Math.max(...own.map(score));
  return best > 0 ? any(own.filter((ball) => score(ball) === best)) : any(own);
}

/** The series on `seed` for lineup `a`, as the client starts it. */
const seriesOn = (seed: number, a: readonly string[]) =>
  startSeries({
    ruleset: RULESET_VERSION,
    opponent: { kind: 'bot', bot: easyBot.id, lineupSeed: seed },
    seed,
    a,
    b: easyBot.pickLineup(seed, roster, 3),
    format: 'reveal',
  });

/** Three different balls, each lineup as likely (a partial Fisher-Yates shuffle). */
function threeOf(ids: readonly string[], random: () => number): readonly string[] {
  const pool = [...ids];
  for (let i = 0; i < 3; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j] ?? '', pool[i] ?? ''];
  }
  return pool.slice(0, 3);
}

interface Tally {
  wins: number;
  firstRound: number;
  botFirst: number;
  twoFavoured: number;
  natural: number;
}

function playMany(policy: Policy, lineup: 'random' | 'starter'): Tally {
  const random = createStream(0xf1257);
  const any: Pick = (items) => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) throw new Error('Nothing to choose from');
    return item;
  };
  const tally: Tally = { wins: 0, firstRound: 0, botFirst: 0, twoFavoured: 0, natural: 0 };
  for (let n = 0; n < count; n++) {
    const a = lineup === 'starter' ? STARTER_TRIO : threeOf(roster, random);
    const seed = firstSeriesSeed(deriveSeed([n, 0xfe5]), a, roster, BALL_LOOKUP);
    let state = seriesOn(seed, a);
    const grid = gridOf(a, state.setup.b);
    if (grid.favoured >= 2) tally.twoFavoured++;
    if (isNaturalGrid(grid)) tally.natural++;
    if (firstToShowOf(state.setup) === 'b') tally.botFirst++;
    while (state.winner === undefined) {
      const due = awaitingPick(state);
      if (due !== undefined) {
        const ball = due === 'b' ? botPick(easyBot, state) : playerPick(policy, state, any);
        state = recordPick(state, ball ?? '');
        continue;
      }
      const match = nextMatch(state);
      if (match === undefined) break;
      const end = playToEnd(matchWorld(match, BALL_LOOKUP), BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('A match ended without a result');
      state = recordOutcome(state, outcomeOf(end.match.result, end));
    }
    if (state.winner === 'a') tally.wins++;
    if (state.rounds[0]?.winner === 'a') tally.firstRound++;
  }
  return tally;
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const started = Date.now();
console.log(
  `Ruleset ${String(RULESET_VERSION)}, ${String(roster.length)} balls, ${String(count)} series a row`,
);
console.log(
  'player    lineup   series won (±2σ)   round 1 won   bot showed first   2+ ▲   natural grid',
);
for (const lineup of ['random', 'starter'] as const) {
  for (const policy of ['favoured', 'random'] as const) {
    const t = playMany(policy, lineup);
    const rate = t.wins / count;
    const error = 2 * Math.sqrt((rate * (1 - rate)) / count);
    console.log(
      `${policy.padEnd(9)} ${lineup.padEnd(8)} ${pct(rate).padStart(6)} ± ${pct(error).padEnd(8)}` +
        `   ${pct(t.firstRound / count).padStart(6)}        ${pct(t.botFirst / count).padEnd(17)}` +
        ` ${pct(t.twoFavoured / count).padEnd(7)} ${pct(t.natural / count)}`,
    );
  }
}
console.error(`${((Date.now() - started) / 1000).toFixed(1)} s`);
