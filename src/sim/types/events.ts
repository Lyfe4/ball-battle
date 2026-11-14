// What happened during one tick, as plain data (ADR 0002): every event `step` emits, and what it
// returns. Re-exported from ../types.ts, which every module imports.
import type { MinionEvent } from '../minions/types.ts';
import type { RewoundEvent } from '../abilities/rewind.ts';
import type { HitReducedEvent } from '../defence.ts';
import type { StatusAppliedEvent, StatusExpiredEvent } from '../status.ts';
import type { DamageCause, DamageVia, HookName, Vec2 } from '../types.ts';
import type { MatchEndReason, MatchResult, WorldState } from './world.ts';

/** Two balls started touching this tick. */
export interface CollisionEvent {
  readonly type: 'collision';
  readonly tick: number;
  readonly ballIds: readonly [string, string];
  /** Contact point on the line between the centres. */
  readonly point: Vec2;
  /** Unit vector from the first ball towards the second. */
  readonly normal: Vec2;
  /** Size of the impulse exchanged; 0 if the balls were already moving apart. */
  readonly impulse: number;
  /**
   * Present (and true) only when one ball was phased and they passed through each other
   * (ADR 0026), so the events of every other collision are unchanged.
   */
  readonly phased?: true;
}

export interface DamageEvent {
  readonly type: 'damage';
  readonly tick: number;
  readonly targetId: string;
  readonly sourceId: string;
  readonly cause: DamageCause;
  /** Health actually removed (never more than the target had left). */
  readonly amount: number;
  readonly healthAfter: number;
  /**
   * How directly the source hit, which the damage was scaled by: the cosine of its approach angle
   * before the bounce, clamped to [MIN_IMPACT_MULTIPLIER, 1] (ADR 0008). Always 1 for ability
   * damage.
   */
  readonly multiplier: number;
  /**
   * True when this hit would have been lethal but the target survived on 1 health because it dealt
   * the larger raw damage in a mutual lethal exchange (ADR 0002). `amount` and `healthAfter`
   * describe what actually happened.
   */
  readonly survivedLethal: boolean;
  /** Ability damage only: what delivered it (ADR 0036). */
  readonly via?: DamageVia;
}

export interface HealedEvent {
  readonly type: 'healed';
  readonly tick: number;
  readonly ballId: string;
  readonly sourceId: string;
  /** Health actually restored (never above maxHealth). */
  readonly amount: number;
  readonly healthAfter: number;
}

/** A hook returned at least one action. Comes just before that hook's other events. */
export interface AbilityTriggeredEvent {
  readonly type: 'abilityTriggered';
  readonly tick: number;
  readonly ballId: string;
  readonly hook: HookName;
}

export interface ProjectileFiredEvent {
  readonly type: 'projectileFired';
  readonly tick: number;
  readonly projectileId: string;
  readonly ownerId: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
}

/** Followed by the damage event for the same hit. */
export interface ProjectileHitEvent {
  readonly type: 'projectileHit';
  readonly tick: number;
  readonly projectileId: string;
  readonly ownerId: string;
  readonly targetId: string;
  /** Where the projectile's centre was when it touched the ball. */
  readonly point: Vec2;
  /** Damage actually dealt (never more than the target had left). */
  readonly amount: number;
}

export interface ProjectileExpiredEvent {
  readonly type: 'projectileExpired';
  readonly tick: number;
  readonly projectileId: string;
  readonly ownerId: string;
  /**
   * `minion`: it hit an enemy minion, which it destroyed (ADR 0026). `caught`: a returning
   * projectile came back to its owner (ADR 0043).
   */
  readonly reason: 'wall' | 'lifetime' | 'minion' | 'caught';
}

/** A zone appeared; it will strike on `strikeTick`. */
export interface ZoneSpawnedEvent {
  readonly type: 'zoneSpawned';
  readonly tick: number;
  readonly zoneId: string;
  readonly ownerId: string;
  /** After clamping into the arena. */
  readonly position: Vec2;
  readonly radius: number;
  readonly strikeTick: number;
}

/**
 * A zone struck and was removed. Followed by one damage event per ball hit, in `hitIds` order.
 * A miss has an empty `hitIds`; every zone ends with exactly one of these.
 */
export interface ZoneStruckEvent {
  readonly type: 'zoneStruck';
  readonly tick: number;
  readonly zoneId: string;
  readonly ownerId: string;
  readonly position: Vec2;
  readonly radius: number;
  /** Balls that took damage from this strike. */
  readonly hitIds: readonly string[];
  /** A lasting zone's pulse (ADR 0034): 0 for its first strike, then 1, 2, ... Absent otherwise. */
  readonly pulse?: number;
  /** Present when an enemy ball set it off before its time (ADR 0043): that ball. */
  readonly triggeredBy?: string;
}

export interface BallDefeatedEvent {
  readonly type: 'ballDefeated';
  readonly tick: number;
  readonly ballId: string;
  readonly defeatedById: string;
}

export interface MatchEndedEvent {
  readonly type: 'matchEnded';
  readonly tick: number;
  readonly result: MatchResult;
  readonly reason: MatchEndReason;
}

/**
 * What happened during one tick, as plain data. Output only: events are for rendering, sound and
 * replays, and never feed back into the simulation (ADR 0002). They come out in tick order (see
 * step.ts): onTick and onWallHit effects, collisions, contact damage, onHitBall effects, projectile
 * hits and expiries, zone strikes, onDamageDealt effects, defeats, match end.
 */
export type SimEvent =
  | CollisionEvent
  | DamageEvent
  | HealedEvent
  | AbilityTriggeredEvent
  | ProjectileFiredEvent
  | ProjectileHitEvent
  | ProjectileExpiredEvent
  | ZoneSpawnedEvent
  | ZoneStruckEvent
  | BallDefeatedEvent
  | MatchEndedEvent
  | StatusAppliedEvent
  | StatusExpiredEvent
  | RewoundEvent
  | HitReducedEvent
  | MinionEvent;

export interface StepResult {
  readonly world: WorldState;
  readonly events: readonly SimEvent[];
}
