import type { AbilityLabel } from './ability-label.ts';
import type { MinionEvent, MinionRequest, MinionState } from './minions/types.ts';
import type { RewindRequest, RewoundEvent } from './abilities/rewind.ts';
import type { ReturnFlight } from './projectiles/returning.ts';
import type { SpawnRequest } from './projectiles/spawn.ts';
import type { HitReducedEvent } from './defence.ts';
import type { ZoneLinger, ZoneTriggerRequest } from './zones/spawn.ts';
import type {
  StatusAppliedEvent,
  StatusExpiredEvent,
  StatusKind,
  StatusRequest,
  StatusState,
} from './status.ts';

/** A 2D vector in world units. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** The square play area. Spans [0, size] on both axes. */
export interface Arena {
  readonly size: number;
}

/** Plain data that survives a JSON round trip unchanged. */
export type Serializable =
  | null
  | boolean
  | number
  | string
  | readonly Serializable[]
  | { readonly [key: string]: Serializable };

/**
 * Per-ball ability state: plain serialisable data, so WorldState stays plain data. Each ball
 * declares its own shape as a type alias, e.g. `type SpeedsterState = Readonly<{ stacks: number }>`.
 * An interface won't do: interfaces don't satisfy this index signature.
 */
export type AbilityState = Readonly<Record<string, Serializable>>;

/** The numbers every ball has. Hooks receive their own ball's stats. */
export interface BallStats {
  /** World units. */
  readonly radius: number;
  /** Launch speed in world units per second. */
  readonly speed: number;
  readonly maxHealth: number;
  /**
   * Base damage dealt to the other ball each time the two start touching, scaled by how hard this
   * ball hit (see DamageEvent.multiplier).
   */
  readonly contactDamage: number;
}

/**
 * What a kind of ball is: plain data plus optional ability hooks. One definition per file in
 * src/sim/balls/, created with defineBall so its hooks see its own typed ability state.
 * Definitions are static; per-match values live in BallState.
 */
export interface BallDefinition<S extends AbilityState = AbilityState> extends BallStats {
  readonly id: string;
  readonly name: string;
  /** One line for the ball picker. */
  readonly description: string;
  /** CSS colour used to draw the ball. Part of the ball's identity, not a theme token. */
  readonly color: string;
  /**
   * Its ability as a newcomer sees it (ADR 0036): a short name ("Lightning"), used for its hint and
   * for its damage in "How it was won", and the event that first shows it. Text only: it never
   * changes a fight. A ball with nothing to point at (the Brawler, a passive like growing) has none.
   */
  readonly ability?: AbilityLabel;
  readonly initialAbilityState: S;
  readonly hooks: BallHooks<S>;
  /**
   * How fast the ball travels in a given ability state, for an ability that changes its speed
   * (the Speedster's stacks). A pure query, not a hook. Every tick ends by rescaling each live
   * ball's velocity to this speed (ADR 0008). Defaults to `speed`.
   */
  readonly cruiseSpeed?: (state: S, stats: BallStats) => number;
  /**
   * Base contact damage in the ball's current state, for an ability that changes how hard it hits
   * (the Berserker's rage). A pure query, not a hook, read from the ball as it was before the
   * exchange; directness still scales it (ADR 0008, 0015). Defaults to `contactDamage`.
   */
  readonly contactDamageOf?: (self: BallView<S>, stats: BallStats) => number;
  /**
   * True while the ball is phased (ADR 0026): it passes through other balls, and contact damage
   * is dealt neither to it nor by it. Its own `onHitBall` still runs when it starts overlapping a
   * ball. A pure query of its own state, like `cruiseSpeed`. Defaults to never phased.
   */
  readonly phasedOf?: (self: BallView<S>) => boolean;
  /**
   * The ball's radius on a tick, for a ball whose size changes during a match (the Titan, ADR 0034).
   * A pure query, like `cruiseSpeed`. Applied at the end of every tick, with cruise speed, and the
   * ball is kept inside the arena. Its mass is r², so a bigger ball is heavier. Defaults to
   * `radius`, which is also its size when the match starts.
   */
  readonly radiusOf?: (self: BallView<S>, tick: number) => number;
  /**
   * Share of a status's duration this ball keeps, per kind (ADR 0016): 0.8 wears it off 20% sooner,
   * 0 makes the ball immune. Kinds not listed last their full duration. Plain data, read when the
   * status is applied, so it works the same for actions and zones.
   */
  readonly statusResistance?: Readonly<Partial<Record<StatusKind, number>>>;
  /**
   * What a hit of `amount` does to this ball on `tick`, from any source (ADR 0045): the Spartan's
   * planted shield takes half of every hit (ADR 0047), the Ghost's fade takes all of it. A pure query of its own
   * state, applied on both damage paths before the hit lands and rounded to a whole number between
   * 0 and `amount`. Defaults to the whole hit.
   */
  readonly incomingDamageOf?: (self: BallView<S>, amount: number, tick: number) => number;
}

/** A ball as its own hooks see it: its ability state has the definition's type. */
export type BallView<S extends AbilityState> = Omit<BallState, 'abilityState'> & {
  readonly abilityState: S;
};

export type HookName =
  'onTick' | 'onWallHit' | 'onHitBall' | 'onDamageDealt' | 'onDamageTaken' | 'onKnockedOut';

export type DamageCause = 'contact' | 'ability';

export type { AbilityLabel, AbilitySign } from './ability-label.ts';

/**
 * What delivered ability damage (output only; ADR 0036): a projectile, a zone's strike, a lasting
 * zone's pulse, a minion, poison, or the hook whose `damage` action dealt it. It never feeds back
 * into the sim; the arena reads it to show where damage came from.
 */
export type DamageVia = 'projectile' | 'zone' | 'zonePulse' | 'minion' | 'poison' | HookName;

/** Read-only inputs every hook receives. Hooks never mutate anything; they return actions. */
export interface HookContext<S extends AbilityState = AbilityState> {
  /** The world as it was at the start of this hook phase, with `tick` set to the current tick. */
  readonly world: WorldState;
  readonly self: BallView<S>;
  readonly stats: BallStats;
  /**
   * Deterministic random numbers in [0, 1), private to this hook call. Seeded from the world's RNG
   * state, the tick, the ball and the hook, so the same match always draws the same numbers and
   * one ball's draws never affect another's (ADR 0003). Never use Math.random.
   */
  readonly random: () => number;
  /**
   * True while `ball` is phased (ADR 0026, 0028): it can't be touched, gripped or aimed at. Read from
   * its definition's `phasedOf`, so a hook never needs the definitions itself.
   */
  readonly isPhased: (ball: BallState) => boolean;
}

export interface WallHitContext<S extends AbilityState = AbilityState> extends HookContext<S> {
  /** Walls hit this tick; a corner counts as 2. */
  readonly bounces: number;
}

export interface HitBallContext<S extends AbilityState = AbilityState> extends HookContext<S> {
  /** The ball this one just started touching. */
  readonly other: BallState;
}

export interface DamageDealtContext<S extends AbilityState = AbilityState> extends HookContext<S> {
  readonly target: BallState;
  /** Health actually removed. */
  readonly amount: number;
  readonly cause: DamageCause;
}

export interface DamageTakenContext<S extends AbilityState = AbilityState> extends HookContext<S> {
  /** The ball that dealt the damage. */
  readonly attacker: BallState;
  /** Health actually removed. */
  readonly amount: number;
  readonly cause: DamageCause;
}

/**
 * What a hook asks the simulation to do. Plain data; step() applies actions in the order they are
 * returned (ADR 0003). New kinds are added here and in apply-actions.ts without touching balls
 * that don't use them.
 */
export type AbilityAction<S extends AbilityState = AbilityState> =
  | { readonly kind: 'damage'; readonly targetId: string; readonly amount: number }
  | { readonly kind: 'heal'; readonly targetId: string; readonly amount: number }
  /**
   * Own ball only. Its direction lasts; its magnitude only until the end of the tick, when the
   * ball returns to its cruise speed (ADR 0008). Change speed through `cruiseSpeed` instead.
   */
  | { readonly kind: 'setVelocity'; readonly velocity: Vec2 }
  /**
   * Turns another ball's heading toward `toward` (a point) by `share` (0-1), keeping its speed
   * (ADR 0026): the Magnet's pull. Changes direction only; cruise speed still rules how fast.
   */
  | {
      readonly kind: 'steer';
      readonly targetId: string;
      readonly toward: Vec2;
      readonly share: number;
    }
  /** Own ball only; replaces the whole state. */
  | { readonly kind: 'setAbilityState'; readonly state: S }
  /**
   * Fires a projectile from just outside the hook owner's edge, in the direction of `velocity`
   * (world units per second). See ADR 0005. With `returnAfterTicks` it is a returning projectile
   * (ADR 0043): it turns back, homes on its owner and can hit each enemy once each way.
   */
  | ({ readonly kind: 'spawnProjectile' } & SpawnRequest)
  /**
   * Marks a circle that strikes once, `delayTicks` (a whole number, at least 1) from now, dealing
   * `damage` to every enemy ball inside it at that moment. The centre is clamped so the circle
   * fits in the arena. See ADR 0006.
   */
  | {
      readonly kind: 'spawnZone';
      readonly position: Vec2;
      readonly radius: number;
      readonly damage: number;
      readonly delayTicks: number;
      /** Applied to every ball the strike hits, after its damage (ADR 0009). */
      readonly status?: StatusRequest;
      /** Lasts after the first strike, pulsing on a fixed rhythm (ADR 0034). */
      readonly linger?: ZoneLinger;
      /** Strikes early when an enemy touches it, once armed (ADR 0043). */
      readonly trigger?: ZoneTriggerRequest;
    }
  /**
   * Summons a minion just outside the hook owner's edge, heading along `velocity`, unless the
   * owner already has `maxAlive` (ADR 0026).
   */
  | ({ readonly kind: 'spawnMinion' } & MinionRequest)
  /**
   * Puts a status on a ball for `durationTicks` (a whole number, at least 1). Re-applying a kind
   * the ball already has refreshes its expiry, never stacks (ADR 0009).
   */
  | {
      readonly kind: 'applyStatus';
      readonly targetId: string;
      readonly status: StatusKind;
      readonly durationTicks: number;
    }
  /**
   * Puts the hook owner back at an earlier position, velocity and health (the Chrono, ADR 0034).
   * The only action that acts on an owner at 0 health, from `onKnockedOut`.
   */
  | ({ readonly kind: 'rewind' } & RewindRequest);

export type Actions<S extends AbilityState = AbilityState> = readonly AbilityAction<S>[];

/**
 * Optional ability hooks. Each runs at a fixed point in the tick (see step.ts and ADR 0003) and
 * returns the actions to apply.
 */
export interface BallHooks<S extends AbilityState = AbilityState> {
  /** Every tick, before movement. */
  readonly onTick?: (context: HookContext<S>) => Actions<S>;
  /** After movement, if the ball bounced off at least one wall. */
  readonly onWallHit?: (context: WallHitContext<S>) => Actions<S>;
  /** After contact damage, when this ball started touching another. */
  readonly onHitBall?: (context: HitBallContext<S>) => Actions<S>;
  /** After damage resolves, once per damage instance this ball dealt. */
  readonly onDamageDealt?: (context: DamageDealtContext<S>) => Actions<S>;
  /**
   * After onDamageDealt, once per damage instance this ball took (ADR 0012). Damage its actions
   * deal never fires onDamageDealt or onDamageTaken again, so effects can't chain or loop.
   */
  readonly onDamageTaken?: (context: DamageTakenContext<S>) => Actions<S>;
  /**
   * After onDamageTaken, when damage this tick took the ball from alive to 0 health, before it is
   * defeated (ADR 0034). The one hook that runs for a ball at 0: a `rewind` it returns puts it back
   * in the match (apply it first: its other actions need it alive). Fires no other hooks.
   */
  readonly onKnockedOut?: (context: HookContext<S>) => Actions<S>;
}

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
