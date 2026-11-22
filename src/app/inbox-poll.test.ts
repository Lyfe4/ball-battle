// The inbox's wait (ADR 0079, PR (d)), with fake timers: a read at the start, one every 30 s while
// visible and worth it, none while hidden, one at once on return, none after sign-out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInboxPoll, INBOX_MS } from './inbox-poll.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function poll(answers: () => boolean = () => true) {
  let hidden = false;
  let reads = 0;
  const inbox = createInboxPoll({
    read: () => {
      reads += 1;
      return Promise.resolve(answers());
    },
    hidden: () => hidden,
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
});
