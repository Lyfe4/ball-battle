import { describe, expect, it } from 'vitest';
import { RANKS } from './ranks-text.ts';

describe('the Ranks tab’s words (ADR 0081, 0090 D5)', () => {
  it('says plainly that ranked is coming, in one card, and offers a way on', () => {
    expect(RANKS.intro).toContain('ranked play');
    expect(RANKS.card.title).toBe('Ranked is coming');
    expect(RANKS.card.line).toBe('Until then, play a friend.');
    expect(RANKS.button).toBe('Play a friend now');
  });
});
