import { describe, expect, it } from 'vitest';
import { createGate, MAX_PER_WINDOW, MIX_WINDOW_MS, RUN_FLOOR } from './gate.ts';

const rules = { tick: { gapMs: 50, runMs: 200 }, boom: { gapMs: 0, runMs: 0 } } as const;
const one = (kind: 'tick' | 'boom', strength = 0.5) => ({ kind, strength });

describe('createGate', () => {
  it('drops a repeat closer than its gap and lets the next one through', () => {
    const gate = createGate(rules);
    expect(gate.pass([one('tick')], 0)).toEqual([1]);
    expect(gate.pass([one('tick')], 30)).toEqual([0]);
    expect(gate.pass([one('tick')], 60)[0]).toBeGreaterThan(0);
  });

  it('plays a stream quieter with each repeat, never under the floor, and full again after a pause', () => {
    const gate = createGate(rules);
    const gains = [0, 60, 120, 180, 240, 300, 360, 420].map(
      (at) => gate.pass([one('tick')], at)[0],
    );
    expect(gains[0]).toBe(1);
    for (let i = 1; i < gains.length; i += 1) {
      expect(gains[i]).toBeLessThanOrEqual(gains[i - 1] ?? 1);
      expect(gains[i]).toBeGreaterThanOrEqual(RUN_FLOOR);
    }
    expect(gains.at(-1)).toBe(RUN_FLOOR);
    expect(gate.pass([one('tick')], 1000)).toEqual([1]);
  });

  it('holds the whole mix to a few sounds per window, the strongest first', () => {
    const gate = createGate(rules);
    // At 2x speed a frame can carry many ticks' sounds at once.
    const wanted = Array.from({ length: 8 }, (_, i) => one('boom', i / 10));
    const gains = gate.pass(wanted, 0);
    expect(gains.filter((gain) => gain > 0)).toHaveLength(MAX_PER_WINDOW);
    expect(gains.slice(-MAX_PER_WINDOW).every((gain) => gain > 0)).toBe(true);
    expect(gate.pass([one('boom')], MIX_WINDOW_MS / 2)).toEqual([0]);
    expect(gate.pass([one('boom')], MIX_WINDOW_MS + 1)).toEqual([1]);
  });

  it('always plays a kind marked always, even with the mix full, and counts it toward the cap', () => {
    const gate = createGate({ ...rules, last: { gapMs: 0, runMs: 0, always: true } });
    const full = Array.from({ length: MAX_PER_WINDOW }, () => one('boom', 1));
    expect(gate.pass(full, 0).every((gain) => gain > 0)).toBe(true);
    // A knockout a moment later, the window still full: heard.
    expect(gate.pass([{ kind: 'last', strength: 1 }], 50)[0]).toBeGreaterThan(0);
    // An ordinary sound after it is still capped.
    expect(gate.pass([one('tick')], 60)).toEqual([0]);
    expect(gate.pass([one('tick')], MIX_WINDOW_MS + 51)[0]).toBeGreaterThan(0);
  });

  it('starts over on reset', () => {
    const gate = createGate(rules);
    gate.pass([one('tick')], 0);
    gate.reset();
    expect(gate.pass([one('tick')], 10)).toEqual([1]);
  });
});

describe('repeats in tune (ADR 0064)', () => {
  it('moves a repeat at most 20 cents either way, so a tonal sound keeps its note', async () => {
    const { VARIETY } = await import('./sound.ts');
    expect(Math.max(...VARIETY.map(Math.abs))).toBeLessThanOrEqual(20);
  });
});
