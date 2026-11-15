// The live series' clock (ADR 0053), pure.
import { describe, expect, it } from 'vitest';
import { GRACE_MS, LEAD_MS, PICK_SECONDS, roundWatchMs, START_WINDOW_MS } from '../api/live.ts';
import {
  fightTimes,
  forfeitAtOf,
  nextLiveEvent,
  pickPhase,
  randomBall,
  type LiveFacts,
} from './live.ts';

const T = 1_700_000_000_000;
const facts = (over: Partial<LiveFacts> = {}): LiveFacts => ({
  now: T,
  createdAt: T,
  startedAt: null,
  seen: { a: null, b: null },
  deadline: null,
  ...over,
});

describe('before the start', () => {
  it('waits for the second player within the start window', () => {
    expect(nextLiveEvent(facts({ seen: { a: null, b: T } }))).toBeUndefined();
    expect(nextLiveEvent(facts({ now: T + START_WINDOW_MS - 1, seen: { a: null, b: T } }))).toBe(
      undefined,
    );
  });

  it('starts once both have asked', () => {
    expect(nextLiveEvent(facts({ seen: { a: T, b: T } }))).toStrictEqual({ kind: 'start' });
  });

  it('forfeits to whoever arrived when the window closes, or to nobody', () => {
    const late = T + START_WINDOW_MS;
    expect(nextLiveEvent(facts({ now: late, seen: { a: null, b: T } }))).toStrictEqual({
      kind: 'forfeit',
      winner: 'b',
      reason: 'start_missed',
    });
    expect(nextLiveEvent(facts({ now: late }))).toStrictEqual({
      kind: 'forfeit',
      winner: null,
      reason: 'start_missed',
    });
  });
});

describe('once started', () => {
  const started = (over: Partial<LiveFacts>) =>
    facts({ startedAt: T, seen: { a: T, b: T }, deadline: T + 30_000, ...over });

  it('makes a pick that ran out, as of its deadline', () => {
    const now = T + 31_000;
    expect(nextLiveEvent(started({ now, seen: { a: now, b: now } }))).toStrictEqual({
      kind: 'timeout',
      at: T + 30_000,
    });
  });

  it('forfeits a player silent past the notice and the grace period, not a moment before', () => {
    const at = forfeitAtOf(T);
    expect(at).toBe(T + 6_000 + GRACE_MS);
    const seen = { a: T, b: at };
    expect(nextLiveEvent(started({ now: at - 1, seen, deadline: null }))).toBeUndefined();
    expect(nextLiveEvent(started({ now: at, seen, deadline: null }))).toStrictEqual({
      kind: 'forfeit',
      winner: 'b',
      reason: 'disconnected',
    });
  });

  it('takes events in time order: a pick that ran out first is still made', () => {
    const now = forfeitAtOf(T) + 1;
    expect(nextLiveEvent(started({ now, seen: { a: T, b: now } }))).toStrictEqual({
      kind: 'timeout',
      at: T + 30_000,
    });
    // The player who went quiet first is the one who loses, whoever reads later.
    const both = { a: T, b: T + 1_000 };
    expect(nextLiveEvent(started({ now: now + 5_000, seen: both, deadline: null }))).toMatchObject({
      winner: 'b',
    });
  });
});

describe('fight times', () => {
  it('fight LEAD_MS after the lock and open the next pick when the fight has played', () => {
    const fights = fightTimes([{ round: 0, ticks: [900] }], T, null);
    expect(fights).toStrictEqual([
      { round: 0, fightAt: T + LEAD_MS, endsAt: T + LEAD_MS + roundWatchMs([900]) },
    ]);
    expect(pickPhase(T, fights)).toStrictEqual({
      opensAt: fights[0]?.endsAt,
      deadline: (fights[0]?.endsAt ?? 0) + PICK_SECONDS * 1000,
    });
  });

  it('play a round that needs no pick after the one before it, and draws one after another', () => {
    const fights = fightTimes(
      [
        { round: 1, ticks: [600] },
        { round: 2, ticks: [3600, 700] },
      ],
      T,
      null,
    );
    expect(fights[1]?.fightAt).toBe((fights[0]?.endsAt ?? 0) + LEAD_MS);
    expect((fights[1]?.endsAt ?? 0) - (fights[1]?.fightAt ?? 0)).toBe(roundWatchMs([3600, 700]));
  });

  it('never start before the previous fight ends', () => {
    const [fight] = fightTimes([{ round: 2, ticks: [600] }], T, T + 5_000);
    expect(fight?.fightAt).toBe(T + 5_000 + LEAD_MS);
  });

  it('open the next pick at the lock when no fight was started', () => {
    expect(pickPhase(T, []).opensAt).toBe(T);
  });
});

describe('a random ball', () => {
  it('is one of those left, across the whole range', () => {
    expect(randomBall(['x', 'y', 'z'], 0)).toBe('x');
    expect(randomBall(['x', 'y', 'z'], 0.999_999)).toBe('z');
    expect(randomBall([], 0.5)).toBeUndefined();
  });
});
