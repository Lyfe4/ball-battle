// Pure analysis for the series measurements (docs/series-measurements.md, ADR 0035): what the
// player's choices are worth against each bot level, in Reveal and Showdown. Exact expectations
// over the bot's choices, read from the bot's own weights (src/sim/bot.ts), so what is measured is
// what plays; no matches are played here.
//
// Rounds are independent and a drawn round counts as half a win (it is replayed). The series is
// first to two. The player chooses best, worst or at random; "best" knows how the bot weighs its
// choices, which is the most a player can learn about it.
import type { BotRole, BotView, LineupBot } from '../src/sim/bot.ts';
import type { Format, Side } from '../src/sim/series.ts';
import type { Odds } from './reveal-analysis.ts';

/** How the player chooses: their best, their worst, or at random. */
export type Play = 'best' | 'worst' | 'random';

/** Who chooses first in a round: a side, or both at once (Showdown's round 1). */
type Lead = Side | 'both';

interface Position {
  readonly you: readonly string[];
  readonly bot: readonly string[];
  /** The player's round wins, then the bot's. */
  readonly wins: number;
  readonly losses: number;
  readonly round: number;
}

/** The player's series chance, and the chance the winner of round 1 takes the series. */
export interface Outlook {
  readonly win: number;
  readonly firstDecides: number;
}

const without = (balls: readonly string[], ball: string) => balls.filter((id) => id !== ball);
const mean = (values: readonly number[]) => values.reduce((s, v) => s + v, 0) / values.length;

function pickBy(play: Play, values: readonly number[]): number {
  if (play === 'best') return Math.max(...values);
  if (play === 'worst') return Math.min(...values);
  return mean(values);
}

/** Who leads the next round: Reveal alternates; in Showdown the winner leads. */
function nextLead(format: Format, lead: Lead, youWon: boolean): Lead {
  if (format === 'showdown') return youWon ? 'a' : 'b';
  return lead === 'a' ? 'b' : 'a';
}

/** The player's series chance from a position, with `lead` choosing first this round. */
export function seriesChance(
  format: Format,
  bot: LineupBot,
  odds: Odds,
  play: Play,
  from: Position,
  lead: Lead,
): number {
  const memo = new Map<string, number>();
  const value = (at: Position, leads: Lead): number => {
    if (at.wins >= 2) return 1;
    if (at.losses >= 2) return 0;
    const [y, b] = [at.you[0], at.bot[0]];
    if (at.you.length === 1 && y !== undefined && b !== undefined) return odds(y, b);
    const key = `${at.you.join()}|${at.bot.join()}|${String(at.wins)}${String(at.losses)}|${leads}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const after = (mine: string, theirs: string) => {
      const chance = odds(mine, theirs);
      const rest = {
        you: without(at.you, mine),
        bot: without(at.bot, theirs),
        round: at.round + 1,
      };
      const won = value(
        { ...rest, wins: at.wins + 1, losses: at.losses },
        nextLead(format, leads, true),
      );
      const lost = value(
        { ...rest, wins: at.wins, losses: at.losses + 1 },
        nextLead(format, leads, false),
      );
      return chance * won + (1 - chance) * lost;
    };
    const weights = (role: BotRole, shown?: string) => bot.weights(viewOf(format, at, role, shown));
    let result: number;
    if (leads === 'b') {
      result = weights('show').reduce(
        (sum, [ball, w]) =>
          sum +
          w *
            pickBy(
              play,
              at.you.map((mine) => after(mine, ball)),
            ),
        0,
      );
    } else if (leads === 'a') {
      result = pickBy(
        play,
        at.you.map((mine) =>
          weights('answer', mine).reduce((sum, [ball, w]) => sum + w * after(mine, ball), 0),
        ),
      );
    } else {
      const opener = weights('open');
      result = pickBy(
        play,
        at.you.map((mine) => opener.reduce((sum, [ball, w]) => sum + w * after(mine, ball), 0)),
      );
    }
    memo.set(key, result);
    return result;
  };
  return value(from, lead);
}

function viewOf(format: Format, at: Position, role: BotRole, shown?: string): BotView {
  const view = {
    format,
    seed: 0,
    round: at.round,
    role,
    own: at.bot,
    opponent: at.you,
    wins: at.losses,
    losses: at.wins,
  };
  return shown === undefined ? view : { ...view, shown };
}

/**
 * The player's outlook for one pair of lineups. Reveal's toss is a fair coin made before any
 * choice, so its outlook is the average of the two orders.
 */
export function outlook(
  format: 'reveal' | 'showdown',
  you: readonly string[],
  botLineup: readonly string[],
  bot: LineupBot,
  odds: Odds,
  play: Play,
): Outlook {
  const start: Position = { you, bot: botLineup, wins: 0, losses: 0, round: 0 };
  if (format === 'reveal') {
    const first = rootOutlook(format, start, 'b', bot, odds, play);
    const second = rootOutlook(format, start, 'a', bot, odds, play);
    return {
      win: (first.win + second.win) / 2,
      firstDecides: (first.firstDecides + second.firstDecides) / 2,
    };
  }
  return rootOutlook(format, start, 'both', bot, odds, play);
}

/** Round 1 by hand, so the player's choice there also gives the chance round 1 decides it. */
function rootOutlook(
  format: Format,
  start: Position,
  lead: Lead,
  bot: LineupBot,
  odds: Odds,
  play: Play,
): Outlook {
  const branch = (mine: string, theirs: string): Outlook => {
    const chance = odds(mine, theirs);
    const rest = { you: without(start.you, mine), bot: without(start.bot, theirs), round: 1 };
    const won = seriesChance(
      format,
      bot,
      odds,
      play,
      { ...rest, wins: 1, losses: 0 },
      nextLead(format, lead, true),
    );
    const lost = seriesChance(
      format,
      bot,
      odds,
      play,
      { ...rest, wins: 0, losses: 1 },
      nextLead(format, lead, false),
    );
    return {
      win: chance * won + (1 - chance) * lost,
      firstDecides: chance * won + (1 - chance) * (1 - lost),
    };
  };
  const over = (weights: readonly (readonly [string, number])[], of: (ball: string) => Outlook) =>
    weights.reduce(
      (sum, [ball, w]) => {
        const o = of(ball);
        return { win: sum.win + w * o.win, firstDecides: sum.firstDecides + w * o.firstDecides };
      },
      { win: 0, firstDecides: 0 },
    );
  const choose = (options: readonly Outlook[]): Outlook => {
    if (play === 'random') {
      return {
        win: mean(options.map((o) => o.win)),
        firstDecides: mean(options.map((o) => o.firstDecides)),
      };
    }
    return options.reduce((kept, o) =>
      (play === 'best' ? o.win > kept.win : o.win < kept.win) ? o : kept,
    );
  };
  const weights = (role: BotRole, shown?: string) =>
    bot.weights(viewOf(format, start, role, shown));
  if (lead === 'b') {
    return over(weights('show'), (ball) => choose(start.you.map((mine) => branch(mine, ball))));
  }
  if (lead === 'a') {
    return choose(
      start.you.map((mine) => over(weights('answer', mine), (ball) => branch(mine, ball))),
    );
  }
  const opener = weights('open');
  return choose(start.you.map((mine) => over(opener, (ball) => branch(mine, ball))));
}

export interface LevelSummary {
  readonly pairs: number;
  readonly best: number;
  readonly worst: number;
  readonly random: number;
  /** Share of lineup pairs where the player's choices move their chance by 3 points or more. */
  readonly matters: number;
  /** How often the winner of round 1 takes the series, with the player's best and random play. */
  readonly firstDecidesBest: number;
  readonly firstDecidesRandom: number;
}

/** A format's outlook against `bot`, averaged over `pairs` of lineups. */
export function summariseLevel(
  format: 'reveal' | 'showdown',
  bot: LineupBot,
  pairs: readonly (readonly [readonly string[], readonly string[]])[],
  odds: Odds,
): LevelSummary {
  let best = 0;
  let worst = 0;
  let random = 0;
  let matters = 0;
  let firstBest = 0;
  let firstRandom = 0;
  for (const [you, theirs] of pairs) {
    const b = outlook(format, you, theirs, bot, odds, 'best');
    const w = outlook(format, you, theirs, bot, odds, 'worst');
    const r = outlook(format, you, theirs, bot, odds, 'random');
    best += b.win;
    worst += w.win;
    random += r.win;
    firstBest += b.firstDecides;
    firstRandom += r.firstDecides;
    if (b.win - w.win >= 0.03) matters++;
  }
  const n = pairs.length;
  return {
    pairs: n,
    best: best / n,
    worst: worst / n,
    random: random / n,
    matters: matters / n,
    firstDecidesBest: firstBest / n,
    firstDecidesRandom: firstRandom / n,
  };
}

/** About `size` lineup pairs, evenly spaced through every pair of `lineups`. */
export function samplePairs<T>(lineups: readonly T[], size: number): [T, T][] {
  const total = lineups.length * lineups.length;
  const stride = Math.max(1, Math.floor(total / size));
  const pairs: [T, T][] = [];
  for (let n = 0; n < total; n += stride) {
    const you = lineups[Math.floor(n / lineups.length)];
    const bot = lineups[n % lineups.length];
    if (you !== undefined && bot !== undefined) pairs.push([you, bot]);
  }
  return pairs;
}
