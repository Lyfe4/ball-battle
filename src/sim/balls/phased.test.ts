// The phasing rule (ADR 0026, extended by ADR 0028): a phased ball can't be touched, gripped or
// aimed at. Hits and skull pops pass through it, the Magnet's pull slips, and an aimed attack
// waits for it to turn solid.
import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import type { MinionState } from '../minions/types.ts';
import { step } from '../step.ts';
import { withBalls } from '../test-support.ts';
import type { BallDefinition, SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer, FIRST_SHOT_DELAY_TICKS } from './archer.ts';
import { ghost, type GhostState } from './ghost.ts';
import { magnet } from './magnet.ts';
import { necromancer } from './necromancer.ts';

function play(
  world: WorldState,
  definitions: readonly BallDefinition[],
  ticks: number,
): { world: WorldState; events: SimEvent[] } {
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

/** A Ghost held phased (or solid) until `until`. */
const ghostState = (phased: boolean, until = 10_000): GhostState => ({
  phased,
  nextChangeTick: until,
});

describe('a phased ball', () => {
  it('lets a skull pass through it; a solid one takes the pop', () => {
    const skull = (x: number): MinionState => ({
      id: 'minion-0',
      ownerId: 'ball-0',
      position: { x, y: 500 },
      velocity: { x: 12 / DT, y: 0 },
      radius: 26,
      damage: 13,
      ticksLeft: 100,
    });
    const scene = (phased: boolean): WorldState => ({
      ...withBalls(createWorld(1, [necromancer, ghost]), [
        { position: { x: 120, y: 120 }, velocity: { x: 0, y: 0 } },
        {
          position: { x: 600, y: 500 },
          velocity: { x: 0, y: 0 },
          abilityState: ghostState(phased),
        },
      ]),
      minions: [skull(400)],
      nextMinionId: 1,
    });
    const pops = (phased: boolean) =>
      play(scene(phased), [necromancer, ghost], 30).events.filter(
        (event) => event.type === 'minionHit',
      );
    expect(pops(false)).toHaveLength(1);
    expect(pops(true)).toStrictEqual([]);
  });

  it('is never aimed at: the Archer holds its arrow until the Ghost turns solid', () => {
    const scene = (abilityState: GhostState): WorldState =>
      withBalls(createWorld(1, [archer, ghost]), [
        { position: { x: 200, y: 500 }, velocity: { x: 0, y: 0 } },
        { position: { x: 800, y: 500 }, velocity: { x: 0, y: 0 }, abilityState },
      ]);
    const firstShot = (abilityState: GhostState) =>
      play(scene(abilityState), [archer, ghost], 150).events.find(
        (event) => event.type === 'projectileFired',
      )?.tick;
    expect(firstShot(ghostState(false))).toBe(FIRST_SHOT_DELAY_TICKS);
    // Phased until tick 100: the due arrow waits for it.
    expect(firstShot(ghostState(true, 100))).toBeGreaterThanOrEqual(100);
  });

  it('slips the Magnet’s pull: its heading never turns toward the Magnet', () => {
    const heading = (phased: boolean): Vec2 => {
      const start = withBalls(createWorld(1, [magnet, ghost]), [
        {
          position: { x: 700, y: 850 },
          velocity: { x: -magnet.speed, y: 0 },
          abilityState: { nextPullTick: 0, pullUntilTick: 0 },
        },
        {
          position: { x: 250, y: 150 },
          velocity: { x: ghost.speed, y: 0 },
          abilityState: ghostState(phased),
        },
      ]);
      const after = play(start, [magnet, ghost], 20).world.balls[1];
      if (after === undefined) throw new Error('expected the Ghost');
      return after.velocity;
    };
    // Pulled while solid: it turns down toward the Magnet. Phased: it keeps its line.
    expect(heading(false).y).toBeGreaterThan(0);
    expect(heading(true).y).toBe(0);
  });
});
