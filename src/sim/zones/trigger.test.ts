// Zones that can be set off (ADR 0043): an armed bomb goes off the moment an enemy ball touches it.
import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { BallDefinition, SimEvent, WorldState, ZoneState, ZoneStruckEvent } from '../types.ts';
import { createWorld } from '../world.ts';
import { triggeredBy } from './trigger.ts';

const FUSE = 60;
const ARM = 5;

/** A test-only ball that drops one bomb at (500, 500) on tick 1. */
const dropper = defineBall({
  id: 'dropper',
  name: 'Dropper',
  description: 'Test fixture: drops one bomb.',
  color: '#ffffff',
  radius: 50,
  speed: 800,
  maxHealth: 100,
  contactDamage: 10,
  initialAbilityState: {},
  hooks: {
    onTick: ({ world }) =>
      world.tick === 1
        ? [
            {
              kind: 'spawnZone',
              position: { x: 500, y: 500 },
              radius: 100,
              damage: 7,
              delayTicks: FUSE,
              trigger: { radius: 20, armTicks: ARM },
            },
          ]
        : [],
  },
});

/** A plain ball that is phased all match. */
const wisp: BallDefinition = defineBall({
  ...red,
  id: 'wisp',
  phasedOf: () => true,
});

/** The dropper parked in a corner and `target` heading along y = 500 from `x` at `perTick`. */
function setup(target: BallDefinition, x: number, perTick: number) {
  const lookup = indexDefinitions([dropper, target, blue]);
  let world: WorldState = withBalls(createWorld(1, [dropper, target]), [
    { position: { x: 80, y: 80 }, velocity: { x: 0, y: 0 } },
    { position: { x, y: 500 }, velocity: { x: perTick / DT, y: 0 } },
  ]);
  const events: SimEvent[] = [];
  return {
    play(ticks: number) {
      for (let i = 0; i < ticks; i++) {
        const result = step(world, lookup);
        world = result.world;
        events.push(...result.events);
      }
      return { world, events };
    },
  };
}

const struck = (events: readonly SimEvent[]) =>
  events.filter((event): event is ZoneStruckEvent => event.type === 'zoneStruck');

describe('zones that can be set off', () => {
  it('go off the moment an enemy ball touches them once armed', () => {
    // Red rolls in from x = 200 at 10 a tick: it reaches the bomb's body (reach 70) around tick 24,
    // long before the fuse runs out.
    const { events } = setup(red, 200, 10).play(40);
    const [strike] = struck(events);
    expect(strike).toMatchObject({ triggeredBy: 'ball-1', hitIds: ['ball-1'] });
    expect(strike?.tick).toBeLessThan(1 + FUSE);
  });

  it('are set off by a ball that crosses the body inside one tick (swept)', () => {
    // From x = 380 to 680 in one tick: 120 and 180 units from the bomb at either end, more than its
    // reach of 70, so only the swept test sees the touch.
    const bomb: ZoneState = {
      id: 'zone-0',
      ownerId: 'ball-0',
      position: { x: 500, y: 500 },
      radius: 100,
      damage: 7,
      spawnTick: 0,
      strikeTick: 100,
      trigger: { radius: 20, armTick: 1 },
    };
    const [, runner] = createWorld(1, [dropper, red]).balls;
    if (runner === undefined) throw new Error('no ball');
    const now = { ...runner, position: { x: 680, y: 500 } };
    const lookup = indexDefinitions([dropper, red]);
    const starts = new Map([[runner.id, { x: 380, y: 500 }]]);
    expect(triggeredBy(bomb, 5, [now], starts, lookup)).toBe(runner.id);
    // Standing still at either end, it never touched it.
    expect(triggeredBy(bomb, 5, [now], new Map(), lookup)).toBeUndefined();
  });

  it('wait out their fuse when nobody touches them', () => {
    const { events } = setup(red, 120, 0).play(FUSE + 2);
    expect(struck(events)).toStrictEqual([expect.objectContaining({ tick: 1 + FUSE, hitIds: [] })]);
    expect(struck(events)[0]?.triggeredBy).toBeUndefined();
  });

  it('are not set off before they arm', () => {
    // Red sits on the bomb from the start: it goes off on the arming tick, not before.
    const { events } = setup(red, 500, 0).play(ARM + 3);
    expect(struck(events)[0]).toMatchObject({ tick: 1 + ARM, triggeredBy: 'ball-1' });
  });

  it('let a phased ball pass over without going off, but still catch it at the fuse', () => {
    const { events } = setup(wisp, 400, 0).play(FUSE + 2);
    expect(struck(events)).toStrictEqual([
      expect.objectContaining({ tick: 1 + FUSE, hitIds: ['ball-1'] }),
    ]);
  });
});
