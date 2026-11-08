// One owner's lasting zones never stack (ADR 0045, group 3): a ball standing in several of the
// Inferno's patches when they burn together is burned once, not once per patch.
import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { DamageEvent, SimEvent } from '../types.ts';
import { createWorld } from '../world.ts';
import type { ZoneRequest } from './spawn.ts';

const DAMAGE = 3;

/** A test-only ball that marks `count` overlapping zones on tick 1 around (500, 500). */
function burner(count: number, lasting: boolean) {
  const zone = (offset: number): ZoneRequest => ({
    position: { x: 500 + offset, y: 500 },
    radius: 100,
    damage: DAMAGE,
    delayTicks: 2,
    ...(lasting ? { linger: { ticks: 30, pulseEveryTicks: 10 } } : {}),
  });
  return defineBall({
    id: 'burner',
    name: 'Burner',
    description: 'Test fixture: marks overlapping zones.',
    color: '#ffffff',
    radius: 50,
    speed: 800,
    maxHealth: 100,
    contactDamage: 10,
    initialAbilityState: {},
    hooks: {
      onTick: ({ world }) =>
        world.tick === 1
          ? Array.from({ length: count }, (_, i) => ({
              kind: 'spawnZone' as const,
              ...zone(i * 10),
            }))
          : [],
    },
  });
}

/** Damage `red` (parked inside every zone) takes over `ticks`, with `count` zones on it. */
function damageTaken(count: number, lasting: boolean, ticks: number): DamageEvent[] {
  const owner = burner(count, lasting);
  const lookup = indexDefinitions([owner, red, blue]);
  const still = { x: 0, y: 0 };
  let world = withBalls(createWorld(1, [owner, red, blue]), [
    { position: { x: 80, y: 80 }, velocity: still },
    { position: { x: 500, y: 500 }, velocity: still },
    { position: { x: 900, y: 900 }, velocity: still },
  ]);
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(world, lookup);
    world = result.world;
    events.push(...result.events);
  }
  return events.filter(
    (event): event is DamageEvent => event.type === 'damage' && event.targetId === 'ball-1',
  );
}

describe('lasting zones of one owner', () => {
  it('burn a ball once per beat however many of them it stands in', () => {
    const one = damageTaken(1, true, 40);
    const three = damageTaken(3, true, 40);
    expect(one.length).toBeGreaterThan(1);
    expect(three.map((hit) => [hit.tick, hit.amount])).toStrictEqual(
      one.map((hit) => [hit.tick, hit.amount]),
    );
  });

  it('leaves strike-once zones alone: each one still hits', () => {
    expect(damageTaken(3, false, 10)).toHaveLength(3);
  });
});
