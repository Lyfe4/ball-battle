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

/**
 * Creates the opening state of a match. Each ball gets its own vertical strip of the arena so
 * balls never start overlapping, a random position inside it, and a random launch direction.
 */
export function createWorld(seed: number, definitions: readonly BallDefinition[]): WorldState {
  if (definitions.length < 2) {
    throw new Error('A match needs at least two balls');
  }

  const arena = { size: ARENA_SIZE };
  const stripWidth = arena.size / definitions.length;
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
    const y = nextRange(x.state, radius, arena.size - radius);
    const direction = randomDirection(y.state);
    rngState = direction.state;

    return {
      id: `ball-${index}`,
      definitionId: definition.id,
      position: vec2(x.value, y.value),
      velocity: scale(direction.value, definition.speed),
      radius,
      health: definition.maxHealth,
      abilityState: definition.initialAbilityState,
      statuses: [],
    };
  });

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
