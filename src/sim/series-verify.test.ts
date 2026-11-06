import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { BOT_LEVELS, randomBot } from './bot.ts';
import { RULESET_VERSION } from './ruleset.ts';
import { revealFirst, setupWithPicks, type Format, type SeriesSetup } from './series.ts';
import { playSeries, verifySeries } from './series-verify.ts';
import { playLikeTheGame } from './test-support.ts';

const ids = BALLS.map((ball) => ball.id);

/** A series against the bot as the game sets one up, played to the end: its link's setup. */
function decided(format: Format, seed: number, bot = randomBot.id): SeriesSetup {
  const setup: SeriesSetup = {
    ruleset: RULESET_VERSION,
    seed,
    a: randomBot.pickLineup(seed + 1000, ids),
    b: randomBot.pickLineup(seed, ids),
    opponent: { kind: 'bot', bot, lineupSeed: seed },
    ...(format === 'blind' ? {} : { format }),
  };
  return setupWithPicks(playLikeTheGame(setup, BALL_LOOKUP));
}

const reasonOf = (setup: SeriesSetup) => {
  const verdict = verifySeries(setup, BALL_LOOKUP);
  return verdict.ok ? 'ok' : verdict.reason;
};

describe('verifySeries', () => {
  it('accepts every series the game plays, in every format, with the state the game reached', () => {
    for (const format of ['blind', 'reveal', 'showdown'] as const) {
      for (const bot of [randomBot, ...BOT_LEVELS]) {
        // Seeds 1-4 give Reveal's toss to the bot, 5 and 6 to the player. Each level plays one of
        // each, which keeps the test inside its time limit on a busy runner.
        const seeds = bot === randomBot ? [1, 2, 3, 5, 6] : [2, 5];
        for (const seed of seeds) {
          const setup = decided(format, seed, bot.id);
          const verdict = verifySeries(setup, BALL_LOOKUP);
          expect(verdict.ok, `${format} ${bot.id} ${String(seed)}`).toBe(true);
          expect(verdict.ok && verdict.state).toStrictEqual(playLikeTheGame(setup, BALL_LOOKUP));
        }
      }
    }
  });

  it('replays Reveal’s coin toss from the seed, and refuses picks in the other turn order', () => {
    for (const [seed, first] of [
      [4, 'b'],
      [5, 'a'],
    ] as const) {
      expect(revealFirst(seed)).toBe(first);
      const setup = decided('reveal', seed);
      const { picks } = playSeries(setup, BALL_LOOKUP);
      expect(picks.map((pick) => pick.side).slice(0, 2)).toStrictEqual(
        first === 'a' ? ['a', 'b'] : ['b', 'a'],
      );
      const [one, two, ...rest] = setup.picks ?? [];
      if (one === undefined || two === undefined) throw new Error('Expected picks');
      // The same picks as if the toss had gone the other way.
      expect(reasonOf({ ...setup, picks: [two, one, ...rest] })).not.toBe('ok');
    }
  });

  it('accepts a rematch: the bot keeps the lineup it picked from an earlier seed', () => {
    const first = decided('blind', 4);
    expect(reasonOf({ ...first, seed: 99 })).toBe('ok');
  });

  it('refuses a series played under another ruleset', () => {
    expect(reasonOf({ ...decided('blind', 1), ruleset: RULESET_VERSION + 1 })).toMatch(/ruleset/);
    expect(reasonOf({ ...decided('blind', 1), ruleset: 0 })).toMatch(/ruleset/);
  });

  it('refuses a bot lineup the bot would not pick, even reordered', () => {
    const setup = decided('blind', 1);
    const [x, y, z] = setup.b;
    expect(reasonOf({ ...setup, b: [y, x, z] })).toMatch(/lineup the random bot picks/);
    const other = ids.find((id) => !setup.b.includes(id)) ?? '';
    expect(reasonOf({ ...setup, b: [x, y, other] })).toMatch(/lineup the random bot picks/);
    expect(reasonOf({ ...setup, opponent: { kind: 'bot', bot: 'random', lineupSeed: 2 } })).toMatch(
      /lineup the random bot picks/,
    );
  });

  it('refuses a bot pick the bot would not make', () => {
    const reveal = decided('reveal', 1);
    const [shown = '', ...rest] = reveal.picks ?? [];
    const otherBall = reveal.b.find((id) => id !== shown) ?? '';
    expect(reasonOf({ ...reveal, picks: [otherBall, ...rest] })).toMatch(/Pick 1 is not/);
    // Showdown: the bot's opener is pick 2, and another level would have opened differently.
    for (let seed = 0; seed < 40; seed++) {
      const hard = decided('showdown', seed, 'hard');
      const [mine = '', opener = '', ...others] = hard.picks ?? [];
      const swapped = hard.b.find((id) => id !== opener) ?? '';
      expect(reasonOf({ ...hard, picks: [mine, swapped, ...others] })).toMatch(/Pick 2 is not/);
    }
    // The same series, said to be against another bot, is refused wherever that bot differs.
    const refused = [1, 2, 3, 4, 5, 6, 7, 8].filter(
      (seed) =>
        reasonOf({
          ...decided('reveal', seed, 'hard'),
          opponent: { kind: 'bot', bot: 'easy', lineupSeed: seed },
        }) !== 'ok',
    );
    expect(refused.length).toBeGreaterThan(0);
  });

  it('refuses a pick the side does not have, a missing pick and one never used', () => {
    const reveal = decided('reveal', 2);
    const picks = reveal.picks ?? [];
    // Pick 2 is the player's answer: a ball outside their lineup is not one they have.
    const notTheirs = ids.find((id) => !reveal.a.includes(id)) ?? '';
    expect(reasonOf({ ...reveal, picks: [picks[0] ?? '', notTheirs, ...picks.slice(2)] })).toMatch(
      /not a ball side a has left/,
    );
    expect(reasonOf({ ...reveal, picks: picks.slice(0, 3) })).toMatch(/needs a pick/);
    expect(reasonOf({ ...decided('blind', 2), picks: [reveal.a[0]] })).toMatch(/never used/);
  });

  it('refuses an invalid lineup, an unknown bot and a seed out of range', () => {
    const setup = decided('blind', 3);
    expect(reasonOf({ ...setup, a: [setup.a[0], setup.a[0], setup.a[1]] })).toMatch(/lineup/);
    expect(reasonOf({ ...setup, opponent: { kind: 'bot', bot: 'genius', lineupSeed: 3 } })).toMatch(
      /No bot/,
    );
    expect(reasonOf({ ...setup, seed: -1 })).toMatch(/seed/);
    expect(reasonOf({ ...setup, seed: 1.5 })).toMatch(/seed/);
  });

  it('checks only that a player opponent’s picks are legal', () => {
    const setup = decided('showdown', 1);
    const [x, y, z] = setup.b;
    const player: SeriesSetup = { ...setup, b: [z, y, x], opponent: { kind: 'player' } };
    expect(reasonOf({ ...player, picks: [] })).not.toMatch(/lineup|bot/);
  });

  it('playSeries throws with the same reason verifySeries gives', () => {
    const setup = { ...decided('blind', 1), ruleset: 0 };
    expect(() => playSeries(setup, BALL_LOOKUP)).toThrow(reasonOf(setup));
  });
});
