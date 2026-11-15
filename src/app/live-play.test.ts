import { describe, expect, it } from 'vitest';
import { attemptWatchMs } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import type { RoundRecord } from '../sim/series.ts';
import { COUNTDOWN_MS, LEAD_MS } from '../api/live.ts';
import {
  attemptSlots,
  countdownLine,
  livePlace,
  nextLineChange,
  secondsUntil,
} from './live-play.ts';

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

describe('the countdown before a live fight (ADR 0054)', () => {
  const start = T + LEAD_MS;
  /** The page learned of the round at the lock: the whole lead is ahead of it. */
  const early = T;

  it('leaves room before the 3-2-1 for a phone that learns of the round late', () => {
    expect(LEAD_MS - COUNTDOWN_MS).toBeGreaterThanOrEqual(3_000);
  });

  it('says Get ready, then counts 3, 2, 1, each for a whole second', () => {
    expect(countdownLine(start, T, early)).toBe('Get ready');
    expect(countdownLine(start, start - 3_001, early)).toBe('Get ready');
    expect(countdownLine(start, start - 3_000, early)).toBe('3');
    expect(countdownLine(start, start - 2_001, early)).toBe('3');
    expect(countdownLine(start, start - 2_000, early)).toBe('2');
    expect(countdownLine(start, start - 1_000, early)).toBe('1');
    expect(countdownLine(start, start - 1, early)).toBe('1');
  });

  it('shows the 3-2-1 to a phone that learns in time for all of it', () => {
    expect(countdownLine(start, start - 2_500, start - 2_900)).toBe('3');
  });

  it('never joins the 3-2-1 part-way: a phone that learns late keeps Get ready', () => {
    for (const learned of [start - 2_700, start - 1_500, start - 200]) {
      expect(countdownLine(start, learned, learned)).toBe('Get ready');
      expect(countdownLine(start, start - 500, learned)).toBe('Get ready');
    }
  });

  it('changes its line exactly on each second, not on the next display tick', () => {
    expect(nextLineChange(start, T)).toBe(LEAD_MS - COUNTDOWN_MS);
    expect(nextLineChange(start, start - 3_000)).toBe(1_000);
    expect(nextLineChange(start, start - 2_400)).toBe(400);
    expect(nextLineChange(start, start - 1)).toBe(1);
    expect(nextLineChange(start, start)).toBeUndefined();
  });
});
