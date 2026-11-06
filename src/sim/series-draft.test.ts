import { RULESET_VERSION } from './ruleset.ts';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from './balls/index.ts';
import { botPick, randomBot } from './bot.ts';
import {
  awaitingPick,
  nextMatch,
  outcomeOf,
  recordOutcome,
  recordPick,
  remainingOf,
  setupWithPicks,
  startSeries,
  type Outcome,
  type SeriesSetup,
  type SeriesState,
} from './series.ts';
import { playSeries, playToEnd, matchWorld } from './series-verify.ts';
import { deepFreeze } from './test-support.ts';

const showdown: SeriesSetup = deepFreeze({
  ruleset: RULESET_VERSION,
  opponent: { kind: 'player' },
  seed: 7,
  a: ['speedster', 'vampire', 'archer'],
  b: ['storm', 'frost', 'quake'],
  format: 'showdown',
});

/** Both openers (A's first), then round 1's result. */
const opened = (a: string, b: string, outcome: Outcome): SeriesState =>
  recordOutcome(recordPick(recordPick(startSeries(showdown), a), b), outcome);

describe('showdown (ADR 0035)', () => {
  it('asks both sides for an opener, A first, and plays nothing before both have picked', () => {
    let state = startSeries(showdown);
    expect(awaitingPick(state)).toBe('a');
    expect(nextMatch(state)).toBeUndefined();
    state = recordPick(state, 'archer');
    expect(awaitingPick(state)).toBe('b');
    expect(nextMatch(state)).toBeUndefined();
    state = recordPick(state, 'frost');
    expect(awaitingPick(state)).toBeUndefined();
    expect(nextMatch(state)).toMatchObject({ round: 0, a: 'archer', b: 'frost' });
  });

  it('has the winner of round 1 show first in round 2 and the loser answer', () => {
    const youWon = opened('archer', 'frost', 'a');
    expect(awaitingPick(youWon)).toBe('a');
    const shown = recordPick(youWon, 'vampire');
    expect(awaitingPick(shown)).toBe('b');
    const answered = recordPick(shown, 'storm');
    expect(nextMatch(answered)).toMatchObject({ round: 1, a: 'vampire', b: 'storm' });

    const botWon = opened('archer', 'frost', 'b');
    expect(awaitingPick(botWon)).toBe('b');
    expect(awaitingPick(recordPick(botWon, 'quake'))).toBe('a');
  });

  it('plays round 3 with the balls left, with nothing to pick', () => {
    const state = recordOutcome(
      recordPick(recordPick(opened('archer', 'frost', 'a'), 'vampire'), 'storm'),
      'b',
    );
    expect(awaitingPick(state)).toBeUndefined();
    expect(nextMatch(state)).toMatchObject({ round: 2, a: 'speedster', b: 'quake' });
  });

  it('asks for no pick while a drawn round is replayed, and rejects a ball already played', () => {
    const drawn = recordOutcome(
      recordPick(recordPick(startSeries(showdown), 'archer'), 'frost'),
      'draw',
    );
    expect(awaitingPick(drawn)).toBeUndefined();
    expect(nextMatch(drawn)).toMatchObject({ round: 0, attempt: 1, a: 'archer', b: 'frost' });
    const after = opened('archer', 'frost', 'a');
    expect(() => recordPick(after, 'archer')).toThrow(/has left/);
    expect(() => recordPick(after, 'storm')).toThrow(/has left/);
  });

  it('replays the same series from its setup and picks, and refuses missing or unused picks', () => {
    let state = startSeries(showdown);
    for (let guard = 0; guard < 12 && state.winner === undefined; guard++) {
      const due = awaitingPick(state);
      if (due !== undefined) {
        state = recordPick(state, remainingOf(state, due).at(-1) ?? '');
        continue;
      }
      const match = nextMatch(state);
      if (match === undefined) break;
      const end = playToEnd(matchWorld(match, BALL_LOOKUP), BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('unfinished');
      state = recordOutcome(state, outcomeOf(end.match.result, end));
    }
    const replay = setupWithPicks(state);
    expect(replay.picks).toHaveLength(4);
    expect(playSeries(replay, BALL_LOOKUP).rounds).toStrictEqual(state.rounds);
    expect(() => playSeries(showdown, BALL_LOOKUP)).toThrow(/needs a pick/);
    const extra = [...(replay.picks ?? []), 'archer'];
    expect(() => playSeries({ ...showdown, picks: extra }, BALL_LOOKUP)).toThrow(/pick/);
  });
});

describe('reveal, then take turns (ADR 0021)', () => {
  const reveal: SeriesSetup = deepFreeze({
    ruleset: RULESET_VERSION,
    opponent: { kind: 'player' },
    seed: 11,
    a: ['frost', 'thorns', 'sniper'],
    b: ['venom', 'quake', 'brawler'],
    format: 'reveal',
  });
  const pickAll = (state: SeriesState, mine: readonly string[]): SeriesState => {
    let next = state;
    for (let guard = 0; guard < 8; guard++) {
      const due = awaitingPick(next);
      if (due === undefined) return next;
      const own = mine.find((id) => remainingOf(next, 'a').includes(id));
      next = recordPick(next, due === 'b' ? (botPick(randomBot, next) ?? '') : (own ?? ''));
    }
    return next;
  };

  it('has the bot show first in round 1 and the player first in round 2, and no picks in round 3', () => {
    let state = startSeries(reveal);
    expect(awaitingPick(state)).toBe('b');
    expect(nextMatch(state)).toBeUndefined();
    state = recordPick(state, 'quake');
    expect(awaitingPick(state)).toBe('a');
    state = recordPick(state, 'frost');
    expect(awaitingPick(state)).toBeUndefined();
    expect(nextMatch(state)).toMatchObject({ round: 0, a: 'frost', b: 'quake' });
    state = recordOutcome(state, 'b');
    expect(awaitingPick(state)).toBe('a');
    state = recordPick(state, 'sniper');
    expect(awaitingPick(state)).toBe('b');
    state = recordPick(state, 'brawler');
    expect(nextMatch(state)).toMatchObject({ round: 1, a: 'sniper', b: 'brawler' });
    state = recordOutcome(state, 'a');
    // 1-1: round 3 is the balls each side has left, with nothing to pick.
    expect(awaitingPick(state)).toBeUndefined();
    expect(nextMatch(state)).toMatchObject({ round: 2, a: 'thorns', b: 'venom' });
  });

  it('asks for no pick while a drawn round is replayed', () => {
    const drawn = recordOutcome(
      recordPick(recordPick(startSeries(reveal), 'quake'), 'frost'),
      'draw',
    );
    expect(awaitingPick(drawn)).toBeUndefined();
    expect(nextMatch(drawn)).toMatchObject({ round: 0, attempt: 1, a: 'frost', b: 'quake' });
  });

  it('replays the same series from its setup and picks, and refuses an old reveal setup with none', () => {
    let state = startSeries(reveal);
    for (let guard = 0; guard < 12 && state.winner === undefined; guard++) {
      state = pickAll(state, ['sniper', 'frost', 'thorns']);
      const match = nextMatch(state);
      if (match === undefined) break;
      const end = playToEnd(matchWorld(match, BALL_LOOKUP), BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('unfinished');
      state = recordOutcome(state, outcomeOf(end.match.result, end));
    }
    expect(state.winner).toBeDefined();
    const replay = setupWithPicks(state);
    expect(replay.picks).toHaveLength(4);
    expect(playSeries(replay, BALL_LOOKUP).rounds).toStrictEqual(state.rounds);
    expect(playSeries(replay, BALL_LOOKUP)).toStrictEqual(playSeries(replay, BALL_LOOKUP));
    expect(() => playSeries(reveal, BALL_LOOKUP)).toThrow(/pick/);
  });
});
