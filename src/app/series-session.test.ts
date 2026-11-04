import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { matchWorld, playSeries, playToEnd, type SeriesSetup } from '../sim/series.ts';
import {
  advanceSession,
  beginSession,
  settleCurrent,
  type SeriesSession,
} from './series-session.ts';

const setup: SeriesSetup = {
  seed: 77,
  a: ['frost', 'thorns', 'sniper'],
  b: ['venom', 'archer', 'speedster'],
};

describe('series session', () => {
  it('records a match once, only when it has finished', () => {
    const session = beginSession(setup);
    const current = session.current;
    if (current === undefined) throw new Error('expected a first match');
    const start = matchWorld(current, BALL_LOOKUP);
    expect(settleCurrent(session, start)).toBe(session);

    const end = playToEnd(start, BALL_LOOKUP);
    const settled = settleCurrent(session, end);
    expect(settled.recorded).toBe(true);
    expect(settled.state.rounds.length + settled.state.pending.length).toBe(1);
    // Later frames show the same finished world: nothing is recorded twice.
    expect(settleCurrent(settled, end)).toBe(settled);
  });

  it('only moves on after recording', () => {
    const session = beginSession(setup);
    expect(advanceSession(session)).toBe(session);
  });

  it('plays the same series as the headless run, match by match', () => {
    let session: SeriesSession = beginSession(setup);
    let guard = 0;
    while (session.current !== undefined) {
      const end = playToEnd(matchWorld(session.current, BALL_LOOKUP), BALL_LOOKUP);
      session = advanceSession(settleCurrent(session, end));
      expect(++guard).toBeLessThan(20);
    }
    expect(session.state).toStrictEqual(playSeries(setup, BALL_LOOKUP));
  });
});
