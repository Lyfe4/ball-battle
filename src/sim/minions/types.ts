// Minions (ADR 0026): small summoned objects that move like balls (straight lines, the same wall
// bounces and seeded turn) but only meet walls and enemy balls. They pass through each other and
// their owner, pop on an enemy ball for ability damage, and are destroyed by enemy projectiles and
// zone strikes. Plain serialisable data, kept in WorldState like projectiles and zones.
import type { Vec2 } from '../types.ts';

export interface MinionState {
  /** "minion-<n>", from WorldState.nextMinionId. */
  readonly id: string;
  /** The ball that summoned it. It never touches its owner. */
  readonly ownerId: string;
  readonly position: Vec2;
  /** World units per second; its speed never changes, only its direction (at walls). */
  readonly velocity: Vec2;
  readonly radius: number;
  /** Ability damage dealt to the enemy ball it pops on. */
  readonly damage: number;
  /** Ticks until it crumbles, a safety net that keeps the count bounded. */
  readonly ticksLeft: number;
}

/** What a `spawnMinion` action asks for. */
export interface MinionRequest {
  readonly velocity: Vec2;
  readonly radius: number;
  readonly damage: number;
  readonly lifetimeTicks: number;
  /** The owner never has more than this many minions at once; a summon over the cap does nothing. */
  readonly maxAlive: number;
}

export interface MinionSpawnedEvent {
  readonly type: 'minionSpawned';
  readonly tick: number;
  readonly minionId: string;
  readonly ownerId: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
}

/** A minion reached an enemy ball and popped. Followed by that hit's damage event. */
export interface MinionHitEvent {
  readonly type: 'minionHit';
  readonly tick: number;
  readonly minionId: string;
  readonly ownerId: string;
  readonly targetId: string;
  /** Where the minion's centre was when it touched the ball. */
  readonly point: Vec2;
  /** Damage actually dealt. */
  readonly amount: number;
}

/**
 * A minion was destroyed without popping on a ball: an enemy projectile or zone strike got it, or
 * its lifetime ran out. `byId` is the ball whose projectile or zone destroyed it.
 */
export interface MinionDestroyedEvent {
  readonly type: 'minionDestroyed';
  readonly tick: number;
  readonly minionId: string;
  readonly ownerId: string;
  readonly position: Vec2;
  readonly reason: 'projectile' | 'zone' | 'lifetime';
  readonly byId?: string;
}

export type MinionEvent = MinionSpawnedEvent | MinionHitEvent | MinionDestroyedEvent;
