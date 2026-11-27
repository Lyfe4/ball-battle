import { describe, expect, it } from 'vitest';
import type { RecentSeries } from '../api/record.ts';
import { recordFixture, seriesFixture } from '../api/record-support.ts';
import {
  endLine,
  matchesLine,
  matchRow,
  recordLabel,
  shortDate,
  statFacts,
  statRows,
} from './record-text.ts';

const NOW = new Date(2026, 10, 27, 9);
const series = (over: Partial<RecentSeries> = {}): RecentSeries =>
  seriesFixture({ finishedAt: new Date(2026, 10, 24, 12).toISOString(), ...over });
const names = (id: string) => ({ vampire: 'Vampire' })[id];

describe('the record’s words (ADR 0088, 0089)', () => {
  it('says wins, played and the favourite ball by name', () => {
    const record = recordFixture({ wins: 1, played: 4, favourite: 'vampire' });
    expect(statFacts(record, names)).toStrictEqual([
      { value: '1', label: 'Win' },
      { value: '4', label: 'Played' },
      { value: 'Vampire', label: 'Favourite', ball: 'vampire' },
    ]);
    // A ball this build doesn't know, or none yet: no favourite fact.
    expect(statFacts({ ...record, favourite: 'gone' }, names)).toHaveLength(2);
    expect(statFacts({ ...record, wins: 3, favourite: null }, names)[0]?.label).toBe('Wins');
    expect(recordLabel(record)).toBe('Your record: 1 win of 4 played. More stats');
  });

  it('lists Your stats: the rate, each breakdown, the streak and the most played ball', () => {
    const record = recordFixture({
      wins: 3,
      played: 5,
      stats: {
        live: { wins: 2, played: 3 },
        turns: { wins: 1, played: 2 },
        bestOf3: { wins: 3, played: 5 },
        bestOf5: { wins: 0, played: 0 },
        bestStreak: 1,
        favouriteIn: 4,
      },
    });
    expect(statRows(record, names, true)).toStrictEqual([
      { label: 'Win rate', value: '60%' },
      { label: 'Live', value: '2 won · 1 lost' },
      { label: 'By turns', value: '1 won · 1 lost' },
      { label: 'Best of 3', value: '3 won · 2 lost' },
      { label: 'Best of 5', value: 'None yet' },
      { label: 'Best streak', value: '1 win' },
      { label: 'Most played', value: 'Vampire · 4', ball: 'vampire' },
    ]);
    // A build without play by turns says neither Live nor By turns (production today).
    expect(statRows(record, names, false).map((row) => row.label)).toStrictEqual([
      'Win rate',
      'Best of 3',
      'Best of 5',
      'Best streak',
      'Most played',
    ]);
  });

  it('says a row in short and in words: the score, or whose forfeit it was', () => {
    expect(matchRow(series(), NOW, 'en-AU', true)).toStrictEqual({
      name: 'Jo',
      result: 'Won',
      won: true,
      detail: '2–1',
      date: '24 Nov',
      how: 'Live',
      label: 'Won against Jo, 2 to 1, 24 Nov, live',
    });
    const endings = [
      ['youLeft', 'You left'],
      ['theyLeft', 'They left'],
      ['yourTime', 'Your time ran out'],
      ['theirTime', 'Their time ran out'],
    ] as const;
    for (const [ending, words] of endings) {
      const row = matchRow(series({ ending, forfeit: true }), NOW, 'en-AU', true);
      expect([row.detail, row.label.split(', ')[1]]).toStrictEqual([words, words]);
    }
    const lost = matchRow(
      series({ opponent: null, won: false, live: false, score: { you: 0, them: 1 } }),
      NOW,
      'en-AU',
      true,
    );
    expect([lost.name, lost.result, lost.detail, lost.how]).toStrictEqual([
      'Deleted player',
      'Lost',
      '0–1',
      'By turns',
    ]);
    // Without play by turns: no Live or By turns, in short or in words.
    const plain = matchRow(series({ live: false }), NOW, 'en-AU', false);
    expect([plain.how, plain.label]).toStrictEqual(['', 'Won against Jo, 2 to 1, 24 Nov']);
  });

  it('says today and yesterday by name, and the year only when it isn’t this one', () => {
    expect(shortDate(new Date(2026, 10, 27, 0, 5).toISOString(), NOW, 'en-AU')).toBe('Today');
    expect(shortDate(new Date(2026, 10, 26, 23, 55).toISOString(), NOW, 'en-AU')).toBe('Yesterday');
    expect(shortDate(new Date(2025, 11, 3, 10).toISOString(), NOW, 'en-AU')).toBe('3 Dec 2025');
  });

  it('counts All matches and says when the list has ended', () => {
    expect(matchesLine(54)).toBe('54 matches · online with friends');
    expect(matchesLine(1)).toBe('1 match · online with friends');
    expect([endLine(1), endLine(54)]).toStrictEqual(['That’s your only match.', 'That’s all 54.']);
  });
});
