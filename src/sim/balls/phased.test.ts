// The phasing rule (ADR 0026, made one rule by ADR 0049): nothing touches a phased ball. Balls,
// shots and skull pops pass through it; it is still aimed at and pulled like any ball. A test-only
// ball phases on demand here; the Ghost's own rhythm is in batch-6.test.ts.
import { describe, expect, it } from 'vitest';
import { DT, STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import type { MinionState } from '../minions/types.ts';
import { step } from '../step.ts';
import { withBalls } from '../test-support.ts';
import type { BallDefinition, SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer, FIRST_SHOT_DELAY_TICKS } from './archer.ts';
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

type PhaserState = Readonly<{ phased: boolean; nextChangeTick: number }>;

/**
 * A test-only ball, phased until its change tick, so a test can hold it phased or solid.
 */
const phaser = defineBall<PhaserState>({
  id: 'phaser',
  name: 'Phaser',
  description: '',
  color: '#c4b5fd',
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 77,
  contactDamage: 20,
  initialAbilityState: { phased: false, nextChangeTick: 0 },
  phasedOf: (self) => self.abilityState.phased,
  hooks: {
    // Turns solid on its change tick and stays solid.
    onTick: ({ world, self }) =>
      self.abilityState.phased && world.tick >= self.abilityState.nextChangeTick
        ? [{ kind: 'setAbilityState', state: { phased: false, nextChangeTick: 0 } }]
        : [],
  },
});

/** The phaser held phased (or solid) until `until`. */
const phaserState = (phased: boolean, until = 10_000): PhaserState => ({
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
      ...withBalls(createWorld(1, [necromancer, phaser]), [
        { position: { x: 120, y: 120 }, velocity: { x: 0, y: 0 } },
        {
          position: { x: 600, y: 500 },
          velocity: { x: 0, y: 0 },
          abilityState: phaserState(phased),
        },
      ]),
      minions: [skull(400)],
      nextMinionId: 1,
    });
    const pops = (phased: boolean) =>
      play(scene(phased), [necromancer, phaser], 30).events.filter(
        (event) => event.type === 'minionHit',
      );
    expect(pops(false)).toHaveLength(1);
    expect(pops(true)).toStrictEqual([]);
  });

  it('is aimed at like any ball, and the arrow flies through it while it is phased', () => {
    const scene = (abilityState: PhaserState): WorldState =>
      withBalls(createWorld(1, [archer, phaser]), [
        { position: { x: 200, y: 500 }, velocity: { x: 0, y: 0 } },
        { position: { x: 800, y: 500 }, velocity: { x: 0, y: 0 }, abilityState },
      ]);
    const shot = (abilityState: PhaserState) => {
      const { events } = play(scene(abilityState), [archer, phaser], FIRST_SHOT_DELAY_TICKS + 60);
      return {
        fired: events.find((event) => event.type === 'projectileFired')?.tick,
        hits: events.filter((event) => event.type === 'damage' && event.targetId === 'ball-1'),
      };
    };
    // Shot on time either way (ADR 0049): no waiting for it to turn solid.
    expect(shot(phaserState(false)).fired).toBe(FIRST_SHOT_DELAY_TICKS);
    expect(shot(phaserState(true)).fired).toBe(FIRST_SHOT_DELAY_TICKS);
    expect(shot(phaserState(false)).hits).toHaveLength(1);
    expect(shot(phaserState(true)).hits).toStrictEqual([]);
  });

  it('is pulled by the Magnet like any ball: its heading turns toward the Magnet', () => {
    const heading = (phased: boolean): Vec2 => {
      const start = withBalls(createWorld(1, [magnet, phaser]), [
        {
          position: { x: 700, y: 850 },
          velocity: { x: -magnet.speed, y: 0 },
          abilityState: { nextPullTick: 0, pullUntilTick: 0 },
        },
        {
          position: { x: 250, y: 150 },
          velocity: { x: phaser.speed, y: 0 },
          abilityState: phaserState(phased),
        },
      ]);
      const after = play(start, [magnet, phaser], 20).world.balls[1];
      if (after === undefined) throw new Error('expected the phased ball');
      return after.velocity;
    };
    // Turned down toward the Magnet, solid or phased (ADR 0049): one rule for every ball.
    expect(heading(false).y).toBeGreaterThan(0);
    expect(heading(true).y).toBeGreaterThan(0);
  });
});
