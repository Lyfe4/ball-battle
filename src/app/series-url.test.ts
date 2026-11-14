import { RULESET_VERSION } from '../sim/ruleset.ts';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { randomBot } from '../sim/bot.ts';
import { type SeriesSetup } from '../sim/series.ts';
import { playSeries } from '../sim/series-verify.ts';
import {
  clearSeriesParams,
  parseSeriesParams,
  writeSeriesModeParams,
  writeSeriesParams,
} from './series-url.ts';

const ids = BALLS.map((ball) => ball.id);
const SEED = 3_000_000_001;
/** A series against the bot, as the game sets one up: the bot's lineup picked from the seed. */
const setup: SeriesSetup = {
  ruleset: RULESET_VERSION,
  seed: SEED,
  a: ['thorns', 'sniper', 'berserker'],
  b: randomBot.pickLineup(SEED, ids),
  opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: SEED },
};

const parse = (query: string) => parseSeriesParams(new URLSearchParams(query), ids);

describe('series URL', () => {
  it('round-trips a series through the URL', () => {
    const params = new URLSearchParams('a=storm&b=frost&other=kept');
    writeSeriesParams(params, setup);
    expect(params.get('a')).toBeNull();
    expect(params.get('b')).toBeNull();
    expect(params.get('other')).toBe('kept');
    expect(parseSeriesParams(params, ids)).toStrictEqual({ setup });
  });

  it('replays exactly the same series from its link', () => {
    const params = new URLSearchParams();
    writeSeriesParams(params, setup);
    const fromLink = parseSeriesParams(new URLSearchParams(params.toString()), ids)?.setup;
    if (fromLink === undefined) throw new Error('expected a series in the link');
    expect(playSeries(fromLink, BALL_LOOKUP)).toStrictEqual(playSeries(setup, BALL_LOOKUP));
  });

  it('is not a series link without mode=bo3', () => {
    expect(parse('a=storm&b=frost&seed=4')).toBeUndefined();
    expect(parse('mode=quick&la=storm,frost,venom')).toBeUndefined();
  });

  it('accepts case and spaces in ids, like a quick-match link', () => {
    expect(parse('mode=BO3&la=Storm, frost ,VENOM&lb=archer,quake,sniper&seed=9')).toStrictEqual({
      setup: {
        ruleset: 0,
        seed: 9,
        a: ['storm', 'frost', 'venom'],
        b: ['archer', 'quake', 'sniper'],
        opponent: { kind: 'bot', bot: 'random', lineupSeed: 9 },
      },
    });
  });

  it('records the ruleset a series was played under, and reads a link without one as 0', () => {
    const params = new URLSearchParams();
    writeSeriesParams(params, { ...setup, ruleset: 7 });
    expect(params.get('v')).toBe('7');
    expect(parseSeriesParams(params, ids)?.setup?.ruleset).toBe(7);
    const base = 'mode=bo3&la=storm,frost,venom&lb=archer,quake,sniper&seed=9';
    for (const version of ['', '&v=', '&v=-2', '&v=1.5', '&v=x']) {
      expect(parse(base + version)?.setup?.ruleset).toBe(0);
    }
  });

  it.each([
    ['a duplicate ball', 'la=storm,storm,venom&lb=archer,quake,sniper&seed=9'],
    ['an unknown ball', 'la=storm,frost,nope&lb=archer,quake,sniper&seed=9'],
    ['two balls', 'la=storm,frost&lb=archer,quake,sniper&seed=9'],
    ['four balls', 'la=storm,frost,venom,thorns&lb=archer,quake,sniper&seed=9'],
    ['no seed', 'la=storm,frost,venom&lb=archer,quake,sniper'],
    ['a bad seed', 'la=storm,frost,venom&lb=archer,quake,sniper&seed=-1'],
    ['an empty lineup', 'la=&lb=archer,quake,sniper&seed=9'],
  ])('falls back to the lineup builder for %s', (_case, query) => {
    const link = parse(`mode=bo3&${query}`);
    expect(link).toBeDefined();
    expect(link?.setup).toBeUndefined();
  });

  it('keeps a valid player lineup to prefill the builder when the rest is unusable', () => {
    expect(parse('mode=bo3&la=storm,frost,venom&seed=nope')).toStrictEqual({
      lineup: ['storm', 'frost', 'venom'],
    });
    expect(parse('mode=bo3')).toStrictEqual({});
  });

  it('writes mode only while a series is being built or played, never the bot lineup', () => {
    const params = new URLSearchParams('a=storm&b=frost&seed=5');
    writeSeriesModeParams(params);
    expect(params.toString()).toBe('mode=bo3');
  });

  it('clears every series parameter for a quick match', () => {
    const params = new URLSearchParams();
    writeSeriesParams(params, setup);
    clearSeriesParams(params);
    expect(params.toString()).toBe(`seed=${String(setup.seed)}`);
  });
});

describe('series URL, draft formats', () => {
  // Bot shows, player answers, player shows, bot answers. The parser only checks that each pick
  // is from a lineup; whether it was legal is verifySeries' job.
  const [b0 = '', b1 = '', b2 = ''] = setup.b;
  const reveal: SeriesSetup = {
    ...setup,
    format: 'reveal',
    picks: [b1, 'thorns', 'sniper', b0],
  };
  const showdown: SeriesSetup = {
    ...setup,
    format: 'showdown',
    picks: ['sniper', b2, b0, 'thorns'],
    opponent: { kind: 'bot', bot: 'hard', lineupSeed: SEED },
  };

  it.each<[string, SeriesSetup]>([
    ['reveal, then take turns, with its four picks', reveal],
    ['a showdown against the Hard bot, with its four picks', showdown],
  ])('round-trips %s', (_name, original) => {
    const params = new URLSearchParams();
    writeSeriesParams(params, original);
    expect(parseSeriesParams(new URLSearchParams(params.toString()), ids)).toStrictEqual({
      setup: original,
    });
  });

  it('writes the format, the picks and the bot’s level, and nothing extra for a blind series', () => {
    const params = new URLSearchParams();
    writeSeriesParams(params, showdown);
    expect(params.get('fmt')).toBe('showdown');
    expect(params.get('picks')).toBe(`sniper,${b2},${b0},thorns`);
    expect(params.get('bot')).toBe('hard');
    const blind = new URLSearchParams();
    writeSeriesParams(blind, setup);
    expect(blind.has('fmt')).toBe(false);
    expect(blind.has('picks')).toBe(false);
    // The first bot is what a link without a level means, so its links are unchanged.
    expect(blind.has('bot')).toBe(false);
  });

  it('reads a link without a level as the first bot, and refuses an unknown level, keeping the lineup', () => {
    const query = `mode=bo3&la=thorns,sniper,berserker&lb=${setup.b.join(',')}&seed=${String(SEED)}`;
    expect(parse(query)?.setup?.opponent).toStrictEqual(setup.opponent);
    // Never another bot's series: the sim's decoder refuses it, and the lineup is prefilled.
    expect(parse(`${query}&bot=Genius`)).toStrictEqual({
      lineup: ['thorns', 'sniper', 'berserker'],
    });
  });

  it('keeps the format while a series is built or played', () => {
    const params = new URLSearchParams('fmt=showdown&picks=quake&bot=easy');
    writeSeriesModeParams(params, 'reveal');
    expect(params.toString()).toBe('mode=bo3&fmt=reveal');
    expect(parse('mode=bo3&fmt=showdown')).toStrictEqual({ format: 'showdown' });
    expect(parse('mode=bo3&fmt=Reveal&la=storm,frost,venom')).toStrictEqual({
      lineup: ['storm', 'frost', 'venom'],
      format: 'reveal',
    });
  });

  it('opens a retired "loser picks next" link on the lineup, with Showdown chosen (ADR 0035)', () => {
    expect(
      parse(
        'mode=bo3&fmt=loser&la=storm,frost,venom&lb=quake,thorns,archer&seed=9&picks=thorns&v=5',
      ),
    ).toStrictEqual({ lineup: ['storm', 'frost', 'venom'], format: 'showdown', retiredFrom: 5 });
    expect(parse('mode=bo3&fmt=loser')).toStrictEqual({ format: 'showdown' });
  });

  it.each([
    ['an unknown format', 'fmt=draft'],
    ['picks in a blind series', 'picks=venom'],
    ['too few picks in a reveal series', 'fmt=reveal&picks=venom'],
    ['a pick from neither lineup', 'fmt=showdown&picks=storm,venom,brawler,thorns'],
    ['too many picks', 'fmt=showdown&picks=thorns,venom,sniper,brawler,berserker'],
  ])('falls back to the lineup builder for %s', (_case, query) => {
    const link = parse(
      `mode=bo3&la=thorns,sniper,berserker&lb=venom,brawler,quake&seed=5&${query}`,
    );
    expect(link?.setup).toBeUndefined();
    expect(link?.lineup).toStrictEqual(['thorns', 'sniper', 'berserker']);
  });

  it('keeps the seed the bot picked its lineup from after a rematch (bs=), and only then', () => {
    const rematch: SeriesSetup = { ...setup, seed: 12 };
    const params = new URLSearchParams();
    writeSeriesParams(params, rematch);
    expect(params.get('bs')).toBe(String(SEED));
    expect(parseSeriesParams(params, ids)).toStrictEqual({ setup: rematch });
    expect(playSeries(rematch, BALL_LOOKUP).winner).toBeDefined();
    const first = new URLSearchParams();
    writeSeriesParams(first, setup);
    expect(first.has('bs')).toBe(false);
  });

  it('names the setup step while a series is set up, and drops it in a whole series link', () => {
    const params = new URLSearchParams('a=storm&b=frost&seed=4');
    writeSeriesModeParams(params, 'reveal', 'answer');
    expect(params.toString()).toBe('mode=bo3&fmt=reveal&step=answer');
    expect(parseSeriesParams(params, ids)).toStrictEqual({ format: 'reveal', step: 'answer' });
    expect(parse('mode=bo3&step=nonsense')).toStrictEqual({});
    writeSeriesParams(params, setup);
    expect(params.get('step')).toBeNull();
    clearSeriesParams(params);
    expect(params.has('mode')).toBe(false);
    expect(params.has('step')).toBe(false);
  });

  it('sends a reveal link from before the turns (no picks) back to the lineup, prefilled', () => {
    expect(
      parse('mode=bo3&fmt=reveal&la=thorns,sniper,berserker&lb=venom,brawler,quake&seed=9'),
    ).toStrictEqual({
      lineup: ['thorns', 'sniper', 'berserker'],
      format: 'reveal',
    });
    expect(parse('mode=bo3&fmt=reveal&step=order')).toStrictEqual({ format: 'reveal' });
  });
});
