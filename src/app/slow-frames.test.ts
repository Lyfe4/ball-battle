import { describe, expect, it } from 'vitest';
import { createSlowFrames, SLOW_WINDOW } from './slow-frames.ts';

function feed(gaps: readonly number[]): ReturnType<typeof createSlowFrames> {
  const frames = createSlowFrames();
  for (const gap of gaps) frames.add(gap);
  return frames;
}

const times = (count: number, gap: number) => Array.from({ length: count }, () => gap);

describe('slow frames', () => {
  it('is sustained after a whole window at 30 a second', () => {
    expect(feed(times(SLOW_WINDOW - 1, 1000 / 30)).sustained()).toBe(false);
    expect(feed(times(SLOW_WINDOW, 1000 / 30)).sustained()).toBe(true);
  });

  it('is never set off by a stall, or several, at 60 a second', () => {
    const gaps = times(SLOW_WINDOW * 4, 1000 / 60);
    for (const at of [10, 200, 400, 401, 402]) gaps[at] = 600;
    expect(feed(gaps).sustained()).toBe(false);
  });

  it('is not set off at 60 or 120 a second, nor by an uneven 60 now and then slow', () => {
    expect(feed(times(SLOW_WINDOW * 3, 1000 / 60)).sustained()).toBe(false);
    expect(feed(times(SLOW_WINDOW * 3, 1000 / 120)).sustained()).toBe(false);
    const mixed = times(SLOW_WINDOW * 3, 1000 / 60).map((gap, i) => (i % 2 === 0 ? 34 : gap));
    expect(feed(mixed).sustained()).toBe(false);
  });

  it('counts an uneven 25/42 ms beat (Low Power Mode at its worst) and an old phone as slow', () => {
    const uneven = times(SLOW_WINDOW, 0).map((_, i) => (i % 2 === 0 ? 25 : 42));
    expect(feed(uneven).sustained()).toBe(true);
    expect(feed(times(SLOW_WINDOW, 1000 / 20)).sustained()).toBe(true);
  });

  it('is not set off by 40 a second', () => {
    expect(feed(times(SLOW_WINDOW * 2, 1000 / 40)).sustained()).toBe(false);
  });

  it('stays set once set, however fast frames come after', () => {
    const frames = feed(times(SLOW_WINDOW, 33));
    for (const gap of times(SLOW_WINDOW * 2, 1000 / 60)) frames.add(gap);
    expect(frames.sustained()).toBe(true);
  });
});
