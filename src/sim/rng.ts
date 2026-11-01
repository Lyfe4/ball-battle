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
