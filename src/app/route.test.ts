import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { DEFAULT_MATCHUP } from './matchup.ts';
import { parseRoute } from './route.ts';

const ids = BALLS.map((ball) => ball.id);
const route = (query: string) => parseRoute(new URLSearchParams(query), ids);

describe('parseRoute', () => {
  it('opens every link shape the game has written on the screen it was written from', () => {
    expect(route('a=storm&b=frost&seed=42')).toStrictEqual({
      screen: 'match',
      matchup: { a: 'storm', b: 'frost' },
      seed: 42,
    });
    expect(route('mode=bo3&la=storm,frost,venom&lb=quake,thorns,archer&seed=9')).toStrictEqual({
      screen: 'series',
      link: {
        setup: { seed: 9, a: ['storm', 'frost', 'venom'], b: ['quake', 'thorns', 'archer'] },
      },
    });
    expect(
      route('mode=bo3&fmt=loser&la=storm,frost,venom&lb=quake,thorns,archer&seed=9&picks=thorns'),
    ).toMatchObject({ screen: 'series', link: { setup: { format: 'loser', picks: ['thorns'] } } });
    expect(route('mode=bo3&fmt=reveal')).toStrictEqual({
      screen: 'series',
      link: { format: 'reveal' },
    });
    expect(route('mode=bo3')).toStrictEqual({ screen: 'series', link: {} });
  });

  it('opens a match without a seed when the link has none or a bad one, so a fresh one is used', () => {
    expect(route('a=storm&b=frost')).toMatchObject({ screen: 'match', seed: undefined });
    expect(route('a=storm&b=frost&seed=-1')).toMatchObject({ screen: 'match', seed: undefined });
  });

  it('falls back instead of failing on a typo', () => {
    expect(route('a=nope&b=FROST')).toMatchObject({ matchup: { a: 'speedster', b: 'frost' } });
    expect(route('mode=bo3&la=storm,storm,frost')).toStrictEqual({ screen: 'series', link: {} });
  });

  it('opens a quick match with the default balls on a bare URL', () => {
    expect(route('')).toStrictEqual({ screen: 'match', matchup: DEFAULT_MATCHUP, seed: undefined });
  });
});
