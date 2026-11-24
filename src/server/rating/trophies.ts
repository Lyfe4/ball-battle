// What a ranked player sees (ADR 0083): trophies, which move in whole steps after each series and
// lean towards the hidden rating's target, so a player's trophies settle where their skill is and
// farming weak players slows to the smallest gain. Leagues every 400 trophies, with floors once
// reached in a season. Pure; the season's reset of both numbers is here too.
import { type Glicko, GLICKO, skillOf } from './glicko2.ts';

export const TROPHIES = {
  /** A series won or lost at the target. */
  base: 30,
  /** How hard a gain leans: an eighth of the gap to the target. */
  lean: 8,
  /**
   * A win's gain falls to nothing 240 above the target. The proposal's least of 10 let a fed
   * account climb 10 a win for ever (3,381 trophies against a target of 1,772 after 200 fed wins);
   * an honest player at their level gets under 10 on about 0.2% of wins (ADR 0083, 2026-11-25).
   */
  win: { least: 0, most: 60 },
  loss: { least: 0, most: 50 },
  /** The target is 2·(S − 800): a new player (S = 800) aims at 0. */
  skillAtZero: 800,
  perSkill: 2,
  /** A league every 400 trophies; six of them, the last open-ended. */
  gate: 400,
  leagues: 6,
  /** In Bronze, a loss never takes a player below this, and below it takes nothing. */
  shield: 100,
  /** The reset keeps everything up to here and half of the rest. */
  resetKeeps: 800,
} as const;

/** The trophies a player's hidden rating aims them at: G = max(0, 2·(S − 800)). */
export const targetOf = (player: Glicko): number =>
  Math.max(0, TROPHIES.perSkill * (skillOf(player) - TROPHIES.skillAtZero));

/** The league of `trophies`, 0 (Bronze) to 5 (Legend). Names are the owner's, later. */
export const leagueOf = (trophies: number): number =>
  Math.min(TROPHIES.leagues - 1, Math.max(0, Math.floor(trophies / TROPHIES.gate)));

/** The trophies at which `league` starts. */
export const gateOf = (league: number): number => league * TROPHIES.gate;

const clamp = (value: number, least: number, most: number): number =>
  Math.min(most, Math.max(least, value));

/** A player's trophies this season: the count, the floor reached and the highest count. */
export interface TrophyCount {
  readonly trophies: number;
  /** The gate of the highest league reached this season: no loss takes the count below it. */
  readonly floor: number;
  readonly peak: number;
}

/**
 * `count` after a series won or lost, against `target` (the player's own, from the rating after
 * the series): a win adds clamp(30 + (G − T)/8, 0, 60), a loss takes clamp(30 − (G − T)/8, 0, 50),
 * whole trophies, never below the floor, nor in Bronze below 100 (nothing lost under it).
 */
export function trophiesAfter(count: TrophyCount, target: number, won: boolean): TrophyCount {
  const { trophies } = count;
  const gap = (target - trophies) / TROPHIES.lean;
  if (won) {
    const after =
      trophies + Math.round(clamp(TROPHIES.base + gap, TROPHIES.win.least, TROPHIES.win.most));
    return {
      trophies: after,
      floor: Math.max(count.floor, gateOf(leagueOf(after))),
      peak: Math.max(count.peak, after),
    };
  }
  const lost = Math.round(clamp(TROPHIES.base - gap, TROPHIES.loss.least, TROPHIES.loss.most));
  const lowest = Math.max(count.floor, Math.min(trophies, TROPHIES.shield));
  return { ...count, trophies: Math.max(lowest, trophies - lost) };
}

/** A player's ranked standing carried into a new season. */
export interface Standing {
  readonly rating: Glicko;
  readonly trophies: number;
}

/**
 * The soft reset at a season's boundary (ADR 0083, decision 4): the rating a quarter of the way to
 * 1500 with RD at least 150, the volatility kept; trophies up to Gold kept and half the rest. The new
 * season's floor is the gate of the league the player starts it in.
 */
export function seasonReset(standing: Standing): { readonly rating: Glicko } & TrophyCount {
  const { rating, trophies } = standing;
  const start = GLICKO.start.rating;
  const kept = TROPHIES.resetKeeps;
  const after = trophies <= kept ? trophies : kept + Math.floor((trophies - kept) / 2);
  return {
    rating: {
      rating: rating.rating - (rating.rating - start) / 4,
      rd: Math.max(rating.rd, 150),
      volatility: rating.volatility,
    },
    trophies: after,
    floor: gateOf(leagueOf(after)),
    peak: after,
  };
}
