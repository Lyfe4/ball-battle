// Best of 5 links (ADR 0048): `mode=bo5`, five balls a lineup, six to eight picks. A Best of 3 link
// reads exactly as before, and a tampered Best of 5 link is refused by verifySeries on the route.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { botFor } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { setupWithPicks, type Format, type SeriesSetup } from '../sim/series.ts';
import { playLikeTheGame } from '../sim/test-support.ts';
import { parseRoute } from './route.ts';
import { parseSeriesParams, writeSeriesModeParams, writeSeriesParams } from './series-url.ts';

const ids = BALLS.map((ball) => ball.id);

function decided(format: Format, seed: number, bot = 'hard'): SeriesSetup {
  const opponent = { kind: 'bot', bot, lineupSeed: seed } as const;
  return setupWithPicks(
    playLikeTheGame(
      {
        ruleset: RULESET_VERSION,
        seed,
        a: ['thorns', 'sniper', 'berserker', 'storm', 'ghost'],
        b: botFor(opponent).pickLineup(seed, ids, 5),
        opponent,
        bestOf: 5,
        ...(format === 'blind' ? {} : { format }),
      },
      BALL_LOOKUP,
    ),
  );
}

const linkOf = (setup: SeriesSetup) => {
  const params = new URLSearchParams();
  writeSeriesParams(params, setup);
  return params;
};

describe('series URL, Best of 5', () => {
  it('round-trips a decided series of each format, as mode=bo5', () => {
    for (const format of ['blind', 'reveal', 'showdown'] as const) {
      const setup = decided(format, 7);
      const params = linkOf(setup);
      expect(params.get('mode')).toBe('bo5');
      expect(parseSeriesParams(new URLSearchParams(params.toString()), ids)).toStrictEqual({
        setup,
      });
      expect(parseRoute(params, BALL_LOOKUP)).toMatchObject({ screen: 'series', step: 'play' });
    }
  });

  it('writes a Best of 3 link exactly as before: mode=bo3 and no length', () => {
    const params = new URLSearchParams();
    writeSeriesModeParams(params, 'reveal', 'lineup');
    expect(params.toString()).toBe('mode=bo3&fmt=reveal&step=lineup');
    writeSeriesModeParams(params, 'reveal', 'lineup', 5);
    expect(params.toString()).toBe('mode=bo5&fmt=reveal&step=lineup');
    const link = parseSeriesParams(new URLSearchParams('mode=bo3&fmt=showdown&step=lineup'), ids);
    expect(link).toStrictEqual({ format: 'showdown', step: 'lineup' });
    expect(parseSeriesParams(new URLSearchParams('mode=bo5&step=lineup'), ids)).toStrictEqual({
      step: 'lineup',
      bestOf: 5,
    });
  });

  it('opens a tampered link’s lineup, at its length, rather than replaying it', () => {
    const setup = decided('reveal', 7);
    const tamper = (change: (params: URLSearchParams) => void) => {
      const params = linkOf(setup);
      change(params);
      return parseRoute(params, BALL_LOOKUP);
    };
    const picks = setup.picks ?? [];
    const [x = '', y = '', ...rest] = setup.b;
    for (const route of [
      tamper((p) => {
        p.set('lb', [y, x, ...rest].join(','));
      }),
      tamper((p) => {
        p.set('picks', [...picks.slice(0, -2), picks.at(-1), picks.at(-2)].join(','));
      }),
      tamper((p) => {
        p.set('picks', picks.slice(0, 5).join(','));
      }),
    ]) {
      expect(route).toMatchObject({ screen: 'series', step: 'lineup' });
      if (route.screen === 'series') expect(route.link.bestOf).toBe(5);
    }
    // A Best of 5's balls in a Best of 3 link are not a lineup at all.
    const short = tamper((p) => {
      p.set('mode', 'bo3');
    });
    expect(short).toMatchObject({ screen: 'series', step: 'rules', link: {} });
    // Nine picks is more than any Best of 5 records.
    const many = tamper((p) => {
      p.set('picks', [...picks, ...picks].slice(0, 9).join(','));
    });
    expect(many).toMatchObject({ screen: 'series', step: 'lineup' });
  });
});
