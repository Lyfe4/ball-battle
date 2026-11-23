import { describe, expect, it } from 'vitest';
import { RANKS } from './ranks-text.ts';

describe('the Ranks tab’s words (ADR 0081)', () => {
  it('says plainly that ranks are coming, names each part, and offers a way on', () => {
    expect(RANKS.intro).toContain('until then, every match is for fun');
    expect(RANKS.cards.map((card) => card.title)).toStrictEqual([
      'Trophy road',
      'Friends',
      'Everyone',
    ]);
    for (const card of RANKS.cards) expect(card.line.length).toBeGreaterThan(0);
    expect(RANKS.button).toBe('Play a friend now');
  });
});
