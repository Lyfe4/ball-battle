import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from './balls/index.ts';
import { getDefinition } from './definitions.ts';
import { step } from './step.ts';
import type { DamageEvent, DamageVia, SimEvent } from './types.ts';
import { createWorld } from './world.ts';

/** Every event of a whole match between `a` and `b`. */
function eventsOf(a: string, b: string, seed = 7): SimEvent[] {
  let world = createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
  const events: SimEvent[] = [];
  while (world.match.status === 'running') {
    const result = step(world, BALL_LOOKUP);
    world = result.world;
    events.push(...result.events);
  }
  return events;
}

const damageOf = (events: readonly SimEvent[]) =>
  events.filter((event): event is DamageEvent => event.type === 'damage');

describe('what delivered the damage (ADR 0036)', () => {
  it('names every ability damage and no contact damage', () => {
    for (const [a, b] of [
      ['venom', 'thorns'],
      ['inferno', 'brawler'],
      ['archer', 'necromancer'],
      ['storm', 'speedster'],
      ['ghost', 'quake'],
    ] as const) {
      for (const damage of damageOf(eventsOf(a, b))) {
        if (damage.cause === 'contact') expect(damage.via).toBeUndefined();
        else expect(damage.via, `${a} vs ${b}`).toBeDefined();
      }
    }
  });

  it('tells poison, burning patches, strikes, arrows, skulls and reflected spikes apart', () => {
    const seen = (a: string, b: string, source: string): Set<DamageVia | undefined> =>
      new Set(
        [1, 2, 3, 4, 5]
          .flatMap((seed) => damageOf(eventsOf(a, b, seed)))
          .filter((damage) => damage.sourceId === source && damage.cause === 'ability')
          .map((damage) => damage.via),
      );
    // The first ball is ball-0, the second ball-1.
    expect(seen('venom', 'brawler', 'ball-0')).toContain('poison');
    expect(seen('inferno', 'brawler', 'ball-0')).toContain('zonePulse');
    expect(seen('storm', 'brawler', 'ball-0')).toContain('zone');
    expect(seen('archer', 'brawler', 'ball-0')).toContain('projectile');
    expect(seen('necromancer', 'brawler', 'ball-0')).toContain('minion');
    expect(seen('thorns', 'brawler', 'ball-0')).toStrictEqual(new Set(['onDamageTaken']));
  });
});
