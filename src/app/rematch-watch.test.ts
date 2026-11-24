// The live match a device last saw end, remembered for its rematch (rematch-watch.ts): kept across a
// reload until it can no longer be asked or answered, forgotten when done, and never trusted when
// it isn't one.
import { describe, expect, it } from 'vitest';
import {
  forgetRematchWatch,
  rememberRematchWatch,
  rematchWatchFor,
  rematchWatchOf,
  WATCH_MS,
  watchAskMs,
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
  opensAt: 0,
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

  it('opens at the end of the last fight of a match played out, at once after a forfeit', () => {
    const series = { id: watch.id, you: 'b', format: 'reveal', bestOf: 3 } as const;
    const fights = [
      { round: 1, fightAt: T - 90_000, endsAt: T - 60_000 },
      { round: 2, fightAt: T - 20_000, endsAt: T + 15_000 },
    ];
    const played = rematchWatchFor({ ...series, live: { fights } }, 'Player 4821', T);
    expect(played).toStrictEqual({ ...watch, opensAt: T + 15_000 });
    expect(rematchWatchFor({ ...series, live: { fights: [] } }, 'Player 4821', T).opensAt).toBe(0);
  });

  it('reads a watch kept before it knew when the rematch opens as open at once', () => {
    memory.set('ballbattle.online.rematch', JSON.stringify({ ...watch, opensAt: undefined }));
    expect(rematchWatchOf(storage, T)?.opensAt).toBe(0);
  });
});

describe('when the rematch watch asks next (ADR 0082)', () => {
  const paced = (_today: number, until: number | null) => (until === null ? 10_000 : until + 500);

  it('waits for the last fight to end, socket up or not: nothing can happen before', () => {
    expect(watchAskMs(2_000, 45_000, null, paced)).toBe(45_000);
    expect(watchAskMs(2_000, 45_000, 45_000, paced)).toBe(45_000);
    expect(watchAskMs(2_000, 500, null, paced)).toBe(2_000);
  });

  it('is paced by the poke once a rematch can move', () => {
    expect(watchAskMs(2_000, 0, null, paced)).toBe(10_000);
    expect(watchAskMs(2_000, -300, 4_000, paced)).toBe(4_500);
    expect(watchAskMs(2_000, 0, null, (today) => today)).toBe(2_000);
  });
});
