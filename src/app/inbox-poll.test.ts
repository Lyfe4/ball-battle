// The inbox's wait (ADR 0079, PR (d)), with fake timers: a read at the start, one every 30 s while
// visible and worth it, every 2 s while something is expected, none while hidden, one at once on
// return, none after sign-out. With the poke socket up (ADR 0082): a read on each poke and on
// every move to up, a safety read every 120 s, and today's timers again the moment it goes down.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInboxPoll, INBOX_EXPECTING_MS, INBOX_MS, INBOX_SAFETY_MS } from './inbox-poll.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function poll(answers: () => boolean = () => true) {
  let hidden = false;
  let expecting = false;
  let reads = 0;
  const inbox = createInboxPoll({
    read: () => {
      reads += 1;
      return Promise.resolve(answers());
    },
    hidden: () => hidden,
    expecting: () => expecting,
    setTimer: (run, ms) => Number(setTimeout(run, ms)),
    clearTimer: (id) => {
      clearTimeout(id);
    },
  });
  return {
    inbox,
    reads: () => reads,
    hide: (value: boolean) => {
      hidden = value;
      inbox.visibility();
    },
    expect: (value: boolean) => {
      expecting = value;
      inbox.quicken();
    },
  };
}

describe('the inbox poll', () => {
  it('reads at the start, then every 30 s while visible', async () => {
    const { inbox, reads } = poll();
    inbox.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(reads()).toBe(1);
    await vi.advanceTimersByTimeAsync(INBOX_MS - 1);
    expect(reads()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(reads()).toBe(2);
    await vi.advanceTimersByTimeAsync(INBOX_MS * 3);
    expect(reads()).toBe(5);
  });

  it('never reads while hidden, and reads once at once when shown again', async () => {
    const { inbox, reads, hide } = poll();
    inbox.start();
    await vi.advanceTimersByTimeAsync(0);
    hide(true);
    await vi.advanceTimersByTimeAsync(INBOX_MS * 10);
    expect(reads()).toBe(1);
    hide(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(reads()).toBe(2);
    await vi.advanceTimersByTimeAsync(INBOX_MS);
    expect(reads()).toBe(3);
  });

  it('stops keeping time with nothing to watch (no friends), until poked', async () => {
    let worth = false;
    const { inbox, reads } = poll(() => worth);
    inbox.start();
    await vi.advanceTimersByTimeAsync(INBOX_MS * 5);
    expect(reads()).toBe(1);
    worth = true;
    inbox.poke();
    await vi.advanceTimersByTimeAsync(INBOX_MS);
    expect(reads()).toBe(3);
  });

  it('reads nothing after sign-out, shown or not', async () => {
    const { inbox, reads, hide } = poll();
    inbox.start();
    await vi.advanceTimersByTimeAsync(0);
    inbox.stop();
    hide(true);
    hide(false);
    inbox.poke();
    await vi.advanceTimersByTimeAsync(INBOX_MS * 5);
    expect(reads()).toBe(1);
  });

  it('keeps time after a failed read', async () => {
    let fail = true;
    let hidden = false;
    let reads = 0;
    const inbox = createInboxPoll({
      read: () => {
        reads += 1;
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve(true);
      },
      hidden: () => hidden,
      expecting: () => false,
      setTimer: (run, ms) => Number(setTimeout(run, ms)),
      clearTimer: (id) => {
        clearTimeout(id);
      },
    });
    inbox.start();
    await vi.advanceTimersByTimeAsync(0);
    fail = false;
    hidden = false;
    await vi.advanceTimersByTimeAsync(INBOX_MS);
    expect(reads).toBe(2);
  });

  it('reads every 2 s while something is expected, from the moment it is, then 30 s again', async () => {
    // Calvin, 2026-11-23: a challenge or a rematch's news should arrive at once, not in 30 s.
    const { inbox, reads, expect: expectNow, hide } = poll(() => false);
    inbox.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(reads(), 'nothing to watch: idle').toBe(1);
    expectNow(true);
    await vi.advanceTimersByTimeAsync(INBOX_EXPECTING_MS);
    expect(reads()).toBe(2);
    await vi.advanceTimersByTimeAsync(INBOX_EXPECTING_MS * 4);
    expect(reads()).toBe(6);
    hide(true);
    await vi.advanceTimersByTimeAsync(INBOX_MS);
    expect(reads(), 'hidden: none, expected or not').toBe(6);
    hide(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(reads()).toBe(7);
    expectNow(false);
    await vi.advanceTimersByTimeAsync(INBOX_EXPECTING_MS * 20);
    expect(reads(), 'the last fast read ran, then idle again').toBe(8);
  });

  it('quickens a 30 s wait without reading at once', async () => {
    const { inbox, reads, expect: expectNow } = poll();
    inbox.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expectNow(true);
    expect(reads()).toBe(1);
    await vi.advanceTimersByTimeAsync(INBOX_EXPECTING_MS);
    expect(reads()).toBe(2);
  });

  describe('with the poke socket (ADR 0082)', () => {
    it('reads once on every move to up, then only every 120 s, expecting or not', async () => {
      const { inbox, reads, expect: expectNow } = poll();
      inbox.start();
      await vi.advanceTimersByTimeAsync(0);
      inbox.socket(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(reads()).toBe(2);
      expectNow(true);
      await vi.advanceTimersByTimeAsync(INBOX_SAFETY_MS - 1);
      expect(reads()).toBe(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(reads()).toBe(3);
    });

    it('reads on a poke, at once', async () => {
      const { inbox, reads } = poll();
      inbox.start();
      inbox.socket(true);
      await vi.advanceTimersByTimeAsync(0);
      const before = reads();
      inbox.poke();
      await vi.advanceTimersByTimeAsync(0);
      expect(reads()).toBe(before + 1);
    });

    it('goes back to today’s timers the moment it goes down, without reading at once', async () => {
      const { inbox, reads, expect: expectNow } = poll();
      inbox.start();
      inbox.socket(true);
      await vi.advanceTimersByTimeAsync(0);
      const before = reads();
      inbox.socket(false);
      await vi.advanceTimersByTimeAsync(INBOX_MS - 1);
      expect(reads()).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(reads()).toBe(before + 1);
      inbox.socket(true);
      await vi.advanceTimersByTimeAsync(0);
      inbox.socket(false);
      expectNow(true);
      const quick = reads();
      await vi.advanceTimersByTimeAsync(INBOX_EXPECTING_MS);
      expect(reads()).toBe(quick + 1);
    });

    it('keeps no timer with nothing to watch, a poke still reads', async () => {
      const { inbox, reads } = poll(() => false);
      inbox.start();
      inbox.socket(true);
      await vi.advanceTimersByTimeAsync(INBOX_SAFETY_MS * 3);
      expect(reads()).toBe(2);
      inbox.poke();
      await vi.advanceTimersByTimeAsync(0);
      expect(reads()).toBe(3);
    });
  });
});
