// Home tells a player who left a live match once (ADR 0086).
import { describe, expect, it } from 'vitest';
import { leftLine, noteLeft, takeLeft } from './left-match.ts';

describe('leaving a live match', () => {
  it('is said once on Home, then never again', () => {
    expect(takeLeft()).toBeUndefined();
    noteLeft('Jo');
    expect(takeLeft()).toBe('Jo');
    expect(takeLeft()).toBeUndefined();
    expect(leftLine('Jo')).toBe('You left: Jo wins');
  });
});
