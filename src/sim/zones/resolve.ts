import { applyActions, dealAbilityDamage, sceneOf } from '../abilities/apply-actions.ts';
import { isAlive } from '../combat.ts';
import type { MinionState } from '../minions/types.ts';
import type { BallState, DefinitionLookup, SimEvent, ZoneState } from '../types.ts';

export interface ZoneResult {
  readonly balls: readonly BallState[];
  readonly zones: readonly ZoneState[];
  /** Minions still in play: a strike destroys every enemy minion inside it (ADR 0026). */
  readonly minions: readonly MinionState[];
  readonly events: readonly SimEvent[];
}

/** Strict overlap, as for ball collisions; squared distances, so no sqrt and no rounding. */
function overlaps(zone: ZoneState, ball: Pick<BallState, 'position' | 'radius'>): boolean {
  const dx = ball.position.x - zone.position.x;
  const dy = ball.position.y - zone.position.y;
  const reach = zone.radius + ball.radius;
  return dx * dx + dy * dy < reach * reach;
}

/**
 * Which strike of `zone` falls on `tick`: 0 for its first, then 1, 2, ... for a lasting zone's
 * pulses (ADR 0034); undefined when it doesn't strike on this tick.
 */
export function pulseAt(zone: ZoneState, tick: number): number | undefined {
  if (tick === zone.strikeTick) return 0;
  const { endTick, pulseEveryTicks } = zone;
  if (endTick === undefined || pulseEveryTicks === undefined) return undefined;
  if (tick < zone.strikeTick || tick > endTick) return undefined;
  const since = tick - zone.strikeTick;
  return since % pulseEveryTicks === 0 ? since / pulseEveryTicks : undefined;
}

/** True once a zone has nothing left to do after `tick`: it struck once, or its time is up. */
function isSpent(zone: ZoneState, tick: number): boolean {
  return tick >= (zone.endTick ?? zone.strikeTick);
}

/**
 * Strikes every zone whose strike tick is `tick` (ADR 0006), and every lasting zone whose pulse
 * falls on it (ADR 0034). Each one deals its damage to every
 * live ball other than its owner that overlaps it now, then is removed; the rest are kept as they
 * are. Zones strike in spawn order and each strike is applied before the next, so a ball brought
 * to 0 health by one zone is not hit by the next. A zone with a status applies it to each ball it
 * hit, right after that ball's damage (ADR 0009); a ball the strike defeated gets none. Then it
 * destroys every enemy minion inside it (ADR 0026).
 */
export function resolveZones(
  zones: readonly ZoneState[],
  balls: readonly BallState[],
  definitions: DefinitionLookup,
  tick: number,
  minions: readonly MinionState[] = [],
): ZoneResult {
  let current = balls;
  let standing = minions;
  const remaining: ZoneState[] = [];
  const events: SimEvent[] = [];

  for (const zone of zones) {
    const pulse = pulseAt(zone, tick);
    if (pulse === undefined) {
      if (!isSpent(zone, tick)) remaining.push(zone);
      continue;
    }
    // A lasting zone stays for its next pulse; a strike-once zone is used up.
    if (!isSpent(zone, tick)) remaining.push(zone);
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
      if (zone.status !== undefined) {
        // Through an applyStatus action, like the damage: statuses only ever come from actions.
        const applied = applyActions(
          sceneOf(current),
          zone.ownerId,
          [
            {
              kind: 'applyStatus',
              targetId: ball.id,
              status: zone.status.kind,
              durationTicks: zone.status.durationTicks,
            },
          ],
          definitions,
          tick,
          // An applyStatus action never uses the arena size.
          Infinity,
        );
        current = applied.balls;
        damage.push(...applied.events);
      }
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
        ...(zone.endTick === undefined ? {} : { pulse }),
      },
      ...damage,
    );
    // Area attacks clear minions: every enemy minion inside the strike is destroyed (ADR 0026).
    for (const minion of standing) {
      if (minion.ownerId === zone.ownerId || !overlaps(zone, minion)) continue;
      events.push({
        type: 'minionDestroyed',
        tick,
        minionId: minion.id,
        ownerId: minion.ownerId,
        position: minion.position,
        reason: 'zone',
        byId: zone.ownerId,
      });
    }
    standing = standing.filter(
      (minion) => minion.ownerId === zone.ownerId || !overlaps(zone, minion),
    );
  }
  return { balls: current, zones: remaining, minions: standing, events };
}
