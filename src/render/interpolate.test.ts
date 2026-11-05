import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { DT } from '../sim/constants.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import { deepFreeze, red, withBalls } from '../sim/test-support.ts';
import type { ProjectileState, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { advanceFrame, interpolationAlpha, startPlayback } from '../app/playback.ts';
import type { MinionState } from '../sim/minions/types.ts';
import { interpolateWorld } from './interpolate.ts';

const shot = (id: string, x: number): ProjectileState => ({
  id,
  ownerId: 'ball-0',
  position: { x, y: 500 },
  velocity: { x: 1200, y: 0 },
  radius: 6,
  damage: 9,
  ticksLeft: 60,
});

function pair(): { before: WorldState; after: WorldState } {
  const world = createWorld(1, [red, red]);
  const before = withBalls(world, [
    { position: { x: 100, y: 200 } },
    { position: { x: 900, y: 900 } },
  ]);
  const after = withBalls({ ...before, tick: before.tick + 1 }, [
    { position: { x: 110, y: 180 } },
    { position: { x: 900, y: 900 } },
  ]);
  return { before: deepFreeze(before), after: deepFreeze(after) };
}

describe('interpolateWorld', () => {
  it('draws the previous positions at 0, the current world at 1, and blends in between', () => {
    const { before, after } = pair();
    expect(interpolateWorld(before, after, 0).balls[0]?.position).toStrictEqual({ x: 100, y: 200 });
    expect(interpolateWorld(before, after, 1)).toBe(after);
    expect(interpolateWorld(before, after, 0.25).balls[0]?.position).toStrictEqual({
      x: 102.5,
      y: 195,
    });
  });

  it('keeps everything but positions from the current world', () => {
    const { before, after } = pair();
    const hurt = deepFreeze(withBalls(after, [{ health: 3 }]));
    const drawn = interpolateWorld(before, hurt, 0.5);
    expect(drawn.balls[0]?.health).toBe(3);
    expect(drawn.balls[0]?.velocity).toStrictEqual(hurt.balls[0]?.velocity);
    expect(drawn.tick).toBe(hurt.tick);
  });

  it('clamps alpha outside 0 to 1', () => {
    const { before, after } = pair();
    expect(interpolateWorld(before, after, 3)).toBe(after);
    expect(interpolateWorld(before, after, -1).balls[0]?.position).toStrictEqual({
      x: 100,
      y: 200,
    });
  });

  it('returns the world itself when there is nothing to blend (a new match)', () => {
    const { after } = pair();
    expect(interpolateWorld(after, after, 0.4)).toBe(after);
  });

  it('traces a projectile fired this tick back to its launch point, and drops one that is gone', () => {
    const { before, after } = pair();
    const fired = deepFreeze({ ...after, projectiles: [shot('projectile-1', 520)] });
    const gone = deepFreeze({ ...before, projectiles: [shot('projectile-0', 300)] });
    const drawn = interpolateWorld(gone, fired, 0);
    expect(drawn.projectiles.map(({ id }) => id)).toStrictEqual(['projectile-1']);
    expect(drawn.projectiles[0]?.position.x).toBeCloseTo(520 - 1200 * DT, 9);
  });

  it('blends a projectile that existed on both ticks', () => {
    const { before, after } = pair();
    const drawn = interpolateWorld(
      deepFreeze({ ...before, projectiles: [shot('projectile-0', 300)] }),
      deepFreeze({ ...after, projectiles: [shot('projectile-0', 320)] }),
      0.5,
    );
    expect(drawn.projectiles[0]?.position).toStrictEqual({ x: 310, y: 500 });
  });

  it('blends a minion that existed on both ticks, and traces a new one back', () => {
    const minion = (id: string, x: number): MinionState => ({
      id,
      ownerId: 'ball-0',
      position: { x, y: 400 },
      velocity: { x: 600, y: 0 },
      radius: 26,
      damage: 13,
      ticksLeft: 300,
    });
    const { before, after } = pair();
    const drawn = interpolateWorld(
      deepFreeze({ ...before, minions: [minion('minion-0', 300)] }),
      deepFreeze({ ...after, minions: [minion('minion-0', 310), minion('minion-1', 700)] }),
      0.5,
    );
    expect(drawn.minions[0]?.position).toStrictEqual({ x: 305, y: 400 });
    expect(drawn.minions[1]?.position.x).toBeCloseTo(700 - 600 * DT * 0.5, 9);
  });

  // The lag seen on phones with batch 3: minions were drawn at the latest tick while the balls
  // glided between ticks, so on a 120 Hz screen a minion stood still every other frame (50% of
  // frames; 33% at 90 Hz).
  it('moves a minion on every frame of a 120 Hz screen, as smoothly as the balls', () => {
    let playback = startPlayback(
      createWorld(7, [
        getDefinition(BALL_LOOKUP, 'necromancer'),
        getDefinition(BALL_LOOKUP, 'archer'),
      ]),
      0,
    );
    let last: WorldState | undefined;
    let frames = 0;
    let still = 0;
    for (let frame = 0; frame < 120 * 15 && playback.world.match.status === 'running'; frame++) {
      playback = advanceFrame(
        playback,
        1000 / 120,
        (world) => step(world, BALL_LOOKUP),
        () => ({ hitStopMs: 0 }),
      ).playback;
      const drawn = interpolateWorld(
        playback.previous,
        playback.world,
        interpolationAlpha(playback),
      );
      const now = drawn.minions[0];
      const then = last?.minions.find((minion) => minion.id === now?.id);
      if (now !== undefined && then !== undefined) {
        frames += 1;
        if (now.position.x === then.position.x && now.position.y === then.position.y) still += 1;
      }
      last = drawn;
    }
    expect(frames).toBeGreaterThan(200);
    expect(still).toBe(0);
  });

  it('keeps every blended ball inside the arena over a whole match', () => {
    let world = createWorld(7, [
      getDefinition(BALL_LOOKUP, 'speedster'),
      getDefinition(BALL_LOOKUP, 'archer'),
    ]);
    let checked = 0;
    while (world.match.status === 'running') {
      const next = step(world, BALL_LOOKUP).world;
      for (const alpha of [0.25, 0.5, 0.75]) {
        for (const ball of interpolateWorld(world, next, alpha).balls) {
          const { x, y } = ball.position;
          const r = ball.radius;
          expect(x >= r - 1e-9 && x <= world.arena.size - r + 1e-9).toBe(true);
          expect(y >= r - 1e-9 && y <= world.arena.size - r + 1e-9).toBe(true);
          checked++;
        }
      }
      world = next;
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
