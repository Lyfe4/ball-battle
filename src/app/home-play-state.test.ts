import { describe, expect, it } from 'vitest';
import type { CurrentMatch } from '../api/live.ts';
import { homeOnAnswer, homeOnArrival, type HomePlay } from './home-play-state.ts';

const start: CurrentMatch = { kind: 'start', id: 's1', format: 'reveal', bestOf: 3 };
const series: CurrentMatch = {
  kind: 'series',
  id: 'x1',
  format: 'showdown',
  bestOf: 5,
  opponent: 'Robin',
};
const lobby: CurrentMatch = {
  kind: 'lobby',
  token: 't1',
  format: 'reveal',
  bestOf: 3,
  invitee: 'Robin',
  stopsInMs: 60_000,
};
const play: HomePlay = { kind: 'play' };
const waiting: HomePlay = { kind: 'waiting' };

describe('Play on arrival', () => {
  it('waits for the server on a device that played online and knows of no match', () => {
    expect(homeOnArrival(true, undefined)).toStrictEqual(waiting);
    // "Nothing" learnt earlier may be stale (another device): it still waits.
    expect(homeOnArrival(true, null)).toStrictEqual(waiting);
  });

  it('shows the way back at once when the page knows of a lineup, match or lobby', () => {
    for (const match of [start, series, lobby]) {
      expect(homeOnArrival(true, match)).toStrictEqual({ kind: 'back', match });
    }
  });

  it('is Play at once on a device that never played online', () => {
    expect(homeOnArrival(false, undefined)).toStrictEqual(play);
    expect(homeOnArrival(false, start)).toStrictEqual(play);
  });
});

describe('Play once the server answers', () => {
  it('is what the server says', () => {
    expect(homeOnAnswer(waiting, null)).toStrictEqual(play);
    expect(homeOnAnswer(waiting, start)).toStrictEqual({ kind: 'back', match: start });
    // A lineup known a moment ago became its match: the answer wins.
    expect(homeOnAnswer({ kind: 'back', match: start }, series)).toStrictEqual({
      kind: 'back',
      match: series,
    });
    expect(homeOnAnswer({ kind: 'back', match: start }, null)).toStrictEqual(play);
  });

  it('never waits forever: no answer while waiting is Play (offline vs Bot works)', () => {
    expect(homeOnAnswer(waiting, undefined)).toStrictEqual(play);
  });

  it('keeps what shows when a later ask has no answer', () => {
    const back: HomePlay = { kind: 'back', match: lobby };
    expect(homeOnAnswer(back, undefined)).toBe(back);
    expect(homeOnAnswer(play, undefined)).toBe(play);
  });
});
