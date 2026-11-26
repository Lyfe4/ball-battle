import { STANDARD_BALL_RADIUS, TICK_RATE } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import type { BallState, Vec2 } from '../types.ts';

export type RamState = Readonly<{
  /** The ball it last threw, or '' for none. */
  thrownId: string;
  /** The last tick that ball can still crash. */
  crashBy: number;
}>;

/** How long a thrown ball can still crash into a wall. */
export const CRASH_WINDOW_TICKS = TICK_RATE;
/** What a crash deals to a standard-size ball. */
export const CRASH_DAMAGE = 12.5;
/** A ball crashing at this speed takes CRASH_DAMAGE; faster crashes harder, slower softer. */
export const CRASH_SPEED = 770;
/** A ball whose edge is this close to a wall, moving away from it, has just hit it. */
export const WALL_GAP = 20;

/**
 * How light a ball is next to a standard one, by width (standard radius / its radius), at most 1:
 * the share of a throw and of a crash it takes. A grown Titan (r 90) takes 0.56. (By mass, r², the
 * Titan's lean was 88%, past the 78% limit.)
 */
export function lightnessOf(radius: number): number {
  const share = STANDARD_BALL_RADIUS / radius;
  return share > 1 ? 1 : share;
}

function speedOf(ball: BallState): number {
  return Math.sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y);
}

/** The point on the wall nearest `ball`, where a throw sends it. */
export function nearestWallPoint(ball: BallState, size: number): Vec2 {
  const { x, y } = ball.position;
  const gaps = [x, size - x, y, size - y];
  const least = Math.min(...gaps);
  if (least === x) return { x: 0, y };
  if (least === size - x) return { x: size, y };
  if (least === y) return { x, y: 0 };
  return { x, y: size };
}

/** True when `ball` has just bounced off a wall: its edge is at one, moving away from it. */
export function justHitWall(ball: BallState, size: number): boolean {
  const { position: p, velocity: v, radius: r } = ball;
  return (
    (p.x - r <= WALL_GAP && v.x > 0) ||
    (size - r - p.x <= WALL_GAP && v.x < 0) ||
    (p.y - r <= WALL_GAP && v.y > 0) ||
    (size - r - p.y <= WALL_GAP && v.y < 0)
  );
}

/**
 * A ram (prototype, Track C1): a ball it bumps is thrown toward its nearest wall (steered by its
 * lightness), and if it hits a wall within CRASH_WINDOW_TICKS it crashes for CRASH_DAMAGE times its
 * lightness times its speed over CRASH_SPEED. Heavy balls (a grown Titan) barely turn and crash
 * softly; fast balls crash hard, slowed or held ones softly.
 */
export const ram = defineBall<RamState>({
  id: 'ram',
  name: 'Ram',
  description: 'Throws what it bumps at the wall; heavy balls barely budge.',
  color: '#78716c',
  ability: { name: 'Throw', shownBy: { kind: 'hookDamage', hook: 'onTick' }, tipOn: 'struck' },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 63,
  contactDamage: 14,
  initialAbilityState: { thrownId: '', crashBy: 0 },
  hooks: {
    onTick: ({ world, self }) => {
      const { thrownId, crashBy } = self.abilityState;
      if (thrownId === '') return [];
      const thrown = world.balls.find((ball) => ball.id === thrownId);
      if (thrown === undefined || thrown.health <= 0 || world.tick > crashBy) {
        return [{ kind: 'setAbilityState', state: { thrownId: '', crashBy: 0 } }];
      }
      if (!justHitWall(thrown, world.arena.size)) return [];
      return [
        { kind: 'setAbilityState', state: { thrownId: '', crashBy: 0 } },
        {
          kind: 'damage',
          targetId: thrown.id,
          amount: Math.round(
            (CRASH_DAMAGE * lightnessOf(thrown.radius) * speedOf(thrown)) / CRASH_SPEED,
          ),
        },
      ];
    },
    onHitBall: ({ world, self, other, isPhased }) => {
      if (sideOf(other) === sideOf(self) || other.health <= 0 || isPhased(other)) return [];
      return [
        {
          kind: 'steer',
          targetId: other.id,
          toward: nearestWallPoint(other, world.arena.size),
          share: lightnessOf(other.radius),
        },
        {
          kind: 'setAbilityState',
          state: { thrownId: other.id, crashBy: world.tick + CRASH_WINDOW_TICKS },
        },
      ];
    },
  },
});
