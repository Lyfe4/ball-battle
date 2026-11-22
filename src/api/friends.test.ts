// A friend code as typed and as shown (ADR 0079, PR (c)), and the body of a request.
import { describe, expect, it } from 'vitest';
import { decodeAddFriend, isFriendshipId, normalFriendCode, shownFriendCode } from './friends.ts';

describe('a friend code', () => {
  it('reads what a person types: any case, a dash or spaces, I and L as 1, O as 0', () => {
    expect(normalFriendCode('7kq2-m9xd')).toBe('7KQ2M9XD');
    expect(normalFriendCode(' 7KQ2 M9XD ')).toBe('7KQ2M9XD');
    expect(normalFriendCode('OIL2-M9XD')).toBe('0112M9XD');
  });

  it('is nothing when it can’t be one: the wrong length, or U or punctuation', () => {
    for (const typed of ['7KQ2M9X', '7KQ2M9XDD', '7KQ2M9XU', 'Sam_R', '7KQ2_M9X']) {
      expect(normalFriendCode(typed), typed).toBeUndefined();
    }
  });

  it('is shown in two halves', () => {
    expect(shownFriendCode('7KQ2M9XD')).toBe('7KQ2-M9XD');
  });
});

describe('a request body', () => {
  it('takes what was typed, trimmed, and refuses empty, long or missing', () => {
    expect(decodeAddFriend({ to: '  Sam_R ' })).toStrictEqual({ to: 'Sam_R' });
    for (const body of [{ to: '   ' }, { to: 'x'.repeat(21) }, {}, null, 'Sam_R', { to: 7 }]) {
      expect(decodeAddFriend(body)).toBeUndefined();
    }
  });

  it('names a friendship by a UUID only', () => {
    expect(isFriendshipId('0b0c3f6e-1a2b-4c5d-8e9f-001122334455')).toBe(true);
    expect(isFriendshipId('../me')).toBe(false);
    expect(isFriendshipId(undefined)).toBe(false);
  });
});
