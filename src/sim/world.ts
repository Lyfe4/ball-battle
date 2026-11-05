import { ARENA_SIZE } from './constants.ts';
import { nextRange, seedRng, type RngResult, type RngState } from './rng.ts';
import type { BallDefinition, BallState, Vec2, WorldState } from './types.ts';
import { scale, vec2 } from './vec2.ts';

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

/** Creates the opening state of a match. */
export function createWorld(seed: number, definitions: readonly BallDefinition[]): WorldState {
  if (definitions.length < 2) {
    throw new Error('A match needs at least two balls');
  }

  const arena = { size: ARENA_SIZE };
  const { balls, rngState } = randomStart(seed, definitions, arena.size);

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
    minions: [],
    nextMinionId: 0,
  };
}
