import { dealAbilityDamage } from '../abilities/apply-actions.ts';
import { isAlive } from '../combat.ts';
import type { BallState, DefinitionLookup, SimEvent, ZoneState } from '../types.ts';

export interface ZoneResult {
  readonly balls: readonly BallState[];
  readonly zones: readonly ZoneState[];
  readonly events: readonly SimEvent[];
}

/** Strict overlap, as for ball collisions; squared distances, so no sqrt and no rounding. */
function overlaps(zone: ZoneState, ball: BallState): boolean {
  const dx = ball.position.x - zone.position.x;
  const dy = ball.position.y - zone.position.y;
  const reach = zone.radius + ball.radius;
  return dx * dx + dy * dy < reach * reach;
}

/**
 * Strikes every zone whose strike tick is `tick` (ADR 0006). Each one deals its damage to every
 * live ball other than its owner that overlaps it now, then is removed; the rest are kept as they
 * are. Zones strike in spawn order and each strike is applied before the next, so a ball brought
 * to 0 health by one zone is not hit by the next.
 */
export function resolveZones(
  zones: readonly ZoneState[],
  balls: readonly BallState[],
  definitions: DefinitionLookup,
  tick: number,
): ZoneResult {
  let current = balls;
  const remaining: ZoneState[] = [];
  const events: SimEvent[] = [];

  for (const zone of zones) {
    if (zone.strikeTick !== tick) {
      remaining.push(zone);
      continue;
    }
    const hitIds: string[] = [];
    const damage: SimEvent[] = [];
    for (const ball of current) {
      // Current health, so a ball defeated by an earlier zone this tick is not hit again.
      if (ball.id === zone.ownerId || !isAlive(ball) || !overlaps(zone, ball)) continue;
      const result = dealAbilityDamage(
        current,
        zone.ownerId,
        ball.id,
        zone.damage,
        definitions,
        tick,
      );
      current = result.balls;
      if (result.damage === undefined) continue;
      hitIds.push(ball.id);
      damage.push(result.damage);
    }
    events.push(
      {
        type: 'zoneStruck',
        tick,
        zoneId: zone.id,
        ownerId: zone.ownerId,
        position: zone.position,
        radius: zone.radius,
        hitIds,
      },
      ...damage,
    );
  }
  return { balls: current, zones: remaining, events };
}
