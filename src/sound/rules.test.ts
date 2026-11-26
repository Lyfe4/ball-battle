// The soft tick on every control (ADR 0070) through its gate: one per tap even if a click is passed
// on, and a quick run of taps through a menu gets quieter instead of tiring.
import { describe, expect, it } from 'vitest';
import { createGate, RUN_FLOOR } from './gate.ts';
import { MENU_RULES } from './rules.ts';

const tap = (kind: 'tap' | 'press' | 'back') => [{ kind, strength: 1 }];

describe('a control’s tick', () => {
  it('sounds once for a click passed on within the same moment', () => {
    const gate = createGate(MENU_RULES);
    expect(gate.pass(tap('press'), 0)).toEqual([1]);
    expect(gate.pass(tap('press'), 20)).toEqual([0]);
  });

  it('gates a key moment’s tap as every other control (ADR 0070)', () => {
    expect(MENU_RULES.tap).toBe(MENU_RULES.press);
    const gate = createGate(MENU_RULES);
    expect(gate.pass(tap('tap'), 0)).toEqual([1]);
    expect(gate.pass(tap('tap'), 20)).toEqual([0]);
  });

  it('gets quieter through a quick run of taps, never silent, and is full again after a pause', () => {
    const gate = createGate(MENU_RULES);
    const run = [0, 120, 240, 360, 480, 600].map((at) => gate.pass(tap('press'), at)[0] ?? 0);
    expect(run[0]).toBe(1);
    expect(run.at(-1)).toBeLessThan(0.6);
    expect(Math.min(...run)).toBeGreaterThanOrEqual(RUN_FLOOR);
    expect(gate.pass(tap('press'), 2_000)).toEqual([1]);
  });
});
