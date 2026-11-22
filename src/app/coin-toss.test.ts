import { describe, expect, it } from 'vitest';
import { TOSS_FLIP_MS, TOSS_HOLD_MS, TOSS_LEAD_MS, TOSS_READY_MS } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import { BOT_SEATS, playerSeats } from '../ui/series/seats.ts';
import {
  coinFace,
  liveToss,
  liveTossOf,
  offlineToss,
  nextStageChange,
  tossStage,
  tossWords,
} from './coin-toss.ts';

const T = 1_800_000_000_000;

describe('the toss timeline', () => {
  it('offline: flips at once for about two seconds, then holds the result', () => {
    const toss = offlineToss(T);
    expect(TOSS_FLIP_MS).toBeGreaterThanOrEqual(1_500);
    expect(TOSS_FLIP_MS).toBeLessThanOrEqual(2_500);
    expect(TOSS_HOLD_MS).toBeGreaterThanOrEqual(1_200);
    expect(tossStage(toss, T)).toBe('flipping');
    expect(tossStage(toss, T + TOSS_FLIP_MS - 1)).toBe('flipping');
    expect(tossStage(toss, T + TOSS_FLIP_MS)).toBe('landed');
    expect(tossStage(toss, T + TOSS_FLIP_MS + TOSS_HOLD_MS - 1)).toBe('landed');
    expect(tossStage(toss, T + TOSS_FLIP_MS + TOSS_HOLD_MS)).toBe('done');
  });

  it('live: Get ready, then the flip and the result, ending as the first pick opens', () => {
    const startedAt = T;
    const opensAt = startedAt + TOSS_LEAD_MS;
    expect(TOSS_LEAD_MS).toBe(TOSS_READY_MS + TOSS_FLIP_MS + TOSS_HOLD_MS);
    const toss = liveToss(opensAt);
    expect(tossStage(toss, startedAt)).toBe('ready');
    expect(tossStage(toss, startedAt + TOSS_READY_MS)).toBe('flipping');
    expect(tossStage(toss, startedAt + TOSS_READY_MS + TOSS_FLIP_MS)).toBe('landed');
    expect(tossStage(toss, opensAt)).toBe('done');
  });

  it('says when the stage next changes, and nothing once done', () => {
    const toss = liveToss(T + TOSS_LEAD_MS);
    expect(nextStageChange(toss, T)).toBe(TOSS_READY_MS);
    expect(nextStageChange(toss, T + TOSS_READY_MS + 500)).toBe(TOSS_FLIP_MS - 500);
    expect(nextStageChange(toss, T + TOSS_LEAD_MS - 1)).toBe(1);
    expect(nextStageChange(toss, T + TOSS_LEAD_MS)).toBeUndefined();
  });
});

describe('a live series’ toss', () => {
  const view = (format: 'reveal' | 'showdown', startedAt: number | null, opensAt: number | null) =>
    ({
      format,
      rounds: [],
      live: { startedAt, opensAt, startBy: 0, fights: [], auto: [], away: null, endReason: null },
    }) as unknown as SeriesView;

  it('is timed from the server’s start, ending as the first pick opens', () => {
    expect(liveTossOf(view('reveal', T, T + TOSS_LEAD_MS))).toStrictEqual(
      liveToss(T + TOSS_LEAD_MS),
    );
    // Database times come back as floating seconds.
    expect(liveTossOf(view('reveal', T + 0.0002, T + TOSS_LEAD_MS - 0.0001))).toBeDefined();
  });

  it('is none before both are here, in a Showdown, or once the pick phase moved on', () => {
    expect(liveTossOf(view('reveal', null, null))).toBeUndefined();
    expect(liveTossOf(view('showdown', T, T))).toBeUndefined();
    expect(liveTossOf(view('reveal', T, T + TOSS_LEAD_MS + 9_000))).toBeUndefined();
    expect(liveTossOf(view('reveal', T, T))).toBeUndefined();
  });
});

describe('the toss in words', () => {
  it('waits, tosses, then names who shows first in full', () => {
    const seats = playerSeats('b', 'Player 4821');
    expect(tossWords('ready', 'a', seats)).toBe('Get ready');
    expect(tossWords('flipping', 'a', seats)).toBe('Coin toss…');
    expect(tossWords('landed', 'a', seats)).toBe('Player 4821 shows first');
    expect(tossWords('landed', 'b', seats)).toBe('You show first');
    expect(tossWords('landed', 'b', BOT_SEATS)).toBe('The bot shows first');
  });

  it('keeps a username as its player chose it (ADR 0079)', () => {
    expect(tossWords('landed', 'a', playerSeats('b', 'sam_99'))).toBe('sam_99 shows first');
  });

  it('puts a short label on each face, so no name escapes the coin', () => {
    expect(coinFace(BOT_SEATS, 'a')).toBe('You');
    expect(coinFace(BOT_SEATS, 'b')).toBe('Bot');
    expect(coinFace(playerSeats('a', 'Player 4821'), 'b')).toBe('P4821');
    expect(coinFace(playerSeats('a', null), 'b')).toBe('Them');
    expect(coinFace(playerSeats('a', 'Someone with a long name'), 'b')).toBe('Them');
    expect(coinFace(playerSeats('a', 'Ana'), 'b')).toBe('Ana');
  });
});
