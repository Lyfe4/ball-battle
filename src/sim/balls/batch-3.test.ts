// The Magnet, Ghost and Necromancer (ADR 0026): each ball's own mechanic, on fixed scenes.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { ghost, FIRST_PHASE_TICK, PHASE_TICKS, SOLID_TICKS, SPECTRAL_DAMAGE } from './ghost.ts';
import { FIRST_PULL_TICK, isPulling, magnet, PULL_PERIOD_TICKS, PULL_TICKS } from './magnet.ts';
import {
  FIRST_SUMMON_TICK,
  MAX_MINIONS,
  MINION_DAMAGE,
  MINION_RADIUS,
  necromancer,
  SUMMON_TICKS,
} from './necromancer.ts';

const lookup = indexDefinitions([magnet, ghost, necromancer, blue]);

function play(world: WorldState, ticks: number, onTick?: (world: WorldState) => void) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

const speed = ({ x, y }: { x: number; y: number }) => Math.sqrt(x * x + y * y);

describe('Magnet', () => {
  /** The Magnet along the top, blue far below it heading right: they never meet, nor hit a wall. */
  const scene = (): WorldState =>
    withBalls(createWorld(1, [magnet, blue]), [
      { position: { x: 500, y: 100 }, velocity: { x: 1, y: 0 } },
      { position: { x: 100, y: 850 }, velocity: { x: blue.speed, y: 0 }, health: 10_000 },
    ]);

  it('turns its enemy toward itself while pulling, and only changes direction, not speed', () => {
    const before = play(scene(), FIRST_PULL_TICK - 1).world.balls[1];
    const after = play(scene(), FIRST_PULL_TICK + 10).world.balls[1];
    // Heading right before the pull; turned up toward the Magnet after it.
    expect(before?.velocity.y).toBeCloseTo(0, 6);
    expect(after?.velocity.y).toBeLessThan(0);
    expect(speed(after?.velocity ?? { x: 0, y: 0 })).toBeCloseTo(blue.speed, 6);
  });

  it('pulls for PULL_TICKS, then lets go until the next pull', () => {
    const pulling: number[] = [];
    play(scene(), FIRST_PULL_TICK + PULL_PERIOD_TICKS + 5, (world) => {
      const self = world.balls[0];
      if (self !== undefined && isPulling(self, world.tick)) pulling.push(world.tick);
    });
    const first = Array.from({ length: PULL_TICKS }, (_, i) => FIRST_PULL_TICK + i);
    const second = FIRST_PULL_TICK + PULL_PERIOD_TICKS;
    expect(pulling).toStrictEqual([...first, ...[0, 1, 2, 3, 4, 5].map((i) => second + i)]);
  });
});

describe('Ghost', () => {
  it('phases for PHASE_TICKS of every PHASE_TICKS + SOLID_TICKS', () => {
    const phasedTicks: number[] = [];
    const world = withBalls(createWorld(1, [ghost, blue]), [
      { position: { x: 200, y: 200 } },
      { position: { x: 800, y: 800 }, health: 10_000 },
    ]);
    play(world, FIRST_PHASE_TICK + PHASE_TICKS + SOLID_TICKS + 5, (current) => {
      const self = current.balls[0];
      if (self !== undefined && ghost.phasedOf?.(self) === true) phasedTicks.push(current.tick);
    });
    expect(phasedTicks[0]).toBe(FIRST_PHASE_TICK);
    expect(phasedTicks).toContain(FIRST_PHASE_TICK + PHASE_TICKS - 1);
    expect(phasedTicks).not.toContain(FIRST_PHASE_TICK + PHASE_TICKS);
    expect(phasedTicks).toContain(FIRST_PHASE_TICK + PHASE_TICKS + SOLID_TICKS);
  });

  /** A phased Ghost and blue heading straight at each other. */
  const meeting = (phased: boolean): WorldState =>
    withBalls(createWorld(1, [ghost, blue]), [
      {
        position: { x: 300, y: 500 },
        velocity: { x: ghost.speed, y: 0 },
        abilityState: { phased, nextChangeTick: 10_000 },
      },
      { position: { x: 700, y: 500 }, velocity: { x: -blue.speed, y: 0 } },
    ]);

  it('passing through an enemy while phased deals only its spectral hit, and takes nothing', () => {
    const { world, events } = play(meeting(true), 40);
    const damage = events.filter((event) => event.type === 'damage');
    expect(damage).toStrictEqual([
      expect.objectContaining({ targetId: 'ball-1', cause: 'ability', amount: SPECTRAL_DAMAGE }),
    ]);
    expect(world.balls[0]?.health).toBe(ghost.maxHealth);
  });

  it('fights by contact like any ball while solid', () => {
    const { events } = play(meeting(false), 40);
    const causes = events.flatMap((event) => (event.type === 'damage' ? [event.cause] : []));
    expect(causes).toStrictEqual(['contact', 'contact']);
  });
});

describe('Necromancer', () => {
  const scene = (): WorldState =>
    withBalls(createWorld(3, [necromancer, blue]), [
      { position: { x: 500, y: 500 } },
      { position: { x: 900, y: 900 }, velocity: { x: 0, y: 0 }, health: 10_000 },
    ]);

  it('summons a minion every SUMMON_TICKS, starting at FIRST_SUMMON_TICK', () => {
    const { events } = play(scene(), FIRST_SUMMON_TICK + 2 * SUMMON_TICKS);
    const spawns = events.filter((event) => event.type === 'minionSpawned');
    expect(spawns[0]?.tick).toBe(FIRST_SUMMON_TICK);
    for (const spawn of spawns.slice(1))
      expect((spawn.tick - FIRST_SUMMON_TICK) % SUMMON_TICKS).toBe(0);
  });

  it('never has more than MAX_MINIONS minions at once', () => {
    let most = 0;
    play(scene(), 1200, (world) => {
      most = Math.max(most, world.minions.length);
    });
    expect(most).toBe(MAX_MINIONS);
  });

  it('summons minions of the designed size and damage, which pop on its enemy', () => {
    const { events } = play(scene(), 1200);
    const spawned = events.find((event) => event.type === 'minionSpawned');
    expect(spawned).toBeDefined();
    const hits = events.filter((event) => event.type === 'minionHit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({ targetId: 'ball-1', amount: MINION_DAMAGE });
    expect(MINION_RADIUS).toBeLessThan(necromancer.radius);
  });
});
