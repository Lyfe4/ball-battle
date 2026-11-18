import { describe, expect, it } from 'vitest';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { DEFAULT_MATCHUP } from './matchup.ts';
import { createRouter, type ScreenHandlers } from './router.ts';
import {
  initialAppState,
  isCalmMoment,
  isSetupScreen,
  readyMomentOf,
  resumesMatch,
  screenTitle,
  seriesRound,
} from './screen-rules.ts';

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
      manual: handler('manual'),
      pick: handler('pick'),
      match: handler('match'),
      series: handler('series'),
      outdated: handler('outdated'),
      online: handler('online'),
      challenge: handler('challenge'),
      send: handler('send'),
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

describe('isSetupScreen', () => {
  it('is every setup and reading screen, and a series only while nothing is played', () => {
    for (const screen of ['pick', 'manual', 'outdated', 'send'] as const) {
      expect(isSetupScreen(screen, false)).toBe(true);
    }
    expect(isSetupScreen('home', false)).toBe(false);
    expect(isSetupScreen('match', false)).toBe(false);
    expect(isSetupScreen('series', false)).toBe(true);
    expect(isSetupScreen('series', true)).toBe(false);
  });
});

describe('isCalmMoment', () => {
  it('is home and an offline series that is over: never a fight, a setup or anything online', () => {
    expect(isCalmMoment('home', undefined)).toBe(true);
    expect(isCalmMoment('series', 'finished')).toBe(true);
    expect(isCalmMoment('series', 'playing')).toBe(false);
    expect(isCalmMoment('series', 'between')).toBe(false);
    expect(isCalmMoment('series', undefined)).toBe(false);
    for (const screen of ['match', 'pick', 'manual', 'outdated', 'send', 'challenge'] as const) {
      expect(isCalmMoment(screen, undefined)).toBe(false);
    }
    // A live match, or an online series even once it is over (a rematch can be on its way).
    for (const phase of ['playing', 'between', 'finished', undefined]) {
      expect(isCalmMoment('online', phase)).toBe(false);
    }
  });
});

describe('screenTitle', () => {
  it('names each screen, a series by its length and a manual entry by its ball', () => {
    expect(screenTitle('home')).toBe('BallBattle: build a lineup, watch it fight');
    expect(screenTitle('series')).toBe('Best of 3 · BallBattle');
    expect(screenTitle('series', 3)).toBe('Best of 3 · BallBattle');
    expect(screenTitle('series', 5)).toBe('Best of 5 · BallBattle');
    expect(screenTitle('send')).toBe('vs Friend · BallBattle');
    expect(screenTitle('series', 5, undefined, true)).toBe('vs Bot · BallBattle');
    expect(screenTitle('manual')).toBe('Ball manual · BallBattle');
    expect(screenTitle('manual', undefined, 'Frost')).toBe('Frost · Ball manual · BallBattle');
  });
});

describe('readyMomentOf', () => {
  it('labels the home demo while it waits on a still frame (ADR 0055)', () => {
    expect(readyMomentOf('home', false, false)).toBe('demo');
    expect(readyMomentOf('home', false, false, true)).toBe('still');
    expect(readyMomentOf('series', true, true, true)).toBe('live');
    expect(readyMomentOf('match', false, false, true)).toBe('quick');
  });
});
