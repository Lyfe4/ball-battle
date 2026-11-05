// Aim-point geometry and headless play for the aiming measurements (docs/aiming-measurements.md).
// Measurement only: it uses the real sim's aimed start (`createWorld` with `kind: 'aimed'`) and
// changes nothing in the game. Scripts may use trig; the sim only ever sees integer aim points.
import { BALL_LOOKUP } from '../src/sim/balls/index.ts';
import { getDefinition } from '../src/sim/definitions.ts';
import { createStream, deriveSeed } from '../src/sim/rng.ts';
import { playToEnd } from '../src/sim/series-verify.ts';
import type { Vec2, WorldState } from '../src/sim/types.ts';
import { scale } from '../src/sim/vec2.ts';
import { AIMED_STARTS, aimDirection, createWorld } from '../src/sim/world.ts';

/**
 * Directions tried, evenly spaced: 24 is every 15°. The AIM_DIRECTIONS environment variable
 * overrides it for a cheaper run (12 is every 30°); it must be even.
 */
export const DIRECTIONS = Number(process.env['AIM_DIRECTIONS'] ?? 24);
/** Aim points sit this far from the ball, rounded to whole units (under 0.15° of error). */
export const AIM_RADIUS = 240;

/**
 * How one side aims, in its own frame: 0° is straight at the opponent's spot, positive angles turn
 * towards the bottom wall. Side B's frame is the mirror image of side A's, so the same angle means
 * the same thing from either spot.
 * - `dir`: one of the DIRECTIONS evenly spaced directions.
 * - `random`: a uniformly random direction for each seed.
 * - `mixed`: a direction drawn for each seed from these weights over the DIRECTIONS directions.
 */
export type AimSpec =
  | { readonly kind: 'dir'; readonly index: number }
  | { readonly kind: 'random' }
  | { readonly kind: 'mixed'; readonly weights: readonly number[] };

/** A named pair of aims for P and Q, for evaluation on held-out seeds. */
export interface Strategy {
  readonly p: string;
  readonly q: string;
  readonly name: string;
  readonly aimP: AimSpec;
  readonly aimQ: AimSpec;
}

/** Extra rules a mitigation adds on top of the chosen aim. */
export interface AimVariant {
  /** Each launch is turned by a seeded random angle up to this many degrees either way. */
  readonly wobbleDegrees: number;
  /** Ignore the aims and use today's random start, for comparison. */
  readonly randomStart: boolean;
  /**
   * Side A's spot's distance from its wall (side B mirrors it, both on the middle line), to
   * measure other spots than the sim's AIMED_STARTS (250). Undefined keeps the sim's spots.
   */
  readonly startX: number | undefined;
}

export const PLAIN: AimVariant = { wobbleDegrees: 0, randomStart: false, startX: undefined };

/** Angle in degrees, in the side's own frame, of direction `index`: 0, 15, ..., 345. */
export const angleOf = (index: number): number => (index * 360) / DIRECTIONS;

/** Folded angle 0-180: +θ and −θ are the same choice against a random opponent (the arena is symmetric). */
export const foldedOf = (index: number): number => {
  const angle = angleOf(index);
  return angle > 180 ? 360 - angle : angle;
};

/** The integer aim point for a side standing at `from`, aiming `degrees` in its own frame. */
export function aimPoint(
  from: Vec2,
  degrees: number,
  side: 0 | 1,
  arenaSize = 1000,
  radius = AIM_RADIUS,
): Vec2 {
  const radians = (degrees * Math.PI) / 180;
  // Side A faces +x (towards side B); side B is mirrored and faces −x.
  const towards = side === 0 ? 1 : -1;
  const clamp = (value: number) => Math.min(arenaSize, Math.max(0, Math.round(value)));
  return {
    x: clamp(from.x + towards * Math.cos(radians) * radius),
    y: clamp(from.y + Math.sin(radians) * radius),
  };
}

/** Salts so each seed's random aims, mixed picks and wobbles never share a stream. */
const AIM_SALT = 0xa1a1;
const WOBBLE_SALT = 0xb0b0;

/** The angle a side launches at for one seed. */
export function chosenAngle(spec: AimSpec, seed: number, side: 0 | 1): number {
  if (spec.kind === 'dir') return angleOf(spec.index);
  const draw = createStream(deriveSeed([seed, AIM_SALT, side]))();
  if (spec.kind === 'random') return draw * 360;
  const total = spec.weights.reduce((sum, weight) => sum + weight, 0);
  let left = draw * total;
  for (let index = 0; index < spec.weights.length; index++) {
    left -= spec.weights[index] ?? 0;
    if (left < 0) return angleOf(index);
  }
  return angleOf(spec.weights.length - 1);
}

function wobble(variant: AimVariant, seed: number, side: 0 | 1): number {
  if (variant.wobbleDegrees === 0) return 0;
  const draw = createStream(deriveSeed([seed, WOBBLE_SALT, side]))();
  return (draw * 2 - 1) * variant.wobbleDegrees;
}

/** The opening world of one match: `a` in slot 0 (left), `b` in slot 1 (right). */
export function aimedWorld(
  a: string,
  b: string,
  aimA: AimSpec,
  aimB: AimSpec,
  seed: number,
  variant: AimVariant = PLAIN,
): WorldState {
  const definitions = [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)];
  if (variant.randomStart) return createWorld(seed, definitions);
  const angleA = chosenAngle(aimA, seed, 0) + wobble(variant, seed, 0);
  const angleB = chosenAngle(aimB, seed, 1) + wobble(variant, seed, 1);
  const aims = [aimPoint(AIMED_STARTS[0], angleA, 0), aimPoint(AIMED_STARTS[1], angleB, 1)];
  const world = createWorld(seed, definitions, { kind: 'aimed', aims });
  if (variant.startX === undefined) return world;
  // Other spots, measured but not a game rule: move both balls and re-aim from there with the
  // sim's own aimDirection, keeping the launch speed.
  const size = world.arena.size;
  const spots = [
    { x: variant.startX, y: size / 2 },
    { x: size - variant.startX, y: size / 2 },
  ] as const;
  return {
    ...world,
    balls: world.balls.map((ball, index) => {
      const side = index === 0 ? 0 : 1;
      const spot = spots[side];
      const angle = side === 0 ? angleA : angleB;
      // Close to a wall, a shorter radius keeps every aim point inside the arena unclamped.
      const radius = Math.min(AIM_RADIUS, variant.startX ?? AIM_RADIUS);
      const direction = aimDirection(spot, aimPoint(spot, angle, side, size, radius), size);
      const speed = definitions[side]?.speed ?? 0;
      return { ...ball, position: spot, velocity: scale(direction, speed) };
    }),
  };
}

/** One unit of work: ball `p` aiming `aimP` against ball `q` aiming `aimQ`, over a seed range. */
export interface AimTask {
  readonly p: string;
  readonly q: string;
  readonly aimP: AimSpec;
  readonly aimQ: AimSpec;
  readonly firstSeed: number;
  readonly endSeed: number;
  readonly variant: AimVariant;
}

export interface AimResult {
  readonly winsP: number;
  readonly winsQ: number;
  readonly draws: number;
  readonly games: number;
  readonly ticks: number;
}

/** Plays a task in both slot orders, so the side a ball starts on cancels out. */
export function playTask(task: AimTask): AimResult {
  let winsP = 0;
  let winsQ = 0;
  let draws = 0;
  let games = 0;
  let ticks = 0;
  for (let seed = task.firstSeed; seed < task.endSeed; seed++) {
    for (const pSlot of [0, 1] as const) {
      const world =
        pSlot === 0
          ? aimedWorld(task.p, task.q, task.aimP, task.aimQ, seed, task.variant)
          : aimedWorld(task.q, task.p, task.aimQ, task.aimP, seed, task.variant);
      const end = playToEnd(world, BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('A match did not finish');
      games++;
      ticks += end.match.endTick;
      const { result } = end.match;
      if (result.kind === 'draw') draws++;
      else if (result.winnerId === `ball-${pSlot}`) winsP++;
      else winsQ++;
    }
  }
  return { winsP, winsQ, draws, games, ticks };
}
