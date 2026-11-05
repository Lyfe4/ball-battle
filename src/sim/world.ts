import { ARENA_SIZE } from './constants.ts';
import { nextRange, seedRng, type RngResult, type RngState } from './rng.ts';
import type { BallDefinition, BallState, Vec2, WorldState } from './types.ts';
import { scale, vec2 } from './vec2.ts';

/**
 * How a match starts.
 * - `random` (the default, what the game plays): each ball gets a random spot in its own vertical
 *   strip and a random launch direction, all from the seed.
 * - `aimed`: two balls on fixed, mirrored spots (`AIMED_STARTS`), each launched towards its own aim
 *   point. Aim points are whole arena coordinates, so a choice made in a browser or on a server is
 *   exactly the same number. The seed still drives everything after the launch.
 */
export type StartMode =
  { readonly kind: 'random' } | { readonly kind: 'aimed'; readonly aims: readonly Vec2[] };

export const RANDOM_START: StartMode = { kind: 'random' };

/**
 * Where the two balls of an aimed start stand: a quarter of the way in from the left and right
 * walls, on the middle line, so the two spots mirror each other across the centre.
 */
export const AIMED_STARTS: readonly [Vec2, Vec2] = [
  vec2(ARENA_SIZE / 4, ARENA_SIZE / 2),
  vec2((ARENA_SIZE * 3) / 4, ARENA_SIZE / 2),
];

/**
 * Uniformly random direction, using rejection sampling inside the unit circle. Avoids
 * Math.cos/sin, which are not guaranteed identical across engines (ADR 0001).
 */
function randomDirection(state: RngState): RngResult<Vec2> {
  let current = state;
  for (;;) {
    const x = nextRange(current, -1, 1);
    const y = nextRange(x.state, -1, 1);
    current = y.state;
    const lengthSquared = x.value * x.value + y.value * y.value;
    // Reject points outside the circle (they would bias towards diagonals) and near the origin.
    if (lengthSquared > 1e-6 && lengthSquared <= 1) {
      const length = Math.sqrt(lengthSquared);
      return { value: vec2(x.value / length, y.value / length), state: current };
    }
  }
}

/**
 * The unit vector from `from` towards `to`, with Math.sqrt only (no trig, ADR 0001). Throws for
 * an aim point that isn't a whole number inside the arena, or that is the ball's own spot (it has
 * no direction).
 */
export function aimDirection(from: Vec2, to: Vec2, arenaSize: number): Vec2 {
  for (const value of [to.x, to.y]) {
    if (!Number.isInteger(value) || value < 0 || value > arenaSize) {
      throw new Error(`Aim point (${to.x}, ${to.y}) must be whole numbers from 0 to ${arenaSize}`);
    }
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) throw new Error(`Aim point (${to.x}, ${to.y}) is the ball's own position`);
  return vec2(dx / length, dy / length);
}

function newBall(
  definition: BallDefinition,
  index: number,
  position: Vec2,
  direction: Vec2,
): BallState {
  return {
    id: `ball-${index}`,
    definitionId: definition.id,
    position,
    velocity: scale(direction, definition.speed),
    radius: definition.radius,
    health: definition.maxHealth,
    abilityState: definition.initialAbilityState,
    statuses: [],
  };
}

/**
 * Each ball gets its own vertical strip of the arena so balls never start overlapping, a random
 * position inside it, and a random launch direction.
 */
function randomStart(
  seed: number,
  definitions: readonly BallDefinition[],
  size: number,
): { balls: BallState[]; rngState: RngState } {
  const stripWidth = size / definitions.length;
  let rngState = seedRng(seed);

  const balls = definitions.map((definition, index): BallState => {
    const { radius } = definition;
    if (radius * 2 > stripWidth) {
      throw new Error(
        `Ball "${definition.id}" is too large for a ${definitions.length}-ball arena`,
      );
    }

    const stripStart = index * stripWidth;
    const x = nextRange(rngState, stripStart + radius, stripStart + stripWidth - radius);
    const y = nextRange(x.state, radius, size - radius);
    const direction = randomDirection(y.state);
    rngState = direction.state;
    return newBall(definition, index, vec2(x.value, y.value), direction.value);
  });
  return { balls, rngState };
}

/** Two balls on the fixed spots, each launched at its aim point. Draws nothing from the RNG. */
function aimedStart(
  seed: number,
  definitions: readonly BallDefinition[],
  aims: readonly Vec2[],
  size: number,
): { balls: BallState[]; rngState: RngState } {
  if (definitions.length !== AIMED_STARTS.length) {
    throw new Error(`An aimed start needs exactly ${AIMED_STARTS.length} balls`);
  }
  if (aims.length !== definitions.length) {
    throw new Error(`An aimed start needs one aim point per ball`);
  }
  const balls = definitions.map((definition, index): BallState => {
    const position = AIMED_STARTS[index];
    const aim = aims[index];
    if (position === undefined || aim === undefined) throw new Error('Missing start or aim');
    // Inside the side walls also keeps the two spots (half the arena apart) from overlapping.
    const { radius } = definition;
    if (position.x - radius < 0 || position.x + radius > size) {
      throw new Error(`Ball "${definition.id}" is too large for an aimed start`);
    }
    return newBall(definition, index, position, aimDirection(position, aim, size));
  });
  return { balls, rngState: seedRng(seed) };
}

/** Creates the opening state of a match. `start` defaults to today's random start. */
export function createWorld(
  seed: number,
  definitions: readonly BallDefinition[],
  start: StartMode = RANDOM_START,
): WorldState {
  if (definitions.length < 2) {
    throw new Error('A match needs at least two balls');
  }

  const arena = { size: ARENA_SIZE };
  const { balls, rngState } =
    start.kind === 'random'
      ? randomStart(seed, definitions, arena.size)
      : aimedStart(seed, definitions, start.aims, arena.size);

  return {
    tick: 0,
    arena,
    balls,
    rngState,
    contacts: [],
    match: { status: 'running' },
    projectiles: [],
    nextProjectileId: 0,
    zones: [],
    nextZoneId: 0,
  };
}
