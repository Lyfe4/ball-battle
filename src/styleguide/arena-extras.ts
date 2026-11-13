// Extras for the style guide's phone arena (ADR 0034): a burning patch behind the Inferno, just
// after a burn, and the Chrono's rewind trail, to check both read at phone size.
import { PATCH_RADIUS } from '../sim/balls/inferno.ts';
import { BLAST_RADIUS, BOMB_RADIUS, FUSE_TICKS } from '../sim/balls/bomber.ts';
import { BOOMERANG_RADIUS } from '../sim/balls/boomerang.ts';
import { SPEAR_RADIUS } from '../sim/balls/spartan.ts';
import { CURSE_FUSE_TICKS } from '../sim/balls/hex.ts';
import { WEB_TICKS } from '../sim/balls/spider.ts';
import type { BallState, ProjectileState, ZoneState } from '../sim/types.ts';
import type { RewindTrail } from '../render/rewind.ts';
import { TICK } from './tick.ts';

export function batchFourExtras(balls: readonly BallState[]): {
  readonly zones: readonly ZoneState[];
  readonly rewinds: readonly RewindTrail[];
} {
  const burner = balls.find((ball) => ball.definitionId === 'inferno');
  const zones =
    burner === undefined
      ? []
      : [
          {
            id: 'zone-0',
            ownerId: burner.id,
            position: { x: burner.position.x - 100, y: burner.position.y },
            radius: PATCH_RADIUS,
            damage: 0,
            spawnTick: TICK - 30,
            strikeTick: TICK - 2,
            endTick: TICK + 80,
            pulseEveryTicks: 15,
          },
        ];
  const rewinder = balls.find((ball) => ball.definitionId === 'chrono');
  const rewinds =
    rewinder === undefined
      ? []
      : [
          {
            ballId: rewinder.id,
            from: { x: rewinder.position.x + 90, y: rewinder.position.y + 60 },
            to: rewinder.position,
            strength: 0.8,
          },
        ];
  return { zones, rewinds };
}

/**
 * Batch 5 in the phone arena (ADR 0043): a bomb lying beside the Bomber, part-way down its fuse, a
 * boomerang in flight beside the Boomerang, a spear just thrown by the Spartan (open, its shield
 * arc gone), and a hit glancing off the phased Ghost (ADR 0047, 0049).
 */
export function batchFiveExtras(balls: readonly BallState[]): {
  readonly zones: readonly ZoneState[];
  readonly projectiles: readonly ProjectileState[];
  readonly glancedId: string | undefined;
} {
  const bomber = balls.find((ball) => ball.definitionId === 'bomber');
  const zones: ZoneState[] =
    bomber === undefined
      ? []
      : [
          {
            id: 'zone-1',
            ownerId: bomber.id,
            position: { x: bomber.position.x, y: bomber.position.y + 95 },
            radius: BLAST_RADIUS,
            damage: 0,
            spawnTick: TICK - 80,
            strikeTick: TICK - 80 + FUSE_TICKS,
            trigger: { radius: BOMB_RADIUS, armTick: TICK - 60 },
          },
        ];
  const thrower = balls.find((ball) => ball.definitionId === 'boomerang');
  const projectiles: ProjectileState[] =
    thrower === undefined
      ? []
      : [
          {
            id: 'projectile-0',
            ownerId: thrower.id,
            position: { x: thrower.position.x + 85, y: thrower.position.y - 40 },
            velocity: { x: 1, y: 0 },
            radius: BOOMERANG_RADIUS,
            damage: 0,
            ticksLeft: 1,
            returning: { turnTick: TICK, back: true, hitIds: [] },
          },
        ];
  const spartan = balls.find((ball) => ball.definitionId === 'spartan');
  if (spartan !== undefined) {
    projectiles.push({
      id: 'projectile-1',
      ownerId: spartan.id,
      position: { x: spartan.position.x - 110, y: spartan.position.y + 20 },
      velocity: { x: -1, y: 0.2 },
      radius: SPEAR_RADIUS,
      damage: 0,
      ticksLeft: 1,
    });
  }
  return {
    zones,
    projectiles,
    glancedId: balls.find((ball) => ball.definitionId === 'ghost')?.id,
  };
}

/**
 * The Hex and the Spider in the phone arena (ADR 0049): the Hex's curse on the ball before it in the
 * grid, half-way down its fuse, and two of the Spider's webs, one fresh on the floor under it and one
 * fading on the left wall.
 */
export function batchSixState(ball: BallState, balls: readonly BallState[]): BallState {
  if (ball.definitionId === 'hex') {
    const index = balls.indexOf(ball);
    const cursed = balls[index - 1];
    if (cursed === undefined) return ball;
    const half = CURSE_FUSE_TICKS / 2;
    return {
      ...ball,
      abilityState: { cursedId: cursed.id, cursedTick: TICK - half, burstTick: TICK + half },
    };
  }
  if (ball.definitionId === 'spider') {
    const webs = [
      { side: 0, at: 700, since: TICK - WEB_TICKS + 60, until: TICK + 45 },
      { side: 3, at: ball.position.x, since: TICK - 30, until: TICK - 30 + WEB_TICKS },
    ];
    return { ...ball, abilityState: { webs, caught: {} } };
  }
  return ball;
}
