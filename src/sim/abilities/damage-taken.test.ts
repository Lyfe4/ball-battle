import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { red, withBalls } from '../test-support.ts';
import type { BallDefinition, DamageEvent, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';

type LogState = Readonly<{ taken: readonly string[]; dealt: readonly string[] }>;

/**
 * A test-only ball that logs every onDamageTaken and onDamageDealt call, and reflects `reflect`
 * damage back at the attacker of each damage instance it takes.
 */
function logger(id: string, reflect: number, onHitDamage = 0): BallDefinition {
  return defineBall<LogState>({
    ...red,
    id,
    name: id,
    initialAbilityState: { taken: [], dealt: [] },
    hooks: {
      onHitBall: ({ other }) =>
        onHitDamage > 0 ? [{ kind: 'damage', targetId: other.id, amount: onHitDamage }] : [],
      onDamageTaken: ({ self, attacker, amount, cause }) => [
        {
          kind: 'setAbilityState',
          state: {
            ...self.abilityState,
            taken: [...self.abilityState.taken, `${cause} ${amount} from ${attacker.id}`],
          },
        },
        ...(reflect > 0
          ? [{ kind: 'damage', targetId: attacker.id, amount: reflect } as const]
          : []),
      ],
      onDamageDealt: ({ self, amount, cause }) => [
        {
          kind: 'setAbilityState',
          state: {
            ...self.abilityState,
            dealt: [...self.abilityState.dealt, `${cause} ${amount}`],
          },
        },
      ],
    },
  });
}

/** Two balls heading straight at each other, colliding within a few ticks. */
function headOn(a: BallDefinition, b: BallDefinition): WorldState {
  return withBalls(createWorld(1, [a, b]), [
    { position: { x: 380, y: 500 }, velocity: { x: red.speed, y: 0 } },
    { position: { x: 620, y: 500 }, velocity: { x: -red.speed, y: 0 } },
  ]);
}

function play(world: WorldState, definitions: readonly BallDefinition[], ticks: number) {
  const lookup = indexDefinitions(definitions);
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

const log = (world: WorldState, index: number, key: 'taken' | 'dealt'): unknown =>
  world.balls[index]?.abilityState[key];
const damage = (events: readonly SimEvent[]): DamageEvent[] =>
  events.filter((event): event is DamageEvent => event.type === 'damage');

describe('onDamageTaken', () => {
  it('runs once per damage instance taken, with the attacker, amount and cause', () => {
    const a = logger('a', 0);
    const b = logger('b', 0, 5);
    const { world, events } = play(headOn(a, b), [a, b], 20);
    const hits = damage(events);
    // Head-on: both deal full contact damage, and b's onHitBall adds 5 ability damage to a.
    expect(hits.map((event) => `${event.targetId} ${event.cause} ${event.amount}`)).toStrictEqual([
      `ball-0 contact ${red.contactDamage}`,
      `ball-1 contact ${red.contactDamage}`,
      'ball-0 ability 5',
    ]);
    const calls = events.flatMap((event) =>
      event.type === 'abilityTriggered' && event.hook === 'onDamageTaken' ? [event.ballId] : [],
    );
    // In damage-event order.
    expect(calls).toStrictEqual(['ball-0', 'ball-1', 'ball-0']);
    // Both of ball-0's calls see the phase's snapshot, so its state keeps the last one's entry.
    expect(log(world, 0, 'taken')).toStrictEqual(['ability 5 from ball-1']);
    expect(log(world, 1, 'taken')).toStrictEqual([`contact ${red.contactDamage} from ball-0`]);
  });

  it('runs after onDamageDealt, in the same tick as the damage', () => {
    const a = logger('a', 0);
    const b = logger('b', 0);
    const { events } = play(headOn(a, b), [a, b], 20);
    const hooks = events
      .filter((event) => event.type === 'abilityTriggered')
      .map((event) => `${event.tick} ${event.ballId} ${event.hook}`);
    const tick = damage(events)[0]?.tick ?? -1;
    expect(hooks).toStrictEqual([
      // In damage-event order: ball-0 was hit first, by ball-1.
      `${tick} ball-1 onDamageDealt`,
      `${tick} ball-0 onDamageDealt`,
      `${tick} ball-0 onDamageTaken`,
      `${tick} ball-1 onDamageTaken`,
    ]);
  });

  it('never loops: reflected damage fires neither onDamageTaken nor onDamageDealt again', () => {
    const a = logger('a', 3);
    const b = logger('b', 3);
    const { world, events } = play(headOn(a, b), [a, b], 20);
    const hits = damage(events);
    // Two contact hits, then exactly one reflection each, and nothing more.
    expect(hits.map((event) => `${event.targetId} ${event.cause} ${event.amount}`)).toStrictEqual([
      `ball-0 contact ${red.contactDamage}`,
      `ball-1 contact ${red.contactDamage}`,
      'ball-1 ability 3',
      'ball-0 ability 3',
    ]);
    for (const index of [0, 1]) {
      expect(log(world, index, 'taken')).toHaveLength(1);
      expect(log(world, index, 'dealt')).toStrictEqual([`contact ${red.contactDamage}`]);
    }
    expect(world.balls.map((ball) => ball.health)).toStrictEqual([
      red.maxHealth - red.contactDamage - 3,
      red.maxHealth - red.contactDamage - 3,
    ]);
  });
});
