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
 * Contact damage scales with how directly the attacker hit: the cosine of its approach angle,
 * clamped to [MIN_IMPACT_MULTIPLIER, 1], so a glancing, retreating or standing ball still hurts a
 * little (ADR 0002, ADR 0008).
 */
export const MIN_IMPACT_MULTIPLIER = 0.25;

/**
 * Every current ball's radius in world units (ADR 0008). Balls differ by stats and abilities, not
 * size; a future size-themed ball must be listed as an exception in the roster's identity tests.
 */
export const STANDARD_BALL_RADIUS = 50;
