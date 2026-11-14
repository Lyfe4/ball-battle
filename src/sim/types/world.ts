// What a running match is made of: its balls, projectiles, zones and the world that holds them,
// with the match's state and result. Plain serialisable data (ADR 0001, 0002). Re-exported from
// ../types.ts, which every module imports.
import type { MinionState } from '../minions/types.ts';
import type { ReturnFlight } from '../projectiles/returning.ts';
import type { StatusRequest, StatusState } from '../status.ts';
import type { AbilityState, Arena, BallDefinition, Vec2 } from '../types.ts';

/** One ball in a running match. Plain serialisable data; refers to its definition by id. */
export interface BallState {
  /** Unique within a world, e.g. "ball-0". */
  readonly id: string;
  readonly definitionId: string;
  readonly position: Vec2;
  /** World units per second. */
  readonly velocity: Vec2;
  readonly radius: number;
  /** Starts at the definition's maxHealth. At 0 the ball is defeated: it stops moving and colliding. */
  readonly health: number;
  /** Starts as the definition's initialAbilityState; changed only by its own hooks. */
  readonly abilityState: AbilityState;
  /** Status effects on this ball (ADR 0009): at most one per kind, created only by actions. */
  readonly statuses: readonly StatusState[];
}

/**
 * Something a ball fired, flying in a straight line until it hits an enemy ball, reaches a wall or
 * runs out of lifetime (ADR 0005). Plain serialisable data.
 */
export interface ProjectileState {
  /** "projectile-<n>", from WorldState.nextProjectileId. */
  readonly id: string;
  /** The ball that fired it. It never hits its owner. */
  readonly ownerId: string;
  readonly position: Vec2;
  /** World units per second. */
  readonly velocity: Vec2;
  readonly radius: number;
  /** Ability damage dealt to the ball it hits. */
  readonly damage: number;
  /** Ticks until it expires, a safety net that keeps the projectile count bounded. */
  readonly ticksLeft: number;
  /** Present for a returning projectile (ADR 0043): where it is in its flight out and back. */
  readonly returning?: ReturnFlight;
}

/**
 * A telegraphed strike: it does nothing until `strikeTick`, then damages every live enemy ball
 * overlapping it and is removed (ADR 0006). Plain serialisable data.
 */
export interface ZoneState {
  /** "zone-<n>", from WorldState.nextZoneId. */
  readonly id: string;
  /** The ball that spawned it. It never hits its owner. */
  readonly ownerId: string;
  /** Already clamped so the whole circle is inside the arena. */
  readonly position: Vec2;
  readonly radius: number;
  /** Ability damage dealt to each enemy ball inside it when it strikes. */
  readonly damage: number;
  /** The tick it appeared on, so the renderer can show how close the strike is. */
  readonly spawnTick: number;
  /** It strikes on exactly this tick, always later than spawnTick. */
  readonly strikeTick: number;
  /** Applied to every ball the strike hits, after its damage (ADR 0009). */
  readonly status?: StatusRequest;
  /**
   * A lasting zone (ADR 0034) stays until this tick, striking again every `pulseEveryTicks` after
   * `strikeTick` (on `endTick` too, if the rhythm lands on it). Absent: it strikes once.
   */
  readonly endTick?: number;
  readonly pulseEveryTicks?: number;
  /**
   * A zone that can be set off (ADR 0043): from `armTick` on, the first solid enemy ball to touch
   * the circle of `radius` at its centre makes it strike at once.
   */
  readonly trigger?: Readonly<{ radius: number; armTick: number }>;
}

/**
 * The complete state of a match at one tick. Together with the ball definitions, this fully
 * determines every future tick, including the random number stream.
 */
export interface WorldState {
  readonly tick: number;
  readonly arena: Arena;
  readonly balls: readonly BallState[];
  readonly rngState: number;
  /**
   * Pairs of balls touching at the end of this tick, as sorted "idA|idB" keys. A pair only deals
   * damage when it starts touching, so contact that lasts several ticks counts once (ADR 0002).
   */
  readonly contacts: readonly string[];
  readonly match: MatchState;
  /** Projectiles in flight, in the order they were fired. */
  readonly projectiles: readonly ProjectileState[];
  /** The number the next projectile id will use; only ever increases. */
  readonly nextProjectileId: number;
  /** Zones waiting to strike, in the order they were spawned. */
  readonly zones: readonly ZoneState[];
  /** The number the next zone id will use; only ever increases. */
  readonly nextZoneId: number;
  /** Minions in play, in the order they were summoned (ADR 0026). */
  readonly minions: readonly MinionState[];
  /** The number the next minion id will use; only ever increases. */
  readonly nextMinionId: number;
}

/**
 * Definitions by id, passed to step() every tick. Kept out of WorldState because definitions can
 * hold functions (hooks) and never change during a match; see ADR 0002.
 */
export type DefinitionLookup = ReadonlyMap<string, BallDefinition>;

export type MatchResult =
  { readonly kind: 'win'; readonly winnerId: string } | { readonly kind: 'draw' };

export type MatchEndReason = 'knockout' | 'timeLimit';

/** Once finished, step() returns the world unchanged and emits no events. */
export type MatchState =
  | { readonly status: 'running' }
  | {
      readonly status: 'finished';
      readonly result: MatchResult;
      readonly reason: MatchEndReason;
      readonly endTick: number;
    };
