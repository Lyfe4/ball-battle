// Shields (ADR 0043): a `shielded` status takes the next hit on its ball, whatever delivered it (a
// contact hit, a projectile, a strike, a burn, a skull, a poison tick, a hook's damage). It soaks
// up to SHIELD_SOAK of that hit, so a small hit is blocked whole and a big one is blunted, and it
// breaks either way. One rule in one place, for both damage paths: contact damage (combat.ts) and
// ability damage (the `damage` action every other source goes through).
import { MATCH_TIME_LIMIT_TICKS } from './constants.ts';
import { hasStatus } from './status.ts';
import type { BallState } from './types.ts';

/**
 * How long a shield lasts once it is up: longer than any match, so it only ever ends by breaking.
 * A status needs a duration (ADR 0009); this one never runs out.
 */
export const SHIELD_TICKS = MATCH_TIME_LIMIT_TICKS + 1;

/**
 * The most of one hit a shield takes. A full block was measured first: contact hits come only every
 * few seconds and are heavy, so a shield that took any hit whole beat every heavy hitter, the
 * Brawler most of all (ADR 0043).
 */
export const SHIELD_SOAK = 10;

/** A shield took a hit and broke. `soaked` is what it took; any rest lands as a damage event. */
export interface ShieldBrokenEvent {
  readonly type: 'shieldBroken';
  readonly tick: number;
  readonly ballId: string;
  /** The ball whose hit broke it. */
  readonly sourceId: string;
  /** Health the shield saved: the whole hit, up to SHIELD_SOAK. */
  readonly soaked: number;
}

/** True when the ball's next hit goes into its shield first. */
export function isShielded(ball: BallState): boolean {
  return hasStatus(ball, 'shielded');
}

/**
 * A hit of `amount` (already no more than the ball's health) from `sourceId` on a shielded ball:
 * the ball with its shield broken (health unchanged), what is left of the hit to land, and the
 * event.
 */
export function soakHit(
  ball: BallState,
  sourceId: string,
  amount: number,
  tick: number,
): { readonly ball: BallState; readonly rest: number; readonly event: ShieldBrokenEvent } {
  const soaked = Math.min(amount, SHIELD_SOAK);
  return {
    ball: { ...ball, statuses: ball.statuses.filter((status) => status.kind !== 'shielded') },
    rest: amount - soaked,
    event: { type: 'shieldBroken', tick, ballId: ball.id, sourceId, soaked },
  };
}
