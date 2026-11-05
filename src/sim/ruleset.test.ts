// Guards RULESET_VERSION (ADR 0022): a fingerprint of what the rules actually do. It plays a whole
// match for every pair of balls (mirrors included), asks the bot every kind of choice, and plays a
// series in every format, then hashes the results. Any change that can change a fight, a bot's
// choice or a series changes the hash. Only results are hashed, never text or colours, so copy
// changes need no bump.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { randomBot } from './bot.ts';
import { RULESET_VERSION } from './ruleset.ts';
import { FORMATS } from './series.ts';
import { playToEnd } from './series-verify.ts';
import { playLikeTheGame } from './test-support.ts';
import { createWorld } from './world.ts';

/**
 * The fingerprint of each ruleset, by version. Append only: when the test fails, the rules changed,
 * so bump RULESET_VERSION and add the new fingerprint under it. Never edit an existing entry.
 */
const FINGERPRINTS: Readonly<Record<number, string>> = {
  1: '237d0e0229a64f3e5b59a563a6ba8a218e1f24201ac5571795de978bf5ca5023',
};

function fingerprint(): string {
  const ids = BALLS.map((ball) => ball.id);
  const matches = BALLS.flatMap((a, i) =>
    BALLS.slice(i).map((b, j) => {
      const end = playToEnd(createWorld(i * 101 + j, [a, b]), BALL_LOOKUP);
      return { tick: end.tick, match: end.match, balls: end.balls, rng: end.rngState };
    }),
  );
  const lineups = [0, 1, 2, 3].map((seed) => randomBot.pickLineup(seed, ids));
  const lineup = randomBot.pickLineup(7, ids);
  const choices = ids.map((shown) => ({
    show: randomBot.showFirst(shown.length, lineup),
    answer: randomBot.answer(3, 1, ids, shown),
    next: randomBot.pickNext(3, 1, ids, shown),
  }));
  const series = FORMATS.map((format, index) => {
    const a = randomBot.pickLineup(100 + index, ids);
    const b = randomBot.pickLineup(index, ids);
    // The player takes its first remaining ball whenever it picks; the bot picks for itself.
    const state = playLikeTheGame(
      {
        ruleset: RULESET_VERSION,
        opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: index },
        seed: index,
        a,
        b,
        format,
      },
      BALL_LOOKUP,
    );
    return { rounds: state.rounds, picks: state.picks, winner: state.winner };
  });
  const data = JSON.stringify({ matches, lineups, choices, series });
  return createHash('sha256').update(data).digest('hex');
}

describe('the ruleset version', () => {
  it('names the fingerprint of the rules as they are', () => {
    expect(
      fingerprint(),
      'The rules changed: bump RULESET_VERSION in src/sim/ruleset.ts and add the new fingerprint ' +
        'to FINGERPRINTS under it (ADR 0022)',
    ).toBe(FINGERPRINTS[RULESET_VERSION]);
  });

  it('never reuses a fingerprint across versions', () => {
    const hashes = Object.values(FINGERPRINTS);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
