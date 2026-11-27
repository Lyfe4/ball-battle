import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import { hasStatus } from '../status.ts';
import type { AbilityAction, BallState, Vec2 } from '../types.ts';
import { secondsOf } from './how-it-works.ts';

export type MedusaState = Readonly<{
  /** The tick her gaze is ready again. */
  nextGazeTick: number;
  /** While her eyes glow (she has seen someone), the tick she glares; -1 otherwise. */
  glareTick: number;
  /** The tick she last glared, and which way (drawn as a flash of her gaze); -1 before the first. */
  lastGlareTick: number;
  glareDx: number;
  glareDy: number;
}>;

/** Her gaze is first ready 2 s in. */
export const FIRST_GAZE_TICK = 120;
/** Ticks from one glare until her gaze is ready again. */
export const GAZE_EVERY_TICKS = 240;
/** From seeing a ball in her gaze to the glare: a ball that crosses it fast is gone by then. */
export const GLARE_WINDUP_TICKS = 15;
/** World units: how far her gaze reaches along her heading. */
export const GAZE_RANGE = 520;
/** How fast her gaze cone widens: its half-width per unit along it (about 22 degrees, no trig). */
export const GAZE_SPREAD = 0.4;
/** How long a ball her glare lands on stays stone. */
export const STONE_TICKS = 60;
/** How many times her bump lands on a ball of stone: it shatters. */
export const SHATTER_TIMES = 4.5;

const SPEED = 760;
const BUMP = 12.5;

/** A Medusa's state, read from any ball state (undefined for other balls). */
export function medusaStateOf(ball: BallState): MedusaState | undefined {
  const { nextGazeTick, glareTick, lastGlareTick, glareDx, glareDy } = ball.abilityState;
  const numbers = [nextGazeTick, glareTick, lastGlareTick, glareDx, glareDy];
  if (!numbers.every((value) => typeof value === 'number')) return undefined;
  return ball.abilityState as MedusaState;
}

/** What her gaze falls on first, if anything: a ball, or the copy of one (the Mirage's). */
export type GazeHit = Readonly<{ ball: BallState; copy: boolean; along: number }>;

/**
 * The first thing her gaze falls on, looking from her centre along the unit `heading`: an enemy
 * ball, or a copy of one where aimed attacks would aim (`aimPointOf`: the Mirage's copy while it
 * shows), whichever is nearer along her gaze. A phased ball is looked straight through. A thing is in
 * her gaze when it is ahead, within GAZE_RANGE, and its edge reaches inside the cone. Ties go to the
 * ball, then the earlier one.
 */
export function firstInGaze(
  self: BallState,
  heading: Vec2,
  balls: readonly BallState[],
  isPhased: (ball: BallState) => boolean,
  aimPointOf: (ball: BallState) => Vec2,
): GazeHit | undefined {
  let first: GazeHit | undefined;
  const consider = (ball: BallState, at: Vec2, copy: boolean): void => {
    const dx = at.x - self.position.x;
    const dy = at.y - self.position.y;
    const along = dx * heading.x + dy * heading.y;
    if (along <= 0 || along > GAZE_RANGE + ball.radius) return;
    const across = Math.abs(dx * heading.y - dy * heading.x);
    if (across > along * GAZE_SPREAD + ball.radius) return;
    if (first === undefined || along < first.along) first = { ball, copy, along };
  };
  for (const ball of balls) {
    if (sideOf(ball) === sideOf(self) || ball.health <= 0 || isPhased(ball)) continue;
    consider(ball, ball.position, false);
    const seen = aimPointOf(ball);
    if (seen.x !== ball.position.x || seen.y !== ball.position.y) consider(ball, seen, true);
  }
  return first;
}

function headingOf(ball: BallState): Vec2 | undefined {
  const { x, y } = ball.velocity;
  const speed = Math.sqrt(x * x + y * y);
  return speed === 0 ? undefined : { x: x / speed, y: y / speed };
}

/**
 * Stone gaze (prototype): when her gaze is ready and she sees an enemy ball ahead of her (a cone
 * along her heading), her eyes glow, and GLARE_WINDUP_TICKS later she glares the way she then
 * faces. The first ball in her gaze turns to stone for STONE_TICKS: it all but stops (the `stoned`
 * status). Her bump on a ball of stone shatters it for SHATTER_TIMES her bump (`contactDamageOf`
 * reads it) and ends the stone; a ball she doesn't reach in time walks away unhurt. Her gaze passes
 * through a phased ball, and a copy (the Mirage's) nearer in her gaze than its ball takes the glare.
 */
export const medusa = defineBall<MedusaState>({
  id: 'medusa',
  name: 'Medusa',
  description: 'Her glare turns a ball to stone; her bump shatters it.',
  color: '#6fa58a',
  ability: { name: 'Stone gaze', shownBy: { kind: 'status', status: 'stoned' }, tipOn: 'struck' },
  howItWorks: [
    `Every ${secondsOf(GAZE_EVERY_TICKS)} s she glares at a ball ahead of her; it turns to stone for ${secondsOf(STONE_TICKS)} s.`,
    `Her bump on a ball of stone shatters it: ${String(SHATTER_TIMES)} times her bump.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: SPEED,
  maxHealth: 65,
  contactDamage: BUMP,
  initialAbilityState: {
    nextGazeTick: FIRST_GAZE_TICK,
    glareTick: -1,
    lastGlareTick: -1,
    glareDx: 1,
    glareDy: 0,
  },
  contactDamageOf: (_self, stats, target) =>
    target.stoned ? stats.contactDamage * SHATTER_TIMES : stats.contactDamage,
  hooks: {
    onTick: ({ world, self, isPhased, aimPointOf }) => {
      const state = self.abilityState;
      const { tick } = world;
      const heading = headingOf(self);
      if (heading === undefined) return [];
      const look = () => firstInGaze(self, heading, world.balls, isPhased, aimPointOf);
      if (state.glareTick < 0) {
        if (tick < state.nextGazeTick || look() === undefined) return [];
        return [
          { kind: 'setAbilityState', state: { ...state, glareTick: tick + GLARE_WINDUP_TICKS } },
        ];
      }
      if (tick < state.glareTick) return [];
      const next: MedusaState = {
        nextGazeTick: tick + GAZE_EVERY_TICKS,
        glareTick: -1,
        lastGlareTick: tick,
        glareDx: heading.x,
        glareDy: heading.y,
      };
      const actions: AbilityAction<MedusaState>[] = [{ kind: 'setAbilityState', state: next }];
      const hit = look();
      // A copy that comes first takes the glare, and nothing turns to stone.
      if (hit !== undefined && !hit.copy) {
        actions.push({
          kind: 'applyStatus',
          targetId: hit.ball.id,
          status: 'stoned',
          durationTicks: STONE_TICKS,
        });
      }
      return actions;
    },
    // Her bump has shattered it (contactDamageOf): the stone is gone.
    onHitBall: ({ self, other }) =>
      sideOf(other) !== sideOf(self) && hasStatus(other, 'stoned')
        ? [{ kind: 'clearStatus', targetId: other.id, status: 'stoned' }]
        : [],
  },
});
