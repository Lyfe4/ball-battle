// viewOf's rules that the played-through database tests can't reach: a Blind series plays out the
// moment both lineups are locked, so its open state only exists here.
import { describe, expect, it } from 'vitest';
import { viewOf, type SeriesRecord } from './view.ts';

const record: SeriesRecord = {
  id: '00000000-0000-4000-8000-000000000000',
  kind: 'friend',
  ruleset: 15,
  format: 'blind',
  bestOf: 3,
  names: { a: 'Player 1000', b: null },
  lineups: { a: ['archer', 'thorns', 'vampire'], b: ['brawler', 'magnet', 'frost'] },
  picks: [],
  rounds: [],
  seeds: [
    { purpose: 'round', index: 0, salt: 'ab'.repeat(16), commitment: 'cd'.repeat(32), seed: null },
  ],
  turn: null,
  deadline: null,
  status: 'open',
  winner: null,
  version: 1,
  final: null,
};

describe('a Blind series’ view', () => {
  it('hides the opponent’s lineup until the series ends, from either side', () => {
    expect(viewOf(record, 'a').lineups).toStrictEqual({ a: record.lineups.a, b: null });
    expect(viewOf(record, 'b').lineups).toStrictEqual({ a: null, b: record.lineups.b });
    expect(viewOf({ ...record, status: 'finished' }, 'a').lineups).toStrictEqual(record.lineups);
  });

  it('never carries an unrevealed salt', () => {
    expect(JSON.stringify(viewOf(record, 'a'))).not.toContain('ab'.repeat(16));
    expect(viewOf(record, 'a').revealed).toStrictEqual([]);
  });

  it('says what kind of series it is, never a friend’s by default (ADR 0083)', () => {
    expect(viewOf(record, 'a').kind).toBe('friend');
    expect(viewOf({ ...record, kind: 'ranked' }, 'b').kind).toBe('ranked');
  });

  it('names a deleted player as null, for "Deleted player"', () => {
    expect(viewOf(record, 'a').names.b).toBeNull();
  });
});
