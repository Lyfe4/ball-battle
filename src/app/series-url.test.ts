import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { playSeries, type SeriesSetup } from '../sim/series.ts';
import {
  clearSeriesParams,
  parseSeriesParams,
  writeSeriesModeParams,
  writeSeriesParams,
} from './series-url.ts';

const ids = BALLS.map((ball) => ball.id);
const setup: SeriesSetup = {
  seed: 3_000_000_001,
  a: ['thorns', 'sniper', 'berserker'],
  b: ['venom', 'brawler', 'quake'],
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
      setup: { seed: 9, a: ['storm', 'frost', 'venom'], b: ['archer', 'quake', 'sniper'] },
    });
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
