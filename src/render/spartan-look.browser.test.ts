// The Spartan's look in a real canvas (`pnpm test:browsers`), at phone and desktop size: an upright
// crested helmet in profile looking at the enemy, its crest past the ball's edge, a thick shield arc
// clear of the helmet on the side facing the enemy only while planted, and the spear drawn only in
// flight. Read from pixels, so
// it checks what a player sees in every engine, not which canvas calls ran.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { spartan } from '../sim/balls/spartan.ts';
import { vampire } from '../sim/balls/vampire.ts';
import type { BallState, ProjectileState, Vec2, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { drawBall } from './draw.ts';
import { drawProjectiles } from './projectiles.ts';
import { theme } from './theme.ts';

const SIZES = [
  ['phone', 0.34],
  ['desktop', 0.8],
] as const;
const AT: Vec2 = { x: 500, y: 500 };

function rgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Draws one scene and reads the colour at world points. */
function scene(scale: number, raised: boolean, enemy: { x: number; y: number }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(1000 * scale);
  canvas.height = Math.round(1000 * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('no 2D context');
  ctx.fillStyle = theme.arenaFill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const world = createWorld(0, [spartan, vampire]);
  const [self, other] = world.balls as readonly [BallState, BallState];
  const me: BallState = {
    ...self,
    position: AT,
    abilityState: { phase: 0, raised },
  };
  const them: BallState = { ...other, position: enemy };
  const spear: ProjectileState = {
    id: 'projectile-0',
    ownerId: me.id,
    position: { x: 500, y: 150 },
    velocity: { x: 1500, y: 0 },
    radius: 9,
    damage: 0,
    ticksLeft: 1,
  };
  const scene: WorldState = { ...world, balls: [me, them], projectiles: [spear] };
  drawProjectiles(ctx, scene, BALL_LOOKUP);
  drawBall(ctx, scene, me, {
    color: spartan.color,
    isRepeat: false,
    flash: 0,
    heal: 0,
    design: BALL_DESIGNS.get('spartan'),
    cssPixelsPerUnit: scale,
  });
  const r = me.radius;
  /** True when the pixel at (dx, dy) radii from the Spartan (or a world point) is `hex`. */
  return (hex: string, dx: number, dy: number, origin = AT): boolean => {
    const [x, y] = [(origin.x + dx * r) * scale, (origin.y + dy * r) * scale];
    const data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const want = rgb(hex);
    return want.every((channel, i) => Math.abs(channel - (data[i] ?? -999)) <= 40);
  };
}

describe.each(SIZES)("the Spartan's look at %s size", (_size, scale) => {
  const dark = theme.ballAccents['spartan'] ?? '';

  it('wears an upright crested helmet that looks at the enemy', () => {
    for (const [enemy, side] of [
      [{ x: 900, y: 500 }, 1],
      [{ x: 500, y: 900 }, 1],
      [{ x: 100, y: 500 }, -1],
    ] as const) {
      const at = scene(scale, false, enemy);
      expect(at(theme.spartanCrest, 0, -0.6), 'the crest over the top').toBe(true);
      expect(at(dark, 0, -1.07), 'the crest stands past the edge').toBe(true);
      expect(at(dark, 0.45 * side, -0.05), 'the eye, towards the enemy').toBe(true);
      expect(at(theme.spartanBronze, -0.25 * side, 0.2), 'the bronze helmet').toBe(true);
    }
  });

  it('holds a thick shield arc towards the enemy only while planted, clear of the helmet', () => {
    const right = scene(scale, true, { x: 900, y: 500 });
    expect(right(theme.spartanBronze, 0.83, 0), 'the arc facing the enemy').toBe(true);
    expect(right(theme.spartanBronze, 0.62, 0), 'a gap between arc and helmet').toBe(false);
    expect(right(spartan.color, -0.83, 0.2), 'no arc behind it').toBe(true);
    const left = scene(scale, true, { x: 100, y: 500 });
    expect(left(theme.spartanBronze, -0.83, 0), 'the arc follows the enemy').toBe(true);
    const open = scene(scale, false, { x: 900, y: 500 });
    expect(open(spartan.color, 0.83, 0), 'open: no arc').toBe(true);
  });

  it('draws its spear in flight, a bronze head on a bronze shaft', () => {
    const at = scene(scale, true, { x: 900, y: 500 });
    const spear = { x: 500, y: 150 };
    expect(at(theme.spartanBronze, 0.24, 0, spear), 'the head').toBe(true);
    expect(at(theme.spartanBronze, -1.2, 0, spear), 'the shaft').toBe(true);
  });
});
