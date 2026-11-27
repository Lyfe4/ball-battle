import { describe, expect, it } from 'vitest';
import {
  FRIEND_PICK_STORAGE_KEY,
  forgetFriendPick,
  loadFriendPick,
  parseFriendPick,
  saveFriendPick,
  type FriendPick,
} from './friend-pick.ts';

function memory() {
  const map = new Map<string, string>();
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  };
  return { map, storage: () => store };
}

const ROBIN: FriendPick = { owner: 'sam_k', id: 'f-1', name: 'Robin', turns: false };

describe('the friend Play is against (ADR 0089)', () => {
  it('is remembered for the account that picked them, and no other', () => {
    const { storage, map } = memory();
    saveFriendPick(storage, ROBIN);
    expect(loadFriendPick(storage, 'sam_k')).toStrictEqual(ROBIN);
    expect(loadFriendPick(storage, 'jo_b')).toBeUndefined();
    // Before /me answers, the one this device holds (Log out clears every ballbattle.* key).
    expect(loadFriendPick(storage, undefined)).toStrictEqual(ROBIN);
    forgetFriendPick(storage);
    expect(map.has(FRIEND_PICK_STORAGE_KEY)).toBe(false);
  });

  it('reads nothing from a broken or foreign value, or storage that throws', () => {
    for (const raw of ['', 'nope', '{}', '[]', 'null', '{"owner":"a","id":"b","name":"c"}']) {
      expect(parseFriendPick(raw), raw).toBeUndefined();
    }
    const throwing = () => ({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadFriendPick(throwing, 'sam_k')).toBeUndefined();
    saveFriendPick(throwing, ROBIN);
    forgetFriendPick(throwing);
  });
});
