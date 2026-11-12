import { describe, expect, it } from 'vitest';
import { BALLS } from './balls/index.ts';
import { afterRound, seriesValue } from './bot-model.ts';
import { maximinMix } from './maximin.ts';
import {
  BOT_LEVELS,
  botFor,
  botPick,
  botViewOf,
  easyBot,
  hardBot,
  normalBot,
  NORMAL_COUNTER_SHARE,
  randomBot,
  type BotView,
} from './bot.ts';
import { COUNTER_MAP, isFavoured } from './counter-map.ts';
import { RULESET_VERSION } from './ruleset.ts';
import {
  awaitingPick,
  recordOutcome,
  recordPick,
  remainingOf,
  revealFirst,
  startSeries,
  type Format,
  type SeriesSetup,
} from './series.ts';

const ids = BALLS.map((ball) => ball.id);
const rank = (id: string, shown: string) =>
  isFavoured(id, shown) ? 2 : isFavoured(shown, id) ? 0 : 1;

/** An answering view with `over` applied. */
const view = (over: Partial<BotView>): BotView => ({ ...base, ...over });
/** A view that answers nothing: showing first, or opening a Showdown. */
const choosing = (over: Partial<BotView>): BotView => {
  const chosen: { -readonly [K in keyof BotView]: BotView[K] } = view(over);
  delete chosen.shown;
  return chosen;
};

const base: BotView = {
  format: 'reveal',
  seed: 3,
  round: 1,
  role: 'answer',
  own: ['storm', 'frost'],
  opponent: ['vampire', 'speedster'],
  shown: 'vampire',
  wins: 0,
  losses: 1,
};

const setupOf = (format: Format, seed: number): SeriesSetup => ({
  ruleset: RULESET_VERSION,
  opponent: { kind: 'player' },
  seed,
  a: ['speedster', 'vampire', 'archer'],
  b: ['storm', 'frost', 'quake'],
  format,
});

describe('every bot level', () => {
  const views: BotView[] = [
    view({}),
    choosing({ role: 'show' }),
    choosing({ format: 'showdown', round: 0, role: 'open', losses: 0 }),
    choosing({ own: ['storm', 'frost', 'quake'], role: 'show', round: 0, losses: 0 }),
  ];

  it('weighs only its own balls, with weights that sum to 1, and draws one it weighs', () => {
    for (const bot of [...BOT_LEVELS, randomBot]) {
      for (const v of views) {
        const weights = bot.weights(v);
        expect(weights.every(([ball, w]) => v.own.includes(ball) && w > 0)).toBe(true);
        expect(weights.reduce((sum, [, w]) => sum + w, 0)).toBeCloseTo(1, 12);
        for (let seed = 0; seed < 20; seed++) {
          const choice = bot.choose({ ...v, seed });
          expect(weights.map(([ball]) => ball)).toContain(choice);
          expect(bot.choose({ ...v, seed })).toBe(choice);
        }
      }
    }
  });

  it('picks the same lineup at every level, so a seed gives one bot lineup', () => {
    for (let seed = 0; seed < 20; seed++) {
      const lineup = randomBot.pickLineup(seed, ids);
      for (const bot of BOT_LEVELS) expect(bot.pickLineup(seed, ids)).toStrictEqual(lineup);
    }
  });

  it('opens a Showdown without reading the player’s opener', () => {
    for (let seed = 0; seed < 30; seed++) {
      const start = startSeries({ ...setupOf('showdown', seed), opponent: { kind: 'player' } });
      for (const bot of BOT_LEVELS) {
        const openers = start.setup.a.map((opener) => botPick(bot, recordPick(start, opener)));
        expect(new Set(openers).size).toBe(1);
      }
    }
  });

  it('is named by the setup’s opponent, falling back to the default level', () => {
    expect(botFor({ kind: 'bot', bot: 'hard', lineupSeed: 1 })).toBe(hardBot);
    expect(botFor({ kind: 'bot', bot: 'random', lineupSeed: 1 })).toBe(randomBot);
    expect(botFor({ kind: 'player' })).toBe(normalBot);
  });
});

describe('the levels', () => {
  it('Easy chooses uniformly at random', () => {
    expect(easyBot.weights(view({}))).toStrictEqual([
      ['storm', 0.5],
      ['frost', 0.5],
    ]);
  });

  it('Normal answers with its best counter at least NORMAL_COUNTER_SHARE of the time', () => {
    for (const shown of ids) {
      for (const x of ids) {
        for (const y of ids) {
          if (x === y || x === shown || y === shown) continue;
          const v = view({ own: [x, y], shown });
          const best = Math.max(rank(x, shown), rank(y, shown));
          const share = normalBot
            .weights(v)
            .filter(([ball]) => rank(ball, shown) === best)
            .reduce((sum, [, w]) => sum + w, 0);
          expect(share).toBeGreaterThanOrEqual(NORMAL_COUNTER_SHARE);
        }
      }
    }
  });

  it('Hard answers with the ball that leaves it the best series chance', () => {
    for (const shown of ids.slice(0, 6)) {
      for (const x of ids) {
        for (const y of ids) {
          if (x === y || x === shown || y === shown) continue;
          const v = view({ own: [x, y], shown, opponent: [shown, 'brawler'] });
          const position = { ...v, own: v.own, opponent: v.opponent, winsNeeded: 2 };
          const value = (ball: string) => afterRound(position, 'opponent', ball, shown);
          const best = Math.max(value(x), value(y));
          for (const [ball] of hardBot.weights(v)) expect(value(ball)).toBeCloseTo(best, 9);
        }
      }
    }
  });

  it('Hard mixes its Showdown opener so no opener of the player’s can exploit it', () => {
    const own = ['storm', 'frost', 'quake'];
    const opponent = ['speedster', 'vampire', 'archer'];
    const position = {
      format: 'showdown' as const,
      own,
      opponent,
      wins: 0,
      losses: 0,
      winsNeeded: 2,
    };
    const weights = new Map(hardBot.weights(choosing({ ...position, round: 0, role: 'open' })));
    const against = (y: string) =>
      own.reduce((sum, b) => sum + (weights.get(b) ?? 0) * afterRound(position, 'bot', b, y), 0);
    const worst = Math.min(...opponent.map(against));
    // No pure opener of its own does better against the player's best reply.
    for (const b of own) {
      expect(worst).toBeGreaterThanOrEqual(
        Math.min(...opponent.map((y) => afterRound(position, 'bot', b, y))) - 1e-12,
      );
    }
  });
});

describe('the bot model', () => {
  it('mixes rock, paper, scissors evenly and never plays a dominated row', () => {
    const rps = [
      [0.5, 0, 1],
      [1, 0.5, 0],
      [0, 1, 0.5],
    ];
    for (const weight of maximinMix(rps)) expect(weight).toBeCloseTo(1 / 3, 12);
    const dominated = [
      [0.6, 0.6, 0.6],
      [0.4, 0.4, 0.4],
      [0.5, 0.7, 0.3],
    ];
    expect(maximinMix(dominated)).toStrictEqual([1, 0, 0]);
    // Matching pennies over two rows: half each.
    const pennies = [
      [1, 0],
      [0, 1],
    ];
    for (const weight of maximinMix(pennies)) expect(weight).toBeCloseTo(0.5, 12);
  });

  it('values a decided series as won or lost, and a last round by its odds', () => {
    const base = {
      format: 'reveal' as const,
      own: ['thorns'],
      opponent: ['brawler'],
      winsNeeded: 2,
    };
    expect(seriesValue({ ...base, wins: 2, losses: 0 }, 'bot')).toBe(1);
    expect(seriesValue({ ...base, wins: 0, losses: 2 }, 'bot')).toBe(0);
    expect(seriesValue({ ...base, wins: 1, losses: 1 }, 'bot')).toBe(0.64);
  });
});

describe('the first bot, kept for old links', () => {
  it('shows a random ball of its own first, the same for the same seed', () => {
    const own = randomBot.pickLineup(3, ids);
    const shown = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const v = choosing({ seed, round: 0, role: 'show', own });
      const ball = randomBot.choose(v);
      expect(own).toContain(ball);
      shown.add(ball);
    }
    expect(shown.size).toBe(3);
  });

  it('answers the ball shown first with its best counter: favoured, else even, else unfavoured', () => {
    let checked = 0;
    for (const shown of ids) {
      for (const x of ids) {
        for (const y of ids) {
          if (x === y || x === shown || y === shown) continue;
          for (let seed = 0; seed < 3; seed++) {
            const answer = randomBot.choose(view({ seed, own: [x, y], shown }));
            expect(rank(answer, shown)).toBe(Math.max(rank(x, shown), rank(y, shown)));
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('won the toss: shows first in round 1, answers the player in round 2', () => {
    // Seed 4's toss goes to side B.
    const setup = setupOf('reveal', 4);
    expect(revealFirst(setup.seed)).toBe('b');
    let state = startSeries(setup);
    expect(botViewOf(state)?.role).toBe('show');
    state = recordPick(state, botPick(randomBot, state) ?? '');
    expect(botPick(randomBot, state)).toBeUndefined();
    state = recordOutcome(recordPick(state, 'vampire'), 'a');
    expect(botPick(randomBot, state)).toBeUndefined();
    state = recordPick(state, 'speedster');
    expect(botViewOf(state)).toMatchObject({ role: 'answer', shown: 'speedster', round: 1 });
    expect(remainingOf(state, 'b')).toContain(botPick(randomBot, state));
  });

  it('lost the toss: answers the player in round 1, shows first in round 2', () => {
    // Seed 5's toss goes to side A.
    const setup = setupOf('reveal', 5);
    expect(revealFirst(setup.seed)).toBe('a');
    let state = startSeries(setup);
    expect(awaitingPick(state)).toBe('a');
    expect(botPick(randomBot, state)).toBeUndefined();
    state = recordPick(state, 'vampire');
    expect(botViewOf(state)).toMatchObject({ role: 'answer', shown: 'vampire', round: 0 });
    state = recordOutcome(recordPick(state, botPick(randomBot, state) ?? ''), 'b');
    expect(botViewOf(state)).toMatchObject({ role: 'show', round: 1, wins: 1, losses: 0 });
  });

  it('knows the map: every favoured entry reads as a counter one way only', () => {
    for (const entry of COUNTER_MAP) {
      expect(isFavoured(entry.x, entry.y)).toBe(entry.intended === 'x');
      expect(isFavoured(entry.y, entry.x)).toBe(entry.intended === 'y');
    }
  });
});
