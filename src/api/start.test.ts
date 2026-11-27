import { describe, expect, it } from 'vitest';
import { decodeStartMove, MAX_SEQ } from './start.ts';

describe('a move on the lineups (ADR 0080)', () => {
  const lineup = ['archer', 'brawler', 'venom'];

  it('takes a draft counter the database can hold, and refuses anything else', () => {
    expect(decodeStartMove({ lineup, lock: false, seq: MAX_SEQ })?.seq).toBe(MAX_SEQ);
    // Past a Postgres integer it was a 500 and a Sentry report; now a plain refusal.
    expect(decodeStartMove({ lineup, lock: false, seq: MAX_SEQ + 1 })).toBeUndefined();
    expect(decodeStartMove({ lineup, lock: false, seq: -1 })).toBeUndefined();
    expect(decodeStartMove({ lineup, lock: false, seq: 1.5 })).toBeUndefined();
  });
});
