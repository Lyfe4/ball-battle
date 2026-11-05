import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import {
  clearView,
  parseRoute,
  writeHomeParams,
  writeManualParams,
  writeMatchUrl,
  writePickParams,
} from './route.ts';

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
      step: 'play',
    });
    expect(
      route('mode=bo3&fmt=loser&la=storm,frost,venom&lb=quake,thorns,archer&seed=9&picks=thorns'),
    ).toMatchObject({ screen: 'series', link: { setup: { format: 'loser', picks: ['thorns'] } } });
    expect(route('mode=bo3&fmt=reveal')).toStrictEqual({
      screen: 'series',
      link: { format: 'reveal' },
      step: 'rules',
    });
    expect(route('mode=bo3')).toStrictEqual({ screen: 'series', link: {}, step: 'rules' });
    expect(route('mode=bo3&la=storm,frost,venom')).toMatchObject({ step: 'lineup' });
    expect(route('mode=bo3&fmt=loser&step=lineup')).toMatchObject({ step: 'lineup' });
  });

  it('opens a match without a seed when the link has none or a bad one, so a fresh one is used', () => {
    expect(route('a=storm&b=frost')).toMatchObject({ screen: 'match', seed: undefined });
    expect(route('a=storm&b=frost&seed=-1')).toMatchObject({ screen: 'match', seed: undefined });
  });

  it('falls back instead of failing on a typo', () => {
    expect(route('a=nope&b=FROST')).toMatchObject({ matchup: { a: 'speedster', b: 'frost' } });
    expect(route('mode=bo3&la=storm,storm,frost')).toStrictEqual({
      screen: 'series',
      link: {},
      step: 'rules',
    });
  });

  it('opens home on a bare URL, and a match as soon as the link names a ball or a seed', () => {
    expect(route('')).toStrictEqual({ screen: 'home' });
    expect(route('utm_source=x')).toStrictEqual({ screen: 'home' });
    expect(route('a=storm')).toMatchObject({ screen: 'match', matchup: { a: 'storm' } });
    expect(route('seed=4')).toMatchObject({ screen: 'match', seed: 4 });
  });

  it('writes a match over any other screen, and home as a bare URL', () => {
    const params = new URLSearchParams('view=pick&mode=bo3&step=lineup&fmt=loser');
    writeMatchUrl(params, { a: 'venom', b: 'quake' }, 12);
    expect(params.toString()).toBe('a=venom&b=quake&seed=12');
    writeHomeParams(params);
    expect(parseRoute(params, ids)).toStrictEqual({ screen: 'home' });
  });

  it('opens the quick-match setup prefilled, and round-trips it', () => {
    expect(route('view=pick&a=storm&b=vampire')).toStrictEqual({
      screen: 'pick',
      matchup: { a: 'storm', b: 'vampire' },
    });
    const params = new URLSearchParams('mode=bo3&seed=4&fmt=loser');
    writePickParams(params, { a: 'frost', b: 'quake' });
    expect(params.toString()).toBe('view=pick&a=frost&b=quake');
    expect(parseRoute(params, ids)).toStrictEqual({
      screen: 'pick',
      matchup: { a: 'frost', b: 'quake' },
    });
    clearView(params);
    expect(parseRoute(params, ids)).toMatchObject({ screen: 'match', matchup: { a: 'frost' } });
  });

  it('opens the manual on the roster, a ball, or the chart, and ignores an unknown ball', () => {
    expect(route('view=manual')).toStrictEqual({ screen: 'manual', ball: undefined, chart: false });
    expect(route('view=manual&ball=Storm')).toMatchObject({ ball: 'storm', chart: false });
    expect(route('view=manual&ball=nope')).toMatchObject({ ball: undefined });
    expect(route('view=manual&tab=chart')).toMatchObject({ ball: undefined, chart: true });
    const params = new URLSearchParams('a=storm&b=frost&seed=3');
    writeManualParams(params, { ball: 'venom' });
    expect(params.toString()).toBe('view=manual&ball=venom');
    writeManualParams(params, { chart: true });
    expect(params.toString()).toBe('view=manual&tab=chart');
  });
});
