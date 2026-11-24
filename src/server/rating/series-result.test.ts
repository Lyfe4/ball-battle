// The scenarios ADR 0083 names: a strong newcomer climbs fast without a placement mode, and an
// account fed wins by a friend (win-trading) stops gaining trophies near its target.
import { describe, expect, it } from 'vitest';
import { GLICKO } from './glicko2.ts';
import { afterSeries, type Ranked } from './series-result.ts';
import { leagueOf, targetOf, TROPHIES } from './trophies.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newcomer = (): Ranked => ({
  rating: GLICKO.start,
  trophies: 0,
  floor: 0,
  peak: 0,
  lastSeriesAt: null,
});
/** A settled average player: 1500, RD 70, at their target of 1,120 trophies (Gold). */
const settled = (lastSeriesAt: number | null = null): Ranked => ({
  rating: { rating: 1500, rd: 70, volatility: 0.06 },
  trophies: 1120,
  floor: 800,
  peak: 1120,
  lastSeriesAt,
});

/** `player` after playing `results` (true a win) against fresh settled players, an hour apart. */
function play(player: Ranked, results: readonly boolean[]): { after: Ranked; gains: number[] } {
  let at = 0;
  let current = player;
  const gains: number[] = [];
  for (const won of results) {
    at += HOUR;
    const before = current.trophies;
    current = won
      ? afterSeries({ winner: current, loser: settled(at) }, at).winner
      : afterSeries({ winner: settled(at), loser: current }, at).loser;
    gains.push(current.trophies - before);
  }
  return { after: current, gains };
}

describe('a ranked series', () => {
  it('moves both players: the winner up, the loser down, both marked as just played', () => {
    const at = 10 * DAY;
    const { winner, loser } = afterSeries({ winner: settled(), loser: settled() }, at);
    expect(winner.rating.rating).toBeGreaterThan(1500);
    expect(loser.rating.rating).toBeLessThan(1500);
    // ±30 at the target, read from the rating after the series: the winner's moved up (+34),
    // the loser's down (−33).
    expect([winner.trophies, loser.trophies]).toStrictEqual([1154, 1087]);
    expect([winner.lastSeriesAt, loser.lastSeriesAt]).toStrictEqual([at, at]);
  });

  it('first grows the RD of a player away for whole days, so their result moves them more', () => {
    const at = 60 * DAY;
    const back = afterSeries({ winner: settled(0), loser: settled(at) }, at).winner;
    const regular = afterSeries({ winner: settled(at), loser: settled(at) }, at).winner;
    expect(back.rating.rating - 1500).toBeGreaterThan(regular.rating.rating - 1500);
  });

  it('climbs a strong newcomer who wins 7 of their first 10 at up to 60 a win, losing nothing', () => {
    const { after, gains } = play(newcomer(), [
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      false,
      true,
    ]);
    // The proposal's shape: RD near 120, the rating well above 1500, the target around the top of
    // Gold while the trophies are still in Silver, each win near +60 until they catch up.
    expect(after.rating.rd).toBeGreaterThan(100);
    expect(after.rating.rd).toBeLessThan(140);
    expect(after.rating.rating).toBeGreaterThan(1600);
    expect(leagueOf(after.trophies)).toBe(1);
    expect(targetOf(after.rating)).toBeGreaterThan(1100);
    expect(gains).toStrictEqual([60, 60, 0, 60, 60, 60, 0, 60, 0, 60]);
  });

  it('takes a newcomer who wins every series out of Bronze within 10 wins', () => {
    const { after, gains } = play(
      newcomer(),
      Array.from({ length: 10 }, () => true),
    );
    const firstSilver = gains.reduce<number | undefined>((found, _, i) => {
      if (found !== undefined) return found;
      const sum = gains.slice(0, i + 1).reduce((a, b) => a + b, 0);
      return leagueOf(sum) >= 1 ? i + 1 : undefined;
    }, undefined);
    expect(firstSilver).toBeLessThanOrEqual(10);
    expect(after.floor).toBe(400);
  });

  it('stops an account fed wins by a friend within 240 of its target', () => {
    // Win-trading: one account always loses to the other, twice a day (the pair cap), 200 times.
    let fed = settled();
    let feeder = settled();
    let at = 0;
    const gains: number[] = [];
    for (let series = 0; series < 200; series += 1) {
      at += 12 * HOUR;
      const before = fed.trophies;
      ({ winner: fed, loser: feeder } = afterSeries({ winner: fed, loser: feeder }, at));
      gains.push(fed.trophies - before);
    }
    const target = targetOf(fed.rating);
    // Gains lean to nothing once the trophies pass the target: no road to Legend by feeding.
    expect(fed.trophies - target).toBeLessThanOrEqual(240);
    expect(gains.slice(-20).every((gain) => gain <= 2)).toBe(true);
    expect(fed.trophies).toBeLessThan(TROPHIES.gate * 5 + 100);
    // The feeder stops at the floor of the league it started in.
    expect(feeder.trophies).toBe(800);
  });
});
