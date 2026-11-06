import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { SimEvent } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { showsAbility } from './ability-sign.ts';
import { createSourceChips, CHIP_MS } from './source-chips.ts';

function eventsOf(a: string, b: string, seed: number): SimEvent[] {
  let world = createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
  const events: SimEvent[] = [];
  while (world.match.status === 'running') {
    const result = step(world, BALL_LOOKUP);
    world = result.world;
    events.push(...result.events);
  }
  return events;
}

describe('the moment a ball’s ability shows (ADR 0036)', () => {
  it('happens in real matches for every ball that names one, and only for that ball', () => {
    for (const ball of BALLS) {
      const { ability } = ball;
      if (ability === undefined) continue;
      // Against the Brawler (no ability of its own), and against Thorns for a ball whose ability
      // only answers being hit.
      const shown = [1, 2, 3].some((seed) =>
        ['brawler', 'thorns', 'vampire'].some((other) =>
          eventsOf(ball.id, other, seed).some((event) =>
            showsAbility(event, 'ball-0', ability.shownBy),
          ),
        ),
      );
      expect(shown, ball.id).toBe(true);
      // The other ball's events never show it.
      const mirrorless = eventsOf('brawler', ball.id, 1);
      expect(mirrorless.some((event) => showsAbility(event, 'ball-0', ability.shownBy))).toBe(
        false,
      );
    }
  });

  it('puts a chip on the ball hit by unseen damage, and fades it', () => {
    const chips = createSourceChips();
    const damage = (via: 'poison' | 'projectile') =>
      ({
        type: 'damage',
        tick: 1,
        targetId: 'ball-1',
        sourceId: 'ball-0',
        cause: 'ability',
        amount: 2,
        healthAfter: 50,
        multiplier: 1,
        survivedLethal: false,
        via,
      }) as const;
    chips.apply([damage('projectile')], 0);
    expect(chips.chips(0)).toStrictEqual([]);
    chips.apply([damage('poison')], 100);
    expect(chips.chips(100)).toStrictEqual([
      { targetId: 'ball-1', sourceId: 'ball-0', strength: 1 },
    ]);
    expect(chips.isActive(100 + CHIP_MS - 1)).toBe(true);
    expect(chips.chips(100 + CHIP_MS)).toStrictEqual([]);
    expect(chips.isActive(100 + CHIP_MS)).toBe(false);
  });
});
