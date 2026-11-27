// The Hunter's and the Tortoise's looks (ADR 0091): each shows its ability and where it is up to,
// drawn alike at every size in fractions of r (as state-looks.test.ts holds the others).
import { describe, expect, it } from 'vitest';
import { FIRST_SNARE_TICK, hunter, SNARE_EVERY_TICKS } from '../../sim/balls/hunter.ts';
import { tortoise } from '../../sim/balls/tortoise.ts';
import type { BallDefinition, BallState } from '../../sim/types.ts';
import { createWorld } from '../../sim/world.ts';
import { theme } from '../theme.ts';
import { hunterDesign } from './hunter.ts';
import { clampGap } from './jaw-trap.ts';
import { record } from './test-support.ts';
import { peekOf, tortoiseDesign } from './tortoise.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

function view(
  definition: BallDefinition,
  radius: number,
  simple: boolean,
  change: Partial<BallState> = {},
  extra: Partial<DesignView> = {},
): DesignView {
  const [ball] = createWorld(1, [definition, definition]).balls;
  if (ball === undefined) throw new Error('expected a ball');
  return {
    ball: { ...ball, velocity: { x: definition.speed, y: 0 }, ...change },
    radius,
    base: definition.color,
    accent: '#111111',
    tick: 600,
    heading: { x: 1, y: 0 },
    heal: 0,
    simple,
    shotsOut: 0,
    minionsOut: 0,
    ...extra,
  };
}

const SIZES = Array.from({ length: 21 }, (_, i) => 10 + i * 5);
const held: Partial<BallState> = {
  statuses: [{ kind: 'held', sourceId: 'ball-1', expiresTick: 620, sinceTick: 590 }],
};

const CASES: readonly (readonly [
  string,
  BallDesign,
  BallDefinition,
  Partial<BallState>,
  Partial<DesignView>,
])[] = [
  ['Hunter', hunterDesign, hunter, { abilityState: { nextSnareTick: FIRST_SNARE_TICK } }, {}],
  ['Tortoise, out', tortoiseDesign, tortoise, {}, {}],
  ['Tortoise, ducking', tortoiseDesign, tortoise, {}, { glance: 0.6 }],
  ['Tortoise, held', tortoiseDesign, tortoise, held, {}],
];

/** How far past the ball's centre each arc a design's outline draws reaches, as a share of r. */
function outlineReach(design: BallDesign, shown: DesignView): number {
  let most = 0;
  const painter = {
    arc: (x: number, y: number, radius: number) => {
      most = Math.max(most, (Math.hypot(x, y) + radius) / shown.radius);
    },
    lineTo: () => undefined,
    moveTo: () => undefined,
    closePath: () => undefined,
  } as unknown as Painter;
  design.outline?.(painter, shown);
  return most;
}

describe('the Hunter and the Tortoise show their state (ADR 0091)', () => {
  for (const [name, design, definition, change, extra] of CASES) {
    it(`${name}: the same drawing, scaled, at every size, phone and desktop alike`, () => {
      const first = record(design, view(definition, SIZES[0] ?? 10, true, change, extra));
      for (const radius of SIZES) {
        for (const simple of [true, false]) {
          expect(record(design, view(definition, radius, simple, change, extra))).toStrictEqual(
            first,
          );
        }
      }
    });
  }

  it('Hunter: shows no state on the ball (the owner waives ADR 0071: its snares show it)', () => {
    const at = (nextSnareTick: number) =>
      record(hunterDesign, view(hunter, 50, false, { abilityState: { nextSnareTick } }));
    const opening = at(FIRST_SNARE_TICK);
    for (const next of [600, 600 + SNARE_EVERY_TICKS / 2, 600 + SNARE_EVERY_TICKS]) {
      expect(at(next)).toStrictEqual(opening);
    }
  });

  it('Hunter: its ears break its edge by no more than an icon’s padding', () => {
    const calls = record(hunterDesign, view(hunter, 50, false));
    const reach = Math.max(
      ...calls
        .filter((call) => call.startsWith('lineTo(') || call.startsWith('moveTo('))
        .map((call) => {
          const [x = 0, y = 0] = call.slice(7, -1).split(',').map(Number);
          return Math.hypot(x, y);
        }),
    );
    expect(reach).toBeGreaterThan(1);
    expect(reach).toBeLessThanOrEqual(1.12);
  });

  it('Hunter: a snared ball has the trap snap shut round it, then hold', () => {
    expect(clampGap(0)).toBe(theme.trapSnapGap);
    expect(clampGap(theme.trapSnapTicks / 2)).toBeLessThan(theme.trapSnapGap);
    expect(clampGap(theme.trapSnapTicks)).toBe(theme.trapClampGap);
    expect(clampGap(theme.trapSnapTicks * 5)).toBe(theme.trapClampGap);
  });

  it('Tortoise: out while it moves, in while held or still, and ducking as its shell cuts a hit', () => {
    const [ball] = createWorld(1, [tortoise, tortoise]).balls;
    if (ball === undefined) throw new Error('expected a ball');
    const moving = { ...ball, velocity: { x: 0, y: tortoise.speed } };
    expect(peekOf(moving, 0)).toBe(1);
    expect(peekOf(moving, 1)).toBe(0);
    expect(peekOf(moving, 0.25)).toBe(0.75);
    expect(peekOf({ ...moving, velocity: { x: 0, y: 0 } }, 0)).toBe(0);
    expect(peekOf({ ...moving, ...held }, 0)).toBe(0);
  });

  it('Tortoise: its head and feet break its edge only when out, within an icon’s padding', () => {
    const out = outlineReach(tortoiseDesign, view(tortoise, 50, false));
    expect(out).toBeGreaterThan(1.05);
    expect(out).toBeLessThanOrEqual(1.12);
    expect(outlineReach(tortoiseDesign, view(tortoise, 50, false, {}, { glance: 1 }))).toBe(1);
    expect(outlineReach(tortoiseDesign, view(tortoise, 50, false, held))).toBe(1);
  });
});
