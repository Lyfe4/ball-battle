// Statuses that act on their own each tick, rather than changing how something else resolves
// (ADR 0012). Poison is the only one: it deals its source's ability damage on a fixed interval.
import { dealAbilityDamage } from './abilities/apply-actions.ts';
import { isAlive } from './combat.ts';
import { isPoisonTick, POISON_DAMAGE } from './status.ts';
import type { BallState, DamageEvent, DefinitionLookup } from './types.ts';

export interface PoisonResult {
  readonly balls: readonly BallState[];
  readonly damage: readonly DamageEvent[];
}

/**
 * Every live poisoned ball whose poison is due this tick takes POISON_DAMAGE as ability damage from
 * the poison's source, through the same path as the `damage` action, so it is the source's damage
 * and feeds its onDamageDealt. Balls resolve in array order. A poison whose source has been
 * defeated still ticks, like an arrow still in flight (ADR 0005).
 */
export function resolvePoison(
  balls: readonly BallState[],
  definitions: DefinitionLookup,
  tick: number,
): PoisonResult {
  let current = balls;
  const damage: DamageEvent[] = [];
  for (const ball of balls) {
    const poison = ball.statuses.find((status) => status.kind === 'poisoned');
    if (poison === undefined || !isAlive(ball) || !isPoisonTick(poison.sinceTick, tick)) continue;
    const result = dealAbilityDamage(
      current,
      poison.sourceId,
      ball.id,
      POISON_DAMAGE,
      definitions,
      tick,
      'poison',
    );
    current = result.balls;
    if (result.damage !== undefined) damage.push(result.damage);
  }
  return { balls: current, damage };
}
