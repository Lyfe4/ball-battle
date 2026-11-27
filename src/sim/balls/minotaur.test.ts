import { describe, expect, it } from 'vitest';
import { ARENA_SIZE } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { red, withBalls } from '../test-support.ts';
import type { SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { CHARGE_TIMES, minotaur, SHOCK_RADIUS, type MinotaurState } from './minotaur.ts';

/** A test-only ball that barely moves: a rooted target. */
const post = defineBall({ ...red, id: 'post', speed: 1 });
const lookup = indexDefinitions([minotaur, red, post]);

function play(world: WorldState, ticks: number): SimEvent[] {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return events;
}

/** The Minotaur at the left, about to lower its head at a target at (700, 500). */
function aboutToCharge(target: typeof red, targetVelocity: Vec2): WorldState {
  const marked: MinotaurState = { phase: 'roam', phaseEnds: 1, aimX: 0, aimY: 0 };
  return withBalls(createWorld(1, [minotaur, target]), [
    { position: { x: 200, y: 500 }, velocity: { x: 0, y: -10 }, abilityState: marked },
    { position: { x: 700, y: 500 }, velocity: targetVelocity },
  ]);
}

const bumpsBy = (events: SimEvent[], id: string) =>
  events.filter((e) => e.type === 'damage' && e.cause === 'contact' && e.sourceId === id);

describe('the Minotaur (prototype)', () => {
  it('charges in a straight line at the marked point, and a hit mid-charge lands huge', () => {
    const events = play(aboutToCharge(post, { x: 0, y: 1 }), 60);
    const [hit] = bumpsBy(events, 'ball-0');
    if (hit?.type !== 'damage') throw new Error('expected the charge to hit');
    // Dead-on, so directness is about 1: the whole multiple lands.
    expect(hit.amount).toBe(Math.round(minotaur.contactDamage * CHARGE_TIMES));
  });

  it('never turns mid-charge: a ball that moved off the line is missed, and the wall shakes', () => {
    // The target runs down off the line the moment the Minotaur charges at where it was.
    const events = play(aboutToCharge(red, { x: 0, y: red.speed }), 80);
    expect(bumpsBy(events, 'ball-0')).toHaveLength(0);
    const shock = events.find((e) => e.type === 'zoneSpawned');
    if (shock?.type !== 'zoneSpawned') throw new Error('expected a shockwave at the wall');
    expect(shock.radius).toBe(SHOCK_RADIUS);
    // At the right wall, the zone clamped into the arena.
    expect(shock.position.x).toBe(ARENA_SIZE - SHOCK_RADIUS);
  });
});
