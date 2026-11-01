/** Simulation ticks per second. The sim always advances in steps of exactly DT. */
export const TICK_RATE = 60;

/** Seconds of simulated time per tick. */
export const DT = 1 / TICK_RATE;

/** Side length of the square arena in world units, independent of screen size. */
export const ARENA_SIZE = 1000;
