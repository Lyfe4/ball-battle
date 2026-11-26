// Test fixtures for a record (ADR 0088, 0089): a finished series and a whole record, each with
// what a test leaves out filled in.
import type { RecentSeries, RecordResponse, RecordStats } from './record.ts';

export const seriesFixture = (over: Partial<RecentSeries> = {}): RecentSeries => ({
  id: 's-1',
  opponent: 'Jo',
  live: true,
  bestOf: 3,
  format: 'reveal',
  won: true,
  forfeit: false,
  ending: null,
  score: { you: 2, them: 1 },
  finishedAt: new Date().toISOString(),
  ruleset: 23,
  ...over,
});

export const STATS_FIXTURE: RecordStats = {
  live: { wins: 2, played: 3 },
  turns: { wins: 1, played: 2 },
  bestOf3: { wins: 3, played: 4 },
  bestOf5: { wins: 0, played: 1 },
  bestStreak: 2,
  favouriteIn: 4,
};

export const recordFixture = (over: Partial<RecordResponse> = {}): RecordResponse => ({
  wins: 3,
  played: 5,
  favourite: 'vampire',
  stats: STATS_FIXTURE,
  recent: [],
  next: null,
  ...over,
});
