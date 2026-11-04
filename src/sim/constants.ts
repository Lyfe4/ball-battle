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

/** Every match ends by this much sim time; the healthier ball (by fraction) wins. */
export const MATCH_TIME_LIMIT_SECONDS = 60;

export const MATCH_TIME_LIMIT_TICKS = MATCH_TIME_LIMIT_SECONDS * TICK_RATE;

/**
 * Contact damage scales with how hard the attacker drove into the target: its speed towards the
 * target, before the bounce, divided by its definition speed. Clamped so glancing or standing hits
 * still hurt a little and very fast hits can't one-shot (ADR 0002).
 */
export const MIN_IMPACT_MULTIPLIER = 0.25;
export const MAX_IMPACT_MULTIPLIER = 2;

/**
 * Every current ball's radius in world units (ADR 0008). Balls differ by stats and abilities, not
 * size; a future size-themed ball must be listed as an exception in the roster's identity tests.
 */
export const STANDARD_BALL_RADIUS = 50;
