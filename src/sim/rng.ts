/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * The generator state is a plain uint32 so it can live inside WorldState and be copied,
 * compared and serialised like any other value. Every function here is pure: it takes a
 * state and returns the next one. Only 32-bit integer operations are used, which are
 * exact in every JS engine (see docs/decisions/0001-deterministic-simulation.md).
 */

/** Generator state: an unsigned 32-bit integer. */
export type RngState = number;

export interface RngResult<T> {
  readonly value: T;
  readonly state: RngState;
}

const GOLDEN_GAMMA = 0x6d2b79f5;
const UINT32_RANGE = 0x1_0000_0000;

/** Normalises any number to a valid generator state. Non-finite seeds map to 0. */
export function seedRng(seed: number): RngState {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
}

/** Returns a float in [0, 1) and the advanced state. */
export function nextFloat(state: RngState): RngResult<number> {
  const next = (state + GOLDEN_GAMMA) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  return { value, state: next };
}

/** Returns a float in [min, max) and the advanced state. */
export function nextRange(state: RngState, min: number, max: number): RngResult<number> {
  const { value, state: next } = nextFloat(state);
  return { value: min + value * (max - min), state: next };
}

/**
 * Mixes several integers into one generator state (a murmur3-style finaliser per part). Used to
 * give each hook call its own independent stream; see ADR 0003. Integer-only, so exact everywhere.
 */
export function deriveSeed(parts: readonly number[]): RngState {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    hash = Math.imul(hash ^ (part >>> 0), 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
  }
  return hash >>> 0;
}

/**
 * A stream of floats in [0, 1) starting from `state`. The returned function keeps its own
 * position, so it must only be handed to one consumer (one hook call) and never stored in the
 * world.
 */
export function createStream(state: RngState): () => number {
  let current = state;
  return () => {
    const result = nextFloat(current);
    current = result.state;
    return result.value;
  };
}
