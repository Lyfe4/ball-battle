// Shields (ADR 0043): a `shielded` ball's next hit, of any kind, goes into its shield first. The
// shield soaks up to SHIELD_SOAK of it (a small hit whole) and breaks.
import { describe, expect, it } from 'vitest';
import { applyActions, sceneOf } from './abilities/apply-actions.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import { isShielded, SHIELD_SOAK, SHIELD_TICKS } from './shield.ts';
import type { StatusState } from './status.ts';
import { step } from './step.ts';
import { blue, red, run, testDefinitions, withBalls } from './test-support.ts';
import type { SimEvent, WorldState } from './types.ts';
import { createWorld } from './world.ts';

const SHIELD: StatusState = {
  kind: 'shielded',
  sourceId: 'ball-0',
  expiresTick: SHIELD_TICKS,
  sinceTick: 0,
};

/** Red (shielded unless told otherwise) and Blue charging straight at each other. */
function headOn(shieldRed = true): WorldState {
  return withBalls(createWorld(1, testDefinitions), [
    {
      position: { x: 400, y: 500 },
      velocity: { x: red.speed, y: 0 },
      statuses: shieldRed ? [SHIELD] : [],
    },
    { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
  ]);
}

const ofType = <T extends SimEvent['type']>(events: readonly SimEvent[], type: T) =>
  events.filter((event): event is Extract<SimEvent, { type: T }> => event.type === type);

const lookup = indexDefinitions(testDefinitions);

describe('shields', () => {
  it('soak part of a big contact hit, and break', () => {
    expect(blue.contactDamage).toBeGreaterThan(SHIELD_SOAK);
    const { world, events } = run(headOn(), 30);
    const [red0, blue0] = world.balls;
    expect(red0?.health).toBe(red.maxHealth - (blue.contactDamage - SHIELD_SOAK));
    expect(blue0?.health).toBe(blue.maxHealth - red.contactDamage);
    expect(ofType(events, 'shieldBroken')).toStrictEqual([
      expect.objectContaining({ ballId: 'ball-0', sourceId: 'ball-1', soaked: SHIELD_SOAK }),
    ]);
    expect(red0 === undefined ? true : isShielded(red0)).toBe(false);
  });

  it('let the whole hit land without one', () => {
    const { world, events } = run(headOn(false), 30);
    expect(world.balls[0]?.health).toBe(red.maxHealth - blue.contactDamage);
    expect(ofType(events, 'shieldBroken')).toStrictEqual([]);
  });

  it('block a small hit whole, then let the next one land', () => {
    const scene = sceneOf(headOn().balls);
    const hit = { kind: 'damage', targetId: 'ball-0', amount: SHIELD_SOAK - 2 } as const;
    const first = applyActions(scene, 'ball-1', [hit], lookup, 3, 1000);
    expect(first.balls[0]?.health).toBe(red.maxHealth);
    expect(first.events).toStrictEqual([
      {
        type: 'shieldBroken',
        tick: 3,
        ballId: 'ball-0',
        sourceId: 'ball-1',
        soaked: SHIELD_SOAK - 2,
      },
    ]);
    const second = applyActions(first, 'ball-1', [hit], lookup, 3, 1000);
    expect(second.balls[0]?.health).toBe(red.maxHealth - (SHIELD_SOAK - 2));
    expect(second.events.map((event) => event.type)).toStrictEqual(['damage']);
  });

  it('soak part of a big ability hit, reporting only what lands as damage', () => {
    const scene = sceneOf(headOn().balls);
    const hit = { kind: 'damage', targetId: 'ball-0', amount: 20 } as const;
    const { balls, events } = applyActions(scene, 'ball-1', [hit], lookup, 3, 1000);
    expect(balls[0]?.health).toBe(red.maxHealth - (20 - SHIELD_SOAK));
    expect(events).toStrictEqual([
      expect.objectContaining({ type: 'shieldBroken', soaked: SHIELD_SOAK }),
      expect.objectContaining({ type: 'damage', amount: 20 - SHIELD_SOAK }),
    ]);
  });

  it('take a small strike whole, and the strike’s status with it', () => {
    const striker = defineBall({
      id: 'striker',
      name: 'Striker',
      description: 'Test fixture: one zone on tick 1.',
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
                  damage: SHIELD_SOAK,
                  delayTicks: 1,
                  status: { kind: 'slowed', durationTicks: 60 },
                },
              ]
            : [],
      },
    });
    const strikeLookup = indexDefinitions([striker, red]);
    let world = withBalls(createWorld(1, [striker, red]), [
      { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      { position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 }, statuses: [SHIELD] },
    ]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const result = step(world, strikeLookup);
      world = result.world;
      events.push(...result.events);
    }
    expect(world.balls[1]?.health).toBe(red.maxHealth);
    expect(world.balls[1]?.statuses).toStrictEqual([]);
    expect(ofType(events, 'shieldBroken')).toHaveLength(1);
    expect(ofType(events, 'zoneStruck')[0]?.hitIds).toStrictEqual([]);
  });

  it('judge a lethal exchange on what is left of the hit', () => {
    // Unshielded, both hits are lethal and Blue's harder hit wins the tiebreak. Shielded, Red takes
    // only what is left of Blue's hit, less than its 10 health, so only Blue is knocked out.
    const low = (shield: boolean) => withBalls(headOn(shield), [{ health: 10 }, { health: 1 }]);
    expect(run(low(false), 30).world.balls.map((ball) => ball.health)).toStrictEqual([0, 1]);
    const left = 10 - (blue.contactDamage - SHIELD_SOAK);
    expect(left).toBeGreaterThan(0);
    expect(run(low(true), 30).world.balls.map((ball) => ball.health)).toStrictEqual([left, 0]);
  });
});
