import { describe, expect, it } from 'vitest';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { DEFAULT_MATCHUP } from './matchup.ts';
import { createRouter, type ScreenHandlers } from './router.ts';
import { initialAppState, resumesMatch, seriesRound } from './screen-rules.ts';

const frostQuake = { a: 'frost', b: 'quake' };

describe('initialAppState', () => {
  it('opens with the link’s matchup and seed, else the defaults and a new seed', () => {
    const match = { screen: 'match', matchup: frostQuake, seed: 4 } as const;
    expect(initialAppState(match, 2, () => 9)).toStrictEqual({
      matchup: frostQuake,
      seed: 4,
      speed: 2,
    });
    const unseeded = { ...match, seed: undefined };
    expect(initialAppState(unseeded, 1, () => 9).seed).toBe(9);
    expect(initialAppState({ screen: 'home' }, 1, () => 9)).toStrictEqual({
      matchup: DEFAULT_MATCHUP,
      seed: 9,
      speed: 1,
    });
  });
});

describe('resumesMatch', () => {
  const state = { matchup: frostQuake, seed: 7, speed: 1 } as const;
  const back = { screen: 'match', matchup: frostQuake, seed: 7 } as const;

  it('carries on with the match the setup covered when Back returns to it', () => {
    expect(resumesMatch(back, 'pick', { ...state })).toBe(true);
  });

  it('starts over for another seed, other balls, or arriving from anywhere but the setup', () => {
    expect(resumesMatch({ ...back, seed: 8 }, 'pick', { ...state })).toBe(false);
    expect(resumesMatch({ ...back, seed: undefined }, 'pick', { ...state })).toBe(false);
    expect(
      resumesMatch({ ...back, matchup: { a: 'frost', b: 'venom' } }, 'pick', { ...state }),
    ).toBe(false);
    expect(resumesMatch(back, 'home', { ...state })).toBe(false);
    expect(resumesMatch(back, 'match', { ...state })).toBe(false);
  });
});

describe('seriesRound', () => {
  const setup = {
    ruleset: RULESET_VERSION,
    seed: 1,
    a: ['frost', 'quake', 'venom'],
    b: ['storm', 'archer', 'thorns'],
    opponent: { kind: 'player' },
  } as const;

  const none = { has: false, address: undefined };
  const undecided = { has: true, address: undefined };

  it('replays a link’s series, carries on with one in play, else sets up from the lineup', () => {
    expect(seriesRound({ setup }, none)).toStrictEqual({ replay: setup });
    expect(seriesRound({ setup }, undecided)).toStrictEqual({ replay: setup });
    expect(seriesRound({ format: 'showdown' }, undecided)).toBe('carry on');
    expect(seriesRound({ format: 'showdown' }, none)).toBe('lineup');
  });

  it('carries on with the series in hand when the link is that series (a reload, ADR 0042)', () => {
    expect(seriesRound({ setup }, { has: true, address: { ...setup } })).toBe('carry on');
    // Another series in hand: the link's is replayed, replacing it.
    const other = { ...setup, seed: 2 };
    expect(seriesRound({ setup }, { has: true, address: other })).toStrictEqual({ replay: setup });
  });
});

describe('router', () => {
  function recorder() {
    const log: string[] = [];
    const handler = (name: string) => ({
      show: (_route: unknown, from: string) => log.push(`show ${name} from ${from}`),
      leave: () => log.push(`leave ${name}`),
    });
    const handlers: ScreenHandlers = {
      home: handler('home'),
      modes: handler('modes'),
      manual: handler('manual'),
      pick: handler('pick'),
      match: handler('match'),
      series: handler('series'),
      outdated: handler('outdated'),
    };
    return { log, handlers };
  }

  it('leaves the screen on show only when the route names another, then lays out and shows', () => {
    const { log, handlers } = recorder();
    const router = createRouter(handlers, 'home', (screen) => log.push(`layout ${screen}`));
    router.show({ screen: 'home' });
    router.show({ screen: 'manual', ball: undefined, chart: false });
    expect(router.current()).toBe('manual');
    expect(log).toStrictEqual([
      'layout home',
      'show home from home',
      'leave home',
      'layout manual',
      'show manual from home',
    ]);
  });
});
