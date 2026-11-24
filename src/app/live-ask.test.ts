import { describe, expect, it } from 'vitest';
import { AWAY_AFTER_MS, type LiveView } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import {
  HEARTBEAT_ASK_MS,
  HEARTBEAT_GAP_MS,
  liveAskMs,
  WAITING_ASK_MS,
  waitsOnOther,
} from './live-ask.ts';

const T = 1_700_000_000_000;
/** A quick read: the heartbeat's whole wait. */
const QUICK = 300;

/** A live series of this player's (side a) as the server sends it. */
function seriesOf(
  turn: SeriesView['turn'],
  live: Partial<LiveView>,
  status: SeriesView['status'] = 'open',
): SeriesView {
  return {
    you: 'a',
    turn,
    status,
    live: {
      startedAt: T - 20_000,
      startBy: T,
      opensAt: T - 1_000,
      fights: [],
      auto: [],
      away: null,
      endReason: null,
      ...live,
    },
  } as unknown as SeriesView;
}

describe('how often a live page asks', () => {
  it('asks every second while the other player still has to arrive', () => {
    expect(liveAskMs(seriesOf(null, { startedAt: null, opensAt: null }), T, QUICK)).toBe(
      WAITING_ASK_MS,
    );
  });

  it('asks every second while the pick open is theirs', () => {
    expect(liveAskMs(seriesOf('b', {}), T, QUICK)).toBe(WAITING_ASK_MS);
  });

  it('asks only for the heartbeat while the pick open is this player’s own', () => {
    expect(liveAskMs(seriesOf('a', {}), T, QUICK)).toBe(HEARTBEAT_ASK_MS);
  });

  it('asks only for the heartbeat while both pick at once (Showdown), until this one has', () => {
    expect(liveAskMs(seriesOf('both', {}), T, QUICK)).toBe(HEARTBEAT_ASK_MS);
    expect(liveAskMs(seriesOf('b', {}), T, QUICK)).toBe(WAITING_ASK_MS);
  });

  it('asks only for the heartbeat during a fight, a countdown or the coin toss', () => {
    // Their pick is next, but it opens only when the fight has been watched, 10 s from now.
    const fighting = seriesOf('b', { opensAt: T + 10_000 });
    expect(waitsOnOther(fighting, T)).toBe(false);
    expect(liveAskMs(fighting, T, QUICK)).toBe(HEARTBEAT_ASK_MS);
  });

  it('asks every second from the moment a pick of theirs opens within one heartbeat', () => {
    const ending = seriesOf('b', { opensAt: T + HEARTBEAT_ASK_MS - 1 });
    expect(liveAskMs(ending, T, QUICK)).toBe(WAITING_ASK_MS);
    // This player's own pick opening soon: still the heartbeat.
    expect(liveAskMs(seriesOf('a', { opensAt: T + 500 }), T, QUICK)).toBe(HEARTBEAT_ASK_MS);
  });

  it('asks nothing extra once the series is over, or of a series by turns', () => {
    expect(waitsOnOther(seriesOf('b', {}, 'finished'), T)).toBe(false);
    expect(waitsOnOther({ ...seriesOf('b', {}), live: null }, T)).toBe(false);
  });

  it('waits less after a slow read, so heartbeats never land further apart than before', () => {
    const own = seriesOf('a', {});
    expect(liveAskMs(own, T, 1_500)).toBe(HEARTBEAT_GAP_MS - 1_500);
    // A read as slow as a cold function's (3.3 s): the old 1 s cadence, no slower.
    expect(liveAskMs(own, T, 3_300)).toBe(WAITING_ASK_MS);
    for (const readMs of [0, 500, 1_000, 2_000, 3_300, 5_000]) {
      expect(liveAskMs(own, T, readMs) + readMs).toBeLessThanOrEqual(
        Math.max(HEARTBEAT_GAP_MS, readMs + WAITING_ASK_MS),
      );
    }
  });

  it('keeps two heartbeats with quick reads well inside the time to be called away', () => {
    expect(HEARTBEAT_GAP_MS * 2).toBeLessThanOrEqual(AWAY_AFTER_MS);
  });

  describe('with the poke socket up (ADR 0082)', () => {
    it('drops the 1 s waiting reads: the other’s move arrives by poke, the heartbeat stays', () => {
      expect(liveAskMs(seriesOf('b', {}), T, QUICK, true)).toBe(HEARTBEAT_ASK_MS);
      expect(liveAskMs(seriesOf(null, { startedAt: null, opensAt: null }), T, QUICK, true)).toBe(
        HEARTBEAT_ASK_MS,
      );
      expect(liveAskMs(seriesOf('a', {}), T, QUICK, true)).toBe(HEARTBEAT_ASK_MS);
    });

    it('keeps the heartbeat exactly as before, slow reads included', () => {
      const own = seriesOf('a', {});
      for (const readMs of [0, 500, 1_500, 3_300, 5_000]) {
        expect(liveAskMs(seriesOf('b', {}), T, readMs, true)).toBe(liveAskMs(own, T, readMs));
      }
    });
  });
});
