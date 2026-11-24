import { describe, expect, it } from 'vitest';
import { GLICKO } from './glicko2.ts';
import { gateOf, leagueOf, seasonReset, targetOf, trophiesAfter, TROPHIES } from './trophies.ts';

const count = (trophies: number, floor = gateOf(leagueOf(trophies))) => ({
  trophies,
  floor,
  peak: trophies,
});

describe('trophies', () => {
  it('aim at 2·(S − 800): nothing for a new player, about 1,120 for a settled 1500', () => {
    expect(targetOf(GLICKO.start)).toBe(0);
    expect(targetOf({ rating: 1500, rd: 70, volatility: 0.06 })).toBe(1120);
    expect(targetOf({ rating: 1700, rd: 70, volatility: 0.06 })).toBe(1520);
    expect(targetOf({ rating: 900, rd: 300, volatility: 0.06 })).toBe(0);
  });

  it('move ±30 at the target', () => {
    expect(trophiesAfter(count(1000), 1000, true).trophies).toBe(1030);
    expect(trophiesAfter(count(1000), 1000, false).trophies).toBe(970);
  });

  it('climb up to 60 a win below the target and lose nothing far below it', () => {
    expect(trophiesAfter(count(1000), 2000, true).trophies).toBe(1060);
    expect(trophiesAfter(count(1000), 2000, false).trophies).toBe(1000);
    // An eighth of the gap: 80 below is +40 and −20.
    expect(trophiesAfter(count(1000), 1080, true).trophies).toBe(1040);
    expect(trophiesAfter(count(1000), 1080, false).trophies).toBe(980);
  });

  it('gain nothing 240 above the target and lose up to 50, so trophies settle where skill is', () => {
    expect(trophiesAfter(count(1240), 1000, true).trophies).toBe(1240);
    expect(trophiesAfter(count(1600, 400), 1000, false).trophies).toBe(1550);
  });

  it('never take a loss below the floor of a league reached this season', () => {
    // 390 aiming at 400: +31 (30 + 10/8, rounded) into Silver.
    const silver = trophiesAfter(count(390, 0), 400, true);
    expect([silver.trophies, silver.floor, silver.peak]).toStrictEqual([421, 400, 421]);
    expect(trophiesAfter(silver, 0, false)).toStrictEqual({ trophies: 400, floor: 400, peak: 421 });
  });

  it('never take a Bronze loss below 100, and nothing under it', () => {
    expect(trophiesAfter(count(120, 0), 0, false).trophies).toBe(100);
    expect(trophiesAfter(count(60, 0), 0, false).trophies).toBe(60);
    expect(trophiesAfter(count(0, 0), 0, false).trophies).toBe(0);
  });

  it('come in six leagues every 400, the last open-ended', () => {
    expect([0, 399, 400, 799, 800, 1599, 2000, 9000].map(leagueOf)).toStrictEqual([
      0, 0, 1, 1, 2, 3, 5, 5,
    ]);
    expect(gateOf(TROPHIES.leagues - 1)).toBe(2000);
  });
});

describe('a new season', () => {
  it('pulls the rating a quarter of the way to 1500, RD at least 150, volatility kept', () => {
    const high = seasonReset({ rating: { rating: 1900, rd: 60, volatility: 0.07 }, trophies: 0 });
    expect(high.rating).toStrictEqual({ rating: 1800, rd: 150, volatility: 0.07 });
    const low = seasonReset({ rating: { rating: 1100, rd: 200, volatility: 0.06 }, trophies: 0 });
    expect(low.rating).toStrictEqual({ rating: 1200, rd: 200, volatility: 0.06 });
  });

  it('keeps trophies up to Gold and half the rest, the floor of the league it starts in', () => {
    const rating = { rating: 1500, rd: 70, volatility: 0.06 };
    expect(seasonReset({ rating, trophies: 640 })).toMatchObject({
      trophies: 640,
      floor: 400,
      peak: 640,
    });
    expect(seasonReset({ rating, trophies: 2001 })).toMatchObject({
      trophies: 1400,
      floor: 1200,
      peak: 1400,
    });
  });
});
