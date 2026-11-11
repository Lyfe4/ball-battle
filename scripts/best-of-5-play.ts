// Whole series played with the game's own fights, Best of 3 or Best of 5, as a check on
// best-of-5-measure.ts's model (docs/best-of-5-measurements.md). A random player against the real
// bot levels (Hard from best-of-n-bot.ts at Best of 5). The rules mirror src/sim/series.ts with
// the lineup size as a parameter: round seeds, draws replayed then sudden death, Reveal's seeded
// toss and Showdown's "winner shows first". Not part of CI.
//   node scripts/best-of-5-play.ts --size 5 --format reveal --series 1000
import { parseArgs } from 'node:util';
import { BALL_LOOKUP, BALLS } from '../src/sim/balls/index.ts';
import { getDefinition } from '../src/sim/definitions.ts';
import { easyBot, hardBot, normalBot, type BotView, type LineupBot } from '../src/sim/bot.ts';
import { createStream } from '../src/sim/rng.ts';
import {
  attemptSeed,
  MAX_ATTEMPTS,
  revealFirst,
  roundSeed,
  suddenDeathWinner,
  type Format,
} from '../src/sim/series.ts';
import { playToEnd } from '../src/sim/series-verify.ts';
import { createWorld } from '../src/sim/world.ts';
import { hardBotN } from './best-of-n-bot.ts';

const { values } = parseArgs({
  options: {
    size: { type: 'string', default: '5' },
    format: { type: 'string', default: 'reveal' },
    series: { type: 'string', default: '1000' },
  },
});
const size = Number(values.size);
const format = values.format as Format;
const count = Number(values.series);
const need = Math.floor(size / 2) + 1;
const roster = BALLS.map((ball) => ball.id);
const bots: readonly LineupBot[] =
  format === 'blind' ? [easyBot] : [easyBot, normalBot, size === 3 ? hardBot : hardBotN];

/** One round with real fights: replays on a draw, sudden death after MAX_ATTEMPTS. */
function fight(
  seed: number,
  round: number,
  a: string,
  b: string,
): { aWon: boolean; fights: number } {
  const seedOfRound = roundSeed(seed, round);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const world = createWorld(attemptSeed(seedOfRound, attempt), [
      getDefinition(BALL_LOOKUP, a),
      getDefinition(BALL_LOOKUP, b),
    ]);
    const end = playToEnd(world, BALL_LOOKUP);
    if (end.match.status !== 'finished') throw new Error('A match ended without a result');
    const result = end.match.result;
    if (result.kind !== 'draw')
      return { aWon: result.winnerId === end.balls[0]?.id, fights: attempt + 1 };
  }
  return { aWon: suddenDeathWinner(seedOfRound) === 'a', fights: MAX_ATTEMPTS };
}

const started = Date.now();
const pct = (x: number, n: number) =>
  `${(100 * x).toFixed(1)}% ± ${(200 * Math.sqrt((x * (1 - x)) / n)).toFixed(1)}`;
console.log(
  `Best of ${String(size)}, ${format}, real fights, ${String(count)} series per bot, a random player`,
);
console.log('bot     win            rounds  fights  early          back-from-0-1');
for (const bot of bots) {
  const random = createStream(0x5e7e5);
  const shuffled = () => {
    const pool = [...roster];
    const out: string[] = [];
    while (out.length < size) out.push(...pool.splice(Math.floor(random() * pool.length), 1));
    return out;
  };
  let wins = 0;
  let rounds = 0;
  let fights = 0;
  let early = 0;
  let back = 0;
  for (let n = 0; n < count; n++) {
    const seed = (n * 2654435761) >>> 0;
    let you = shuffled();
    let them = shuffled();
    let w = 0;
    let l = 0;
    let round = 0;
    let lead: 'a' | 'b' | 'both' =
      format === 'showdown' ? 'both' : format === 'reveal' ? revealFirst(seed) : 'a';
    let firstLoser: 'a' | 'b' = 'a';
    while (w < need && l < need) {
      let mine = you[0] ?? '';
      let theirs = them[0] ?? '';
      if (format !== 'blind' && you.length > 1) {
        const view = (role: BotView['role'], shown?: string): BotView => ({
          format,
          seed,
          round,
          role,
          own: them,
          opponent: you,
          wins: l,
          losses: w,
          ...(shown === undefined ? {} : { shown }),
        });
        mine = you[Math.floor(random() * you.length)] ?? '';
        theirs = bot.choose(
          lead === 'b' ? view('show') : lead === 'a' ? view('answer', mine) : view('open'),
        );
      }
      const result = fight(seed, round, mine, theirs);
      fights += result.fights;
      if (result.aWon) w++;
      else l++;
      if (round === 0) firstLoser = result.aWon ? 'b' : 'a';
      you = you.filter((id) => id !== mine);
      them = them.filter((id) => id !== theirs);
      round++;
      lead = format === 'showdown' ? (result.aWon ? 'a' : 'b') : lead === 'a' ? 'b' : 'a';
    }
    const winner = w >= need ? 'a' : 'b';
    if (winner === 'a') wins++;
    if (winner === firstLoser) back++;
    if (round < size) early++;
    rounds += round;
  }
  console.log(
    `${(format === 'blind' ? 'any' : bot.id).padEnd(7)} ${pct(wins / count, count)}  ${(rounds / count).toFixed(2)}    ${(fights / count).toFixed(2)}    ${pct(early / count, count)}  ${pct(back / count, count)}`,
  );
}
console.error(`${((Date.now() - started) / 1000).toFixed(1)} s`);
