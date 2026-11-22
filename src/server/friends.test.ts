// A new friend code (ADR 0079, PR (c)): 8 Crockford characters, each of the 32 about as often.
import { describe, expect, it } from 'vitest';
import { normalFriendCode } from '../api/friends.ts';
import { newFriendCode } from './friends.ts';

describe('a new friend code', () => {
  it('is 8 characters a person can type back exactly', () => {
    for (let index = 0; index < 200; index += 1) {
      const code = newFriendCode();
      expect(normalFriendCode(code)).toBe(code);
    }
  });

  it('uses all 32 characters', () => {
    const seen = new Set(Array.from({ length: 400 }, newFriendCode).join(''));
    expect(seen.size).toBe(32);
  });
});
