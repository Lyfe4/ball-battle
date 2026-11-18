// The live match a device last saw end, remembered for its rematch (rematch-watch.ts): kept across a
// reload until it can no longer be asked or answered, forgotten when done, and never trusted when
// it isn't one.
import { describe, expect, it } from 'vitest';
import {
  forgetRematchWatch,
  rememberRematchWatch,
  rematchWatchOf,
  WATCH_MS,
  type RematchWatch,
} from './rematch-watch.ts';

const T = 1_700_000_000_000;
const memory = new Map<string, string>();
const storage = () => ({
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  key: () => null,
  length: 0,
});
const watch: RematchWatch = {
  id: '11111111-2222-4333-8444-555555555555',
  you: 'b',
  they: 'Player 4821',
  format: 'reveal',
  bestOf: 3,
  until: T + WATCH_MS,
};

describe('the match a rematch may follow', () => {
  it('is kept until the rematch can no longer be asked or answered', () => {
    expect(WATCH_MS).toBeGreaterThanOrEqual(150_000);
    rememberRematchWatch(storage, watch);
    expect(rematchWatchOf(storage, T)).toStrictEqual(watch);
    expect(rematchWatchOf(storage, T + WATCH_MS)).toBeUndefined();
  });

  it('is forgotten for its own series only', () => {
    rememberRematchWatch(storage, watch);
    forgetRematchWatch(storage, 'another');
    expect(rematchWatchOf(storage, T)?.id).toBe(watch.id);
    forgetRematchWatch(storage, watch.id);
    expect(rematchWatchOf(storage, T)).toBeUndefined();
  });

  it('never trusts what isn’t one, nor a storage that throws', () => {
    for (const raw of ['{', '"x"', '{"id":1}', JSON.stringify({ ...watch, you: 'c' })]) {
      memory.set('ballbattle.online.rematch', raw);
      expect(rematchWatchOf(storage, T)).toBeUndefined();
    }
    const broken = () => {
      throw new Error('blocked');
    };
    expect(rematchWatchOf(broken, T)).toBeUndefined();
    expect(() => {
      rememberRematchWatch(broken, watch);
    }).not.toThrow();
  });
});
