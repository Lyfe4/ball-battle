import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import type { BallState, Vec2 } from '../types.ts';
import { secondsOf } from './how-it-works.ts';

export type MirageState = Readonly<{
  /** True while its copy shows: aimed attacks go for the copy. */
  copyOn: boolean;
  /** The copy's offset from the Mirage, kept after a pop (where it burst). */
  copyDx: number;
  copyDy: number;
  /** While the copy is gone, the tick it shimmers back; while it shows, the tick it appeared. */
  backAt: number;
}>;

/** How far from the Mirage its copy hangs, centre to centre. */
export const COPY_OFFSET = 170;
/** A shot, or a strike landing, within this of the copy's centre (plus its own radius) pops it. */
export const COPY_POP_REACH = 60;
/** Ticks after a pop before the copy shimmers back (3.8 s). */
export const COPY_BACK_TICKS = 230;
/** The tick its first copy appears. */
export const FIRST_COPY_TICK = 30;
/** The copy's centre stays this far inside the walls. */
export const COPY_WALL_MARGIN = 40;

/** The eight sides a copy can hang on, as unit vectors (no trig, ADR 0001). */
const SIDES = [
  [1, 0],
  [0.7071, 0.7071],
  [0, 1],
  [-0.7071, 0.7071],
  [-1, 0],
  [-0.7071, -0.7071],
  [0, -1],
  [0.7071, -0.7071],
] as const;

/** A Mirage's state, read from any ball state (undefined for other balls). */
export function mirageStateOf(ball: BallState): MirageState | undefined {
  const { copyOn, copyDx, copyDy, backAt } = ball.abilityState;
  if (typeof copyOn !== 'boolean' || typeof copyDx !== 'number') return undefined;
  if (typeof copyDy !== 'number' || typeof backAt !== 'number') return undefined;
  return { copyOn, copyDx, copyDy, backAt };
}

/** Where the copy of a Mirage at `position` hangs, kept inside a court of `size`. */
export function copyPosition(position: Vec2, state: MirageState, size: number): Vec2 {
  const clamp = (value: number) =>
    Math.min(size - COPY_WALL_MARGIN, Math.max(COPY_WALL_MARGIN, value));
  return { x: clamp(position.x + state.copyDx), y: clamp(position.y + state.copyDy) };
}

/**
 * A shimmering copy (ADR 0077): a copy of it hangs COPY_OFFSET away on one of eight sides, and every
 * aimed attack at the Mirage aims at the copy instead (its `decoyOf`, read by `nearestTarget`).
 * A shot passing within COPY_POP_REACH of the copy, or a strike landing there, pops it; it comes
 * back COPY_BACK_TICKS later on a side picked at random. The copy has no body: nothing bumps it, it
 * deals nothing, and it never draws an attack aimed at another ball (unlike the Necromancer's skull,
 * a minion that fights and draws shots by being nearer). Bumps reach the Mirage as normal.
 */
export const mirage = defineBall<MirageState>({
  id: 'mirage',
  name: 'Mirage',
  description: 'Aimed shots go for the shimmering copy beside it.',
  color: '#fda4af',
  ability: { name: 'Copy', shownBy: { kind: 'hook', hook: 'onTick' } },
  howItWorks: [
    `Its copy hangs ${String(COPY_OFFSET)} away. Arrows, spears, boomerangs, lightning and shots aim at the copy while it shows.`,
    `A shot or a strike reaching the copy pops it; it comes back ${secondsOf(COPY_BACK_TICKS)} s later on another side.`,
    'Bumps, poison and anything not aimed reach the Mirage as normal.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 76,
  contactDamage: 23.5,
  initialAbilityState: { copyOn: false, copyDx: 0, copyDy: 0, backAt: FIRST_COPY_TICK },
  decoyOf: (self, size) =>
    self.abilityState.copyOn ? copyPosition(self.position, self.abilityState, size) : undefined,
  hooks: {
    onTick: ({ world, self, random }) => {
      const s = self.abilityState;
      if (!s.copyOn) {
        if (world.tick < s.backAt) return [];
        const [x, y] = SIDES[Math.floor(random() * SIDES.length)] ?? SIDES[0];
        const state = {
          copyOn: true,
          copyDx: x * COPY_OFFSET,
          copyDy: y * COPY_OFFSET,
          backAt: world.tick,
        };
        return [{ kind: 'setAbilityState', state }];
      }
      const at = copyPosition(self.position, s, world.arena.size);
      const reaches = (position: Vec2, radius: number) => {
        const dx = position.x - at.x;
        const dy = position.y - at.y;
        const reach = COPY_POP_REACH + radius;
        return dx * dx + dy * dy <= reach * reach;
      };
      const ours = (ownerId: string) =>
        world.balls.some((ball) => ball.id === ownerId && sideOf(ball) === sideOf(self));
      const popped =
        world.projectiles.some(
          (shot) => !ours(shot.ownerId) && reaches(shot.position, shot.radius),
        ) ||
        world.zones.some(
          (zone) =>
            !ours(zone.ownerId) &&
            zone.strikeTick === world.tick &&
            reaches(zone.position, zone.radius),
        );
      return popped
        ? [
            {
              kind: 'setAbilityState',
              state: { ...s, copyOn: false, backAt: world.tick + COPY_BACK_TICKS },
            },
          ]
        : [];
    },
  },
});
