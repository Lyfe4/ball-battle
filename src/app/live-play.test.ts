import { describe, expect, it } from 'vitest';
import { attemptWatchMs } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import type { RoundRecord } from '../sim/series.ts';
import { attemptSlots, livePlace, secondsUntil } from './live-play.ts';

const T = 1_700_000_000_000;
const round = (index: number, seeds: number[]): RoundRecord => ({
  round: index,
  a: 'archer',
  b: 'brawler',
  seeds,
  outcomes: seeds.map((_, i) => (i === seeds.length - 1 ? 'a' : 'draw')),
  winner: 'a',
  suddenDeath: false,
});

/** Round 0: one attempt of 600 ticks. Round 1: a draw (3600 ticks), then 900. */
const TICKS: Record<number, number[]> = { 0: [600], 1: [3600, 900] };
const r0End = T + attemptWatchMs(600);
const r1At = r0End + 3_000;
const r1End = r1At + attemptWatchMs(3600) + attemptWatchMs(900);

const view = {
  rounds: [round(0, [1]), round(1, [2, 3])],
  live: {
    startedAt: T - 60_000,
    startBy: T,
    opensAt: null,
    fights: [
      { round: 0, fightAt: T, endsAt: r0End },
      { round: 1, fightAt: r1At, endsAt: r1End },
    ],
    auto: [],
    away: null,
    endReason: null,
  },
} as unknown as SeriesView;

const place = (watched: number, now: number) =>
  livePlace(view, watched, now, (r) => TICKS[r] ?? []);

describe('a live series at a moment', () => {
  it('holds the next fight before its Fight!', () => {
    expect(place(0, T - 2_000)).toStrictEqual({
      watched: 0,
      slot: { round: 0, attempt: 0, startAt: T, endAt: r0End },
    });
  });

  it('counts a fight that ended while the page was away as watched, and moves to the next', () => {
    expect(place(0, r0End + 1)).toMatchObject({ watched: 1, slot: { round: 1, attempt: 0 } });
  });

  it('picks up the attempt on now, after a draw', () => {
    const second = r1At + attemptWatchMs(3600) + 500;
    expect(place(1, second).slot).toMatchObject({ round: 1, attempt: 1 });
  });

  it('has nothing to show once every fight has ended', () => {
    expect(place(0, r1End)).toStrictEqual({ watched: 2, slot: undefined });
  });

  it('ends a round’s last attempt exactly when the server opens the next pick', () => {
    const slots = attemptSlots({ round: 1, fightAt: r1At }, TICKS[1] ?? []);
    expect(slots.at(-1)?.endAt).toBe(r1End);
  });

  it('counts down in whole seconds, never below zero', () => {
    expect(secondsUntil(T + 2_001, T)).toBe(3);
    expect(secondsUntil(T - 5, T)).toBe(0);
  });
});
