// Phasing (ADR 0026): a phased ball passes through other balls. No contact damage either way, no
// on-touch effects for the other ball, and only the phased ball's own onHitBall runs.
import { describe, expect, it } from 'vitest';
import { DT } from './constants.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import { step } from './step.ts';
import { red, withBalls } from './test-support.ts';
import type { DamageEvent, SimEvent, WorldState } from './types.ts';
import { createWorld } from './world.ts';

/** Always phased; each time it starts overlapping a ball it deals 5 ability damage. */
const wisp = defineBall({
  ...red,
  id: 'wisp',
  initialAbilityState: {},
  phasedOf: () => true,
  hooks: { onHitBall: ({ other }) => [{ kind: 'damage', targetId: other.id, amount: 5 }] },
});

/** Records every ball it touches in its own state, so a test can see whether its hook ran. */
type ToucherState = Readonly<{ touched: number }>;
const toucher = defineBall<ToucherState>({
  ...red,
  id: 'toucher',
  initialAbilityState: { touched: 0 },
  hooks: {
    onHitBall: ({ self }) => [
      { kind: 'setAbilityState', state: { touched: self.abilityState.touched + 1 } },
    ],
  },
});

const lookup = indexDefinitions([wisp, toucher, red]);

/** The wisp and a toucher heading straight at each other along y = 500. */
function headOn(): WorldState {
  return withBalls(createWorld(1, [wisp, toucher]), [
    { position: { x: 300, y: 500 }, velocity: { x: 600, y: 0 } },
    { position: { x: 700, y: 500 }, velocity: { x: -600, y: 0 } },
  ]);
}

function play(world: WorldState, ticks: number) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

const damage = (events: readonly SimEvent[]): DamageEvent[] =>
  events.filter((event): event is DamageEvent => event.type === 'damage');

describe('phasing', () => {
  // Long enough for the two to meet, overlap and pass right through each other.
  const ticks = Math.ceil(600 / (1200 * DT));

  it('passes through: no separation and no bounce, so both keep their heading', () => {
    const { world } = play(headOn(), ticks);
    expect(world.balls[0]?.velocity.x).toBeGreaterThan(0);
    expect(world.balls[1]?.velocity.x).toBeLessThan(0);
    // They have swapped sides.
    expect(world.balls[0]?.position.x ?? 0).toBeGreaterThan(world.balls[1]?.position.x ?? 0);
  });

  it('deals no contact damage either way, only the phased ball’s spectral hit, once per pass', () => {
    const { events } = play(headOn(), ticks);
    expect(damage(events)).toStrictEqual([
      expect.objectContaining({ targetId: 'ball-1', sourceId: 'ball-0', cause: 'ability' }),
    ]);
    expect(events.filter((event) => event.type === 'collision')).toStrictEqual([
      expect.objectContaining({ phased: true, impulse: 0 }),
    ]);
  });

  it('runs no on-touch hook for the other ball', () => {
    const { world } = play(headOn(), ticks);
    expect(world.balls[1]?.abilityState).toStrictEqual({ touched: 0 });
  });

  it('collides as usual when neither ball is phased, with no phased flag on the event', () => {
    const solid = withBalls(createWorld(1, [red, toucher]), [
      { position: { x: 300, y: 500 }, velocity: { x: 600, y: 0 } },
      { position: { x: 700, y: 500 }, velocity: { x: -600, y: 0 } },
    ]);
    const { world, events } = play(solid, ticks);
    const collision = events.find((event) => event.type === 'collision');
    expect(collision).toBeDefined();
    expect(collision).not.toHaveProperty('phased');
    expect(damage(events).map((event) => event.cause)).toStrictEqual(['contact', 'contact']);
    expect(world.balls[1]?.abilityState).toStrictEqual({ touched: 1 });
  });
});
