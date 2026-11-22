// Projectiles on a real canvas: one in flight is drawn; once the match is over none is (2026-11-23
// walk: a loser's boomerang hung frozen over the dimmed round between rounds).
import { describe, expect, it } from 'vitest';
import { deepFreeze, red, testLookup } from '../sim/test-support.ts';
import type { ProjectileState, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { drawProjectiles } from './projectiles.ts';

const shot: ProjectileState = {
  id: 'projectile-0',
  ownerId: 'ball-1',
  position: { x: 50, y: 50 },
  velocity: { x: 600, y: 0 },
  radius: 6,
  damage: 9,
  ticksLeft: 60,
};

/** How many of the canvas's pixels `draw` paints, on a fresh 100 x 100 canvas. */
function paintedBy(draw: (ctx: CanvasRenderingContext2D) => void): number {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('no 2d context');
  draw(ctx);
  const { data } = ctx.getImageData(0, 0, 100, 100);
  let painted = 0;
  for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) painted += 1;
  return painted;
}

describe('drawProjectiles', () => {
  const world = createWorld(1, [red, red]);
  const flying: WorldState = deepFreeze({ ...world, projectiles: [shot] });

  it('draws a projectile in flight', () => {
    expect(
      paintedBy((ctx) => {
        drawProjectiles(ctx, flying, testLookup);
      }),
    ).toBeGreaterThan(0);
  });

  it('draws nothing once the match is over: nothing hangs in the air after the knockout', () => {
    const over: WorldState = deepFreeze({
      ...flying,
      match: {
        status: 'finished',
        result: { kind: 'win', winnerId: 'ball-0' },
        reason: 'knockout',
        endTick: 1,
      },
    });
    expect(
      paintedBy((ctx) => {
        drawProjectiles(ctx, over, testLookup);
      }),
    ).toBe(0);
  });
});
