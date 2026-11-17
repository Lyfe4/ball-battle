import { describe, expect, it } from 'vitest';
import { frameLine, frameStats } from './frame-meter.ts';

describe('frameStats', () => {
  it('reads a steady 30 frames a second as the cap, nothing late', () => {
    const stats = frameStats(Array.from({ length: 60 }, () => 1000 / 30));
    expect(frameLine(stats)).toBe('30 fps · 0% late · worst 33 ms');
  });

  it('counts a gap over one and a half beats as late (a dropped frame)', () => {
    const gaps = [...Array.from({ length: 18 }, () => 1000 / 30), 66.7, 100];
    expect(frameLine(frameStats(gaps))).toBe('30 fps · 10% late · worst 100 ms');
  });

  it('waits for two gaps', () => {
    expect(frameLine(frameStats([16.7]))).toBe('… fps');
  });
});
