import type { PairContact } from './collision.ts';
import { CONTACT_SLOP, MIN_IMPACT_MULTIPLIER } from './constants.ts';
import { getDefinition } from './definitions.ts';
import { isShielded, soakHit, type ShieldBrokenEvent } from './shield.ts';
import type {
  BallDefeatedEvent,
  BallDefinition,
  BallState,
  DamageEvent,
  DefinitionLookup,
  SimEvent,
} from './types.ts';

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

/**
 * How much of its contact damage a ball deals, from how directly it hit (the cosine of its
 * approach angle, see Contact.directness): full head-on, less for a glancing hit, and the minimum
 * for a ball moving away or standing still. Speed does not matter (ADR 0008).
 */
export function directnessMultiplier(directness: number): number {
  return Math.min(1, Math.max(MIN_IMPACT_MULTIPLIER, directness));
}

/**
 * Damage for one hit, rounded to a whole number so health stays readable. Any hit from a ball with
 * contact damage deals at least 1. Math.round is exact, so this is deterministic (ADR 0001).
 */
export function impactDamage(contactDamage: number, multiplier: number): number {
  return contactDamage > 0 ? Math.max(1, Math.round(contactDamage * multiplier)) : 0;
}

/** True while a ball's definition says it is phased (ADR 0026): it passes through other balls. */
export function isPhased(ball: BallState, definition: BallDefinition): boolean {
  return definition.phasedOf?.(ball) ?? false;
}

/**
 * The base contact damage a ball deals in its current state: its definition's `contactDamageOf`
 * if it declares one, otherwise its `contactDamage` (ADR 0015). Throws for a non-finite or
 * negative value, which only a bug can produce.
 */
export function contactDamageOf(ball: BallState, definition: BallDefinition): number {
  const damage = definition.contactDamageOf?.(ball, definition) ?? definition.contactDamage;
  if (!Number.isFinite(damage) || damage < 0) {
    throw new Error(`Ball "${ball.id}" has an invalid contact damage (${String(damage)})`);
  }
  return damage;
}

export interface DamageResult {
  readonly balls: readonly BallState[];
  readonly damage: readonly DamageEvent[];
  /** Shields that took a hit and broke (ADR 0043); the rest of each hit is in `damage`. */
  readonly blocked: readonly ShieldBrokenEvent[];
}

/** One ball's hit on another, before it is applied. `raw` is not yet clamped to the target's health. */
interface PendingHit {
  readonly target: BallState;
  readonly source: BallState;
  readonly raw: number;
  readonly multiplier: number;
}

/**
 * Applies contact damage for each new contact. Each ball's hit is scaled by how directly it was
 * moving at the other before the bounce. Within a pair both hits are worked out from health before the
 * exchange. If both hits would be lethal, the ball that dealt the larger raw damage survives on
 * 1 health; equal raw damage knocks both out (ADR 0002, lethal-exchange tiebreak).
 */
export function applyContactDamage(
  balls: readonly BallState[],
  newContacts: readonly PairContact[],
  definitions: DefinitionLookup,
  tick: number,
): DamageResult {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const damage: DamageEvent[] = [];
  const blocked: ShieldBrokenEvent[] = [];

  const pendingHit = (target: BallState, source: BallState, directness: number): PendingHit => {
    const definition = getDefinition(definitions, source.definitionId);
    const multiplier = directnessMultiplier(directness);
    return {
      target,
      source,
      raw: impactDamage(contactDamageOf(source, definition), multiplier),
      multiplier,
    };
  };

  const apply = (hit: PendingHit, survives: boolean): BallState => {
    const { target, source, raw, multiplier } = hit;
    // A survivor keeps 1 health (or less, if it somehow had less) instead of dropping to 0.
    const healthAfter = survives ? Math.min(target.health, 1) : Math.max(0, target.health - raw);
    const amount = target.health - healthAfter;
    // A survival is worth reporting even if no health was actually lost.
    if (amount <= 0 && !survives) return target;
    damage.push({
      type: 'damage',
      tick,
      targetId: target.id,
      sourceId: source.id,
      cause: 'contact',
      amount,
      healthAfter,
      multiplier,
      survivedLethal: survives,
    });
    return { ...target, health: healthAfter };
  };

  // A shield takes its hit first (ADR 0043): it soaks up to SHIELD_SOAK and breaks.
  const soak = (hit: PendingHit): PendingHit => {
    if (!isShielded(hit.target)) return hit;
    const soaked = soakHit(hit.target, hit.source.id, hit.raw, tick);
    blocked.push(soaked.event);
    return { ...hit, target: soaked.ball, raw: soaked.rest };
  };

  for (const { ballIds, directness, phased } of newContacts) {
    // Passing through a phased ball deals no contact damage either way (ADR 0026).
    if (phased) continue;
    const a = byId.get(ballIds[0]);
    const b = byId.get(ballIds[1]);
    if (a === undefined || b === undefined) continue;
    const toA = soak(pendingHit(a, b, directness[1]));
    const toB = soak(pendingHit(b, a, directness[0]));
    // A hit soaked whole deals nothing, so it is never lethal.
    const lethal = (hit: PendingHit) => hit.raw > 0 && hit.raw >= hit.target.health;
    const mutualLethal = isAlive(a) && isAlive(b) && lethal(toA) && lethal(toB);
    byId.set(a.id, apply(toA, mutualLethal && toB.raw > toA.raw));
    byId.set(b.id, apply(toB, mutualLethal && toA.raw > toB.raw));
  }

  return { balls: balls.map((ball) => byId.get(ball.id) ?? ball), damage, blocked };
}

/**
 * A ballDefeated event for every ball that was alive at the start of the tick and is not now.
 * The defeater is the source of the last damage event that hit it this tick.
 */
export function defeatsThisTick(
  before: readonly BallState[],
  after: readonly BallState[],
  events: readonly SimEvent[],
  tick: number,
): BallDefeatedEvent[] {
  const lastHitBy = new Map<string, string>();
  for (const event of events) {
    if (event.type === 'damage') lastHitBy.set(event.targetId, event.sourceId);
  }
  const afterById = new Map(after.map((ball) => [ball.id, ball]));
  const defeated: BallDefeatedEvent[] = [];
  for (const ball of before) {
    const now = afterById.get(ball.id);
    const defeatedById = lastHitBy.get(ball.id);
    if (now !== undefined && defeatedById !== undefined && isAlive(ball) && !isAlive(now)) {
      defeated.push({ type: 'ballDefeated', tick, ballId: ball.id, defeatedById });
    }
  }
  return defeated;
}
