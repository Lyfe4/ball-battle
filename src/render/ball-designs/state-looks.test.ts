import { describe, expect, it } from 'vitest';
import { bomber, DROP_TICKS } from '../../sim/balls/bomber.ts';
import { necromancer, SUMMON_TICKS } from '../../sim/balls/necromancer.ts';
import { lifestealFor, vampire } from '../../sim/balls/vampire.ts';
import type { BallDefinition, BallState } from '../../sim/types.ts';
import { createWorld } from '../../sim/world.ts';
import { bomberDesign, fuseLeft } from './bomber.ts';
import { NECROMANCER_LOOKS } from './necromancer.ts';
import { record } from './test-support.ts';
import type { BallDesign, DesignView } from './types.ts';
import { thirstOf, vampireDesign } from './vampire.ts';

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
    ball: { ...ball, ...change },
    radius,
    base: definition.color,
    accent: '#111111',
    tick: 30,
    heading: undefined,
    heal: 0,
    simple,
    shotsOut: 0,
    minionsOut: 0,
    ...extra,
  };
}

/** Radii on screen from a small phone to a large desktop, in world units drawn at those sizes. */
const SIZES = Array.from({ length: 21 }, (_, i) => 10 + i * 5);

const CASES: readonly (readonly [string, BallDesign, BallDefinition, Partial<BallState>])[] = [
  ['Bomber', bomberDesign, bomber, {}],
  ['Necromancer skull', NECROMANCER_LOOKS.skull, necromancer, {}],
  ['Necromancer ring', NECROMANCER_LOOKS.ring, necromancer, {}],
  ['Vampire', vampireDesign, vampire, { health: 20 }],
];

describe('the round-2 state looks', () => {
  for (const [name, design, definition, change] of CASES) {
    it(`${name}: the same drawing, scaled, at every size, phone and desktop alike`, () => {
      const first = record(design, view(definition, SIZES[0] ?? 10, true, change));
      for (const radius of SIZES) {
        for (const simple of [true, false]) {
          expect(record(design, view(definition, radius, simple, change))).toStrictEqual(first);
        }
      }
    });
  }

  it('Bomber: the fuse is whole just after a drop and burns down to none at the next', () => {
    expect(fuseLeft(DROP_TICKS, 0)).toBe(1);
    expect(fuseLeft(DROP_TICKS, DROP_TICKS / 2)).toBeCloseTo(0.5, 12);
    expect(fuseLeft(DROP_TICKS, DROP_TICKS)).toBe(0);
  });

  it('Necromancer: no skull forms while its skull is out, only once it is gone', () => {
    const tick = SUMMON_TICKS - 10;
    for (const design of Object.values(NECROMANCER_LOOKS)) {
      const out = record(design, view(necromancer, 50, false, {}, { tick, minionsOut: 1 }));
      const none = record(design, view(necromancer, 50, false, {}, { tick, minionsOut: 0 }));
      // While one is out the eyes are dim, and nothing of the next skull is drawn.
      expect(out.some((call) => call.endsWith(',0.3500)'))).toBe(true);
      expect(none.length).toBeGreaterThan(out.length);
    }
  });

  it('Vampire: thirst is 0 at full health and full once a whole bump would heal it', () => {
    const fullHeal = lifestealFor(vampire.contactDamage);
    expect(thirstOf(vampire.maxHealth)).toBe(0);
    expect(thirstOf(vampire.maxHealth - fullHeal / 2)).toBeCloseTo(0.5, 12);
    expect(thirstOf(vampire.maxHealth - fullHeal)).toBe(1);
    expect(thirstOf(1)).toBe(1);
  });
});
