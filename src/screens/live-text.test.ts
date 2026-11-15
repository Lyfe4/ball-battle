import { describe, expect, it } from 'vitest';
import type { LiveView } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import { liveEnding, liveFootLine, liveNote } from './live-text.ts';

const T = 1_700_000_000_000;
const clock = (over: Partial<LiveView> = {}): LiveView => ({
  startedAt: T - 10_000,
  startBy: T + 50_000,
  opensAt: T - 4_000,
  fights: [],
  auto: [],
  away: null,
  endReason: null,
  ...over,
});
const series = (over: Partial<SeriesView> = {}, live: Partial<LiveView> = {}) =>
  ({
    you: 'a',
    names: { a: 'Player 1', b: 'Player 2' },
    turn: 'a',
    deadline: new Date(T + 26_000).toISOString(),
    status: 'open',
    winner: null,
    rounds: [],
    live: clock(live),
    ...over,
  }) as unknown as SeriesView;

describe('a live match’s line', () => {
  it('leaves whose pick it is, the seconds and the wait to join to the pick card (ADR 0055)', () => {
    expect(liveNote(series(), 0)).toBeUndefined();
    expect(liveNote(series({ turn: 'b' }), 0)).toBeUndefined();
    expect(liveNote(series({}, { startedAt: null, opensAt: null }), 0)).toBeUndefined();
  });

  it('says when a ball was picked at random, for whom', () => {
    const mine = series({}, { auto: [{ round: 0, side: 'a' }] });
    expect(liveNote(mine, 0)).toBe('Time’s up: a random ball was picked for you.');
    const theirs = series({ turn: 'b' }, { auto: [{ round: 0, side: 'b' }] });
    expect(liveNote(theirs, 0)).toMatch(/^Player 2 ran out of time/);
  });

  it('counts down an opponent who has gone quiet, under the court too', () => {
    const away = series({}, { away: { since: T - 8_000, forfeitAt: T + 28_000 } });
    expect(liveNote(away, 0)).toBeUndefined();
    expect(liveFootLine(away, T, false)).toBe('Player 2 disconnected · 28 s');
    expect(liveFootLine(series(), T, true)).toBe('Reconnecting…');
    expect(liveFootLine(series(), T, false)).toBe('Live · normal speed');
  });

  it('tells each side how a forfeit ended it', () => {
    const left = (winner: 'a' | 'b') =>
      liveEnding(series({ status: 'forfeit', winner }, { endReason: 'left' }));
    expect(left('a')).toBe('Player 2 left the match. You win.');
    expect(left('b')).toBe('You left the match.');
    const gone = (winner: 'a' | 'b') =>
      liveEnding(series({ status: 'forfeit', winner }, { endReason: 'disconnected' }));
    expect(gone('a')).toBe('Player 2 disconnected. You win.');
    expect(gone('b')).toBe('You were away too long and lost.');
    expect(
      liveEnding(series({ status: 'forfeit', winner: null }, { endReason: 'start_missed' })),
    ).toBe('Neither player arrived. Nobody wins.');
    expect(liveEnding(series({ status: 'finished', winner: 'a' }))).toBeUndefined();
  });
});
