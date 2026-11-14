// Guards RULESET_VERSION (ADR 0022): a fingerprint of what the rules actually do. It plays a whole
// match for every pair of balls (mirrors included), asks the bot every kind of choice, and plays a
// series in every format, then hashes the results. Any change that can change a fight, a bot's
// choice or a series changes the hash. Only results are hashed, never text or colours, so copy
// changes need no bump.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { BOTS, randomBot, type BotView } from './bot.ts';
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
  2: '232323a2abbf4b4363d4a5a5bc8e78a71dce6e758c42b2928892fadc0a52be4c',
  3: '76a1e5f3f47156c5693886a54bacc49e19910369ce62ef2f7b56125e230c6bf6',
  4: '0cc1471bbc3b73069e8f3a48903a6af1e18b9aaaaf8da8c377ad65353bfd0a3f',
  5: '925d3b22e2fcedf46c38411b40ae1dd0a3974aa70f0b3b7359e68ce78fca40e8',
  6: '97f73b186fbe7f6c4e8747ce78e765575348444cef5ea0a0ace800d84b0f4410',
  7: 'bcd34175bd9d0b0dcdb68c872d997458e7c6eb58480ac69fac1cddf82d3230f9',
  8: 'd30afeee56301251e9aac472b06cdec23b79fb14a59c0a29c72406e524e75d9e',
  9: '4f5e76487f96f4b37bc94c33d763e0a9880ab6a4c6169c0f189cc47543b61ca1',
  10: '7825a3ce4d3e3893285e5b5b0ddf7fcabacf17f5883467a1f4de17e727268314',
  11: '2a4af4e13f0e6376505b3766a2f8d7223e3b4cca3653685a1cc9837ab1703422',
  12: '7ab968db41438c1a1c1b829254541ed65427ff748b2e41e3869d5fc0c9cda11b',
  13: '09d4bbf424cdda0b3d028d839121400bdc76122740e9781ebb3be6eaa1656149',
  14: '2834371c16f112537887a5f72a591a7be971817eba1245e41b51ba077ce7d489',
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
  // Every bot's every kind of choice, against every ball shown.
  const choices = [...BOTS.values()].map((bot) =>
    ids.map((shown, index) => {
      const opponent = randomBot.pickLineup(index + 50, ids);
      const view = (role: BotView['role'], format: BotView['format']): BotView => ({
        format,
        seed: shown.length + index,
        round: role === 'open' ? 0 : 1,
        role,
        own: lineup,
        opponent,
        ...(role === 'answer' ? { shown } : {}),
        wins: 0,
        losses: role === 'open' ? 0 : 1,
      });
      return {
        show: bot.choose(view('show', 'reveal')),
        answer: bot.choose(view('answer', 'reveal')),
        open: bot.choose(view('open', 'showdown')),
        showdownShow: bot.choose(view('show', 'showdown')),
      };
    }),
  );
  const series = [...BOTS.keys()].flatMap((bot) =>
    FORMATS.map((format, index) => {
      const a = randomBot.pickLineup(100 + index, ids);
      const b = randomBot.pickLineup(index, ids);
      // The player takes its first remaining ball whenever it picks; the bot picks for itself.
      const state = playLikeTheGame(
        {
          ruleset: RULESET_VERSION,
          opponent: { kind: 'bot', bot, lineupSeed: index },
          seed: index,
          a,
          b,
          format,
        },
        BALL_LOOKUP,
      );
      return { rounds: state.rounds, picks: state.picks, winner: state.winner };
    }),
  );
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
