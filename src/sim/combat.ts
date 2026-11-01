import type { PairContact } from './collision.ts';
import { CONTACT_SLOP, MAX_IMPACT_MULTIPLIER, MIN_IMPACT_MULTIPLIER } from './constants.ts';
import { getDefinition } from './definitions.ts';
import type { BallDefeatedEvent, BallState, DamageEvent, DefinitionLookup } from './types.ts';

export function isAlive(ball: BallState): boolean {
  return ball.health > 0;
}

/** Order-independent key for a pair of balls, as stored in WorldState.contacts. */
export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/**
 * The contact set for the end of this tick. A pair enters it only by actually colliding (being in
 * `collided`), and stays while both balls are alive and within CONTACT_SLOP of touching. Balls
 * that merely pass close without overlapping are never in contact, so their real hit next tick
 * still counts. Returned sorted so the world is identical however it was built.
 */
export function nextContacts(
  balls: readonly BallState[],
  previous: readonly string[],
  collided: readonly string[],
): string[] {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const candidates = new Set([...previous, ...collided]);
  return [...candidates]
    .filter((key) => {
      const [idA = '', idB = ''] = key.split('|');
      const a = byId.get(idA);
      const b = byId.get(idB);
      if (a === undefined || b === undefined || !isAlive(a) || !isAlive(b)) return false;
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const reach = a.radius + b.radius + CONTACT_SLOP;
      return dx * dx + dy * dy <= reach * reach;
    })
    .sort();
}

/** How hard a ball hit, relative to its own definition speed. */
export function impactMultiplier(approachSpeed: number, baseSpeed: number): number {
  if (baseSpeed <= 0) return MIN_IMPACT_MULTIPLIER;
  return Math.min(
    MAX_IMPACT_MULTIPLIER,
    Math.max(MIN_IMPACT_MULTIPLIER, approachSpeed / baseSpeed),
  );
}

/**
 * Damage for one hit, rounded to a whole number so health stays readable. Any hit from a ball with
 * contact damage deals at least 1. Math.round is exact, so this is deterministic (ADR 0001).
 */
export function impactDamage(contactDamage: number, multiplier: number): number {
  return contactDamage > 0 ? Math.max(1, Math.round(contactDamage * multiplier)) : 0;
}

export interface DamageResult {
  readonly balls: readonly BallState[];
  readonly damage: readonly DamageEvent[];
  readonly defeated: readonly BallDefeatedEvent[];
}

/**
 * Applies contact damage for each new contact. Each ball's hit is scaled by how hard it drove
 * into the other before the bounce. Within a pair both hits use health from before the exchange,
 * so two balls can knock each other out at once.
 */
export function applyContactDamage(
  balls: readonly BallState[],
  newContacts: readonly PairContact[],
  definitions: DefinitionLookup,
  tick: number,
): DamageResult {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const damage: DamageEvent[] = [];
  const lastHitBy = new Map<string, string>();

  const hit = (target: BallState, source: BallState, approachSpeed: number): BallState => {
    const definition = getDefinition(definitions, source.definitionId);
    const multiplier = impactMultiplier(approachSpeed, definition.speed);
    const amount = Math.min(target.health, impactDamage(definition.contactDamage, multiplier));
    if (amount <= 0) return target;
    const healthAfter = target.health - amount;
    damage.push({
      type: 'damage',
      tick,
      targetId: target.id,
      sourceId: source.id,
      amount,
      healthAfter,
      multiplier,
    });
    lastHitBy.set(target.id, source.id);
    return { ...target, health: healthAfter };
  };

  for (const { ballIds, approachSpeeds } of newContacts) {
    const a = byId.get(ballIds[0]);
    const b = byId.get(ballIds[1]);
    if (a === undefined || b === undefined) continue;
    byId.set(a.id, hit(a, b, approachSpeeds[1]));
    byId.set(b.id, hit(b, a, approachSpeeds[0]));
  }

  const defeated: BallDefeatedEvent[] = [];
  for (const before of balls) {
    const after = byId.get(before.id);
    const defeatedById = lastHitBy.get(before.id);
    if (after !== undefined && defeatedById !== undefined && isAlive(before) && !isAlive(after)) {
      defeated.push({ type: 'ballDefeated', tick, ballId: before.id, defeatedById });
    }
  }
  return { balls: balls.map((ball) => byId.get(ball.id) ?? ball), damage, defeated };
}
