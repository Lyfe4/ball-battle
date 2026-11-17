import { describe, expect, it } from 'vitest';
import {
  askEveryMs,
  CLOCK_SAMPLES,
  NO_CLOCK,
  offsetOf,
  serverNowOf,
  WARM_SAMPLES,
  withSample,
} from './live-clock.ts';

describe('the server clock', () => {
  it('knows nothing before the first answer', () => {
    expect(offsetOf(NO_CLOCK)).toBe(0);
  });

  it('takes the middle of the round trip as when the server answered', () => {
    // This device is 3 s behind: the server said 13,100 at the middle of a 200 ms trip.
    const clock = withSample(NO_CLOCK, { sentAt: 10_000, receivedAt: 10_200, serverNow: 13_100 });
    expect(offsetOf(clock)).toBe(3_000);
    expect(serverNowOf(clock, 20_000)).toBe(23_000);
  });

  it('trusts the answer with the shortest round trip over a slow one', () => {
    let clock = withSample(NO_CLOCK, { sentAt: 0, receivedAt: 3_000, serverNow: 2_900 });
    clock = withSample(clock, { sentAt: 5_000, receivedAt: 5_100, serverNow: 5_050 });
    clock = withSample(clock, { sentAt: 6_000, receivedAt: 7_500, serverNow: 6_100 });
    expect(offsetOf(clock)).toBe(0);
  });

  it('forgets answers older than the last few', () => {
    let clock = withSample(NO_CLOCK, { sentAt: 0, receivedAt: 10, serverNow: 5 });
    for (let i = 1; i <= CLOCK_SAMPLES; i += 1) {
      clock = withSample(clock, {
        sentAt: i * 1000,
        receivedAt: i * 1000 + 300,
        serverNow: i * 1000 + 650,
      });
    }
    expect(clock.samples).toHaveLength(CLOCK_SAMPLES);
    expect(offsetOf(clock)).toBe(500);
  });

  it('ignores an answer that arrived before it was sent (the device clock jumped)', () => {
    const clock = withSample(NO_CLOCK, { sentAt: 1_000, receivedAt: 900, serverNow: 0 });
    expect(clock.samples).toHaveLength(0);
  });
});

describe('how often a live page asks', () => {
  const sample = (at: number) => ({ sentAt: at, receivedAt: at + 300, serverNow: at + 150 });

  it('asks four times a second until its clock rests on a few answers, then once a second', () => {
    let clock = NO_CLOCK;
    expect(askEveryMs(clock)).toBe(250);
    for (let n = 0; n < WARM_SAMPLES - 1; n += 1) clock = withSample(clock, sample(n * 1000));
    expect(askEveryMs(clock)).toBe(250);
    clock = withSample(clock, sample(9_000));
    expect(askEveryMs(clock)).toBe(1_000);
  });
});
