import { RULESET_VERSION } from '../sim/ruleset.ts';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { awaitingPick, remainingOf, type SeriesSetup } from '../sim/series.ts';
import { matchWorld, playSeries, playToEnd } from '../sim/series-verify.ts';
import {
  advanceSession,
  pickInSession,
  beginSession,
  settleCurrent,
  type SeriesSession,
} from './series-session.ts';

const setup: SeriesSetup = {
  ruleset: RULESET_VERSION,
  opponent: { kind: 'player' },
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

describe('series session, loser picks next', () => {
  const loser: SeriesSetup = { ...setup, format: 'loser' };

  it('has no current match while a pick is due, and plays the picked ball after it', () => {
    let session = beginSession(loser);
    // Play round 1 to its end, whatever its result.
    for (;;) {
      const current = session.current;
      if (current === undefined) throw new Error('expected a match');
      session = settleCurrent(session, playToEnd(matchWorld(current, BALL_LOOKUP), BALL_LOOKUP));
      session = advanceSession(session);
      if (session.state.rounds.length > 0) break;
    }
    const due = awaitingPick(session.state);
    if (due === undefined) throw new Error('expected a pick after round 1');
    expect(session.current).toBeUndefined();
    const ball = remainingOf(session.state, due).at(-1);
    if (ball === undefined) throw new Error('expected a ball left');
    const picked = pickInSession(session, ball);
    expect(picked.current?.[due]).toBe(ball);
    expect(picked.recorded).toBe(false);
  });
});
