// verifySeries for a Best of 5 (ADR 0048): every series the game plays is accepted, a link that
// changes its length, lineups or picks is refused, and Best of 3 links are read as before.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { BOT_LEVELS, botFor } from './bot.ts';
import { RULESET_VERSION } from './ruleset.ts';
import { setupWithPicks, type Format, type SeriesSetup } from './series.ts';
import { verifySeries } from './series-verify.ts';
import { playLikeTheGame } from './test-support.ts';

const ids = BALLS.map((ball) => ball.id);

/** A Best of 5 against `bot` as the game sets one up, played to the end: its link's setup. */
function decided(format: Format, seed: number, bot: string): SeriesSetup {
  const opponent = { kind: 'bot', bot, lineupSeed: seed } as const;
  const setup: SeriesSetup = {
    ruleset: RULESET_VERSION,
    seed,
    a: botFor(opponent).pickLineup(seed + 1000, ids, 5),
    b: botFor(opponent).pickLineup(seed, ids, 5),
    opponent,
    bestOf: 5,
    ...(format === 'blind' ? {} : { format }),
  };
  return setupWithPicks(playLikeTheGame(setup, BALL_LOOKUP));
}

const reasonOf = (setup: SeriesSetup) => {
  const verdict = verifySeries(setup, BALL_LOOKUP);
  return verdict.ok ? 'ok' : verdict.reason;
};

describe('verifySeries, Best of 5', () => {
  it('accepts every format against every level, with the state the game reached', () => {
    for (const format of ['blind', 'reveal', 'showdown'] as const) {
      for (const bot of BOT_LEVELS) {
        const setup = decided(format, 3, bot.id);
        const verdict = verifySeries(setup, BALL_LOOKUP);
        expect(verdict.ok, `${format} ${bot.id}`).toBe(true);
        if (!verdict.ok) continue;
        expect(verdict.state).toStrictEqual(playLikeTheGame(setup, BALL_LOOKUP));
        const { a, b } = { a: 0, b: 0, ...count(verdict.state.rounds.map((r) => r.winner)) };
        expect(Math.max(a, b)).toBe(3);
        expect(Math.min(a, b)).toBeLessThan(3);
        // Reveal and Showdown record two picks for every round but the last.
        const picks = setup.picks?.length ?? 0;
        expect(picks).toBe(format === 'blind' ? 0 : 2 * Math.min(4, verdict.state.rounds.length));
      }
    }
  });

  it('refuses a length the game does not play, or lineups of another length', () => {
    const setup = decided('reveal', 3, 'hard');
    expect(reasonOf({ ...setup, bestOf: 7 as 5 })).toMatch(/Best of 3 or Best of 5/);
    expect(reasonOf({ ...setup, bestOf: 4 as 5 })).toMatch(/Best of 3 or Best of 5/);
    // Said to be a Best of 3: five balls are not a Best of 3 lineup.
    const short = Object.fromEntries(
      Object.entries(setup).filter(([key]) => key !== 'bestOf'),
    ) as SeriesSetup;
    expect(reasonOf(short)).toMatch(/not 3 different balls/);
    expect(reasonOf({ ...setup, a: setup.a.slice(0, 3) })).toMatch(/not 5 different balls/);
  });

  it('refuses a bot lineup or a bot pick the bot would not make, and a missing or extra pick', () => {
    const setup = decided('reveal', 3, 'normal');
    const [x = '', y = '', ...rest] = setup.b;
    expect(reasonOf({ ...setup, b: [y, x, ...rest] })).toMatch(/lineup the normal bot picks/);
    const picks = setup.picks ?? [];
    expect(reasonOf({ ...setup, picks: picks.slice(0, -1) })).toMatch(/needs a pick/);
    expect(reasonOf({ ...setup, picks: [...picks, setup.a[0] ?? ''] })).toMatch(/never used/);
    // Each bot pick swapped for another ball it had: refused at that pick, or a later one.
    const hard = decided('showdown', 3, 'hard');
    const [mine = '', opener = '', ...later] = hard.picks ?? [];
    const swapped = hard.b.find((id) => id !== opener) ?? '';
    expect(reasonOf({ ...hard, picks: [mine, swapped, ...later] })).toMatch(/Pick 2 is not/);
  });
});

function count(sides: readonly string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const side of sides) totals[side] = (totals[side] ?? 0) + 1;
  return totals;
}
