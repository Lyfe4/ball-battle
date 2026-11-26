import { describe, expect, it } from 'vitest';
import type { RecentSeries } from '../api/record.ts';
import { recordFixture, seriesFixture } from '../api/record-support.ts';
import { recentRow, shortDate, statFacts } from './record-text.ts';

const NOW = new Date('2026-11-27T09:00:00Z');
const series = (over: Partial<RecentSeries> = {}): RecentSeries =>
  seriesFixture({ finishedAt: '2026-11-26T12:00:00Z', ...over });

describe('the record’s words (ADR 0088)', () => {
  it('says wins, played and the favourite ball by name', () => {
    const names = (id: string) => ({ vampire: 'Vampire' })[id];
    const record = recordFixture({ wins: 1, played: 4, favourite: 'vampire' });
    expect(statFacts(record, names)).toStrictEqual([
      { value: '1', label: 'Win' },
      { value: '4', label: 'Played' },
      { value: 'Vampire', label: 'Favourite', ball: 'vampire' },
    ]);
    // A ball this build doesn't know, or none yet: no favourite fact.
    expect(statFacts({ ...record, favourite: 'gone' }, names)).toHaveLength(2);
    expect(statFacts({ ...record, wins: 3, favourite: null }, names)[0]?.label).toBe('Wins');
  });

  it('says a row in short and in words, a forfeit and a deleted player too', () => {
    expect(recentRow(series(), NOW, 'en-AU')).toStrictEqual({
      name: 'Jo',
      result: 'Won 2–1',
      won: true,
      when: '26 Nov · Live',
      label: 'Won against Jo, 2 to 1, live, 26 Nov',
    });
    const lost = recentRow(
      series({
        opponent: null,
        won: false,
        forfeit: true,
        live: false,
        score: { you: 0, them: 1 },
      }),
      NOW,
      'en-AU',
    );
    expect([lost.name, lost.result, lost.when]).toStrictEqual([
      'Deleted player',
      'Lost 0–1 · forfeit',
      '26 Nov · By turns',
    ]);
    expect(lost.label).toBe('Lost against Deleted player, 0 to 1, by forfeit, by turns, 26 Nov');
  });

  it('adds the year only when it isn’t this one', () => {
    expect(shortDate('2025-12-03T10:00:00Z', NOW, 'en-AU')).toBe('3 Dec 2025');
  });
});
