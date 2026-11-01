/** Simulation ticks per second. The sim always advances in steps of exactly DT. */
export const TICK_RATE = 60;

/** Seconds of simulated time per tick. */
export const DT = 1 / TICK_RATE;

/** Side length of the square arena in world units, independent of screen size. */
export const ARENA_SIZE = 1000;

/**
 * How close two balls must be, beyond touching, to still count as in contact. Covers balls that
 * were just separated and drift apart slowly, so one collision is never counted twice.
 */
export const CONTACT_SLOP = 0.5;
