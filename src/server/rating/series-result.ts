// A finished ranked series, applied to both players (ADR 0083): each one's RD first grows for the
// whole days since their last ranked series, then each is rated against the other as they stood
// before it (one rating period, the series' result), then their trophies move towards the target of
// their new rating. Pure; the finishing transaction (PR 4) stores what this returns.
import { afterInactivity, type Glicko, rate } from './glicko2.ts';
import { targetOf, type TrophyCount, trophiesAfter } from './trophies.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One player's ranked standing in the season. */
export interface Ranked extends TrophyCount {
  readonly rating: Glicko;
  /** When their last ranked series finished, ms since the epoch; null before their first. */
  readonly lastSeriesAt: number | null;
}

/** Whole days from `from` to `to` (ms); none before a first series. */
const daysBetween = (from: number | null, to: number): number =>
  from === null ? 0 : Math.max(0, Math.floor((to - from) / DAY_MS));

/** Both players after a series `winner` won, finished at `at` (the database's time, ms). */
export function afterSeries(
  players: { readonly winner: Ranked; readonly loser: Ranked },
  at: number,
): { readonly winner: Ranked; readonly loser: Ranked } {
  const before = {
    winner: afterInactivity(players.winner.rating, daysBetween(players.winner.lastSeriesAt, at)),
    loser: afterInactivity(players.loser.rating, daysBetween(players.loser.lastSeriesAt, at)),
  };
  const rated = {
    winner: rate(before.winner, [{ opponent: before.loser, score: 1 }]),
    loser: rate(before.loser, [{ opponent: before.winner, score: 0 }]),
  };
  return {
    winner: {
      ...trophiesAfter(players.winner, targetOf(rated.winner), true),
      rating: rated.winner,
      lastSeriesAt: at,
    },
    loser: {
      ...trophiesAfter(players.loser, targetOf(rated.loser), false),
      rating: rated.loser,
      lastSeriesAt: at,
    },
  };
}
