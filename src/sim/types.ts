import type { AbilityLabel } from './ability-label.ts';
import type { MinionRequest } from './minions/types.ts';
import type { RewindRequest } from './abilities/rewind.ts';
import type { SpawnRequest } from './projectiles/spawn.ts';
import type { ZoneLinger, ZoneTriggerRequest } from './zones/spawn.ts';
import type { StatusKind, StatusRequest } from './status.ts';
import type { BallState, WorldState } from './types/world.ts';

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
  /**
   * The real rules and numbers of its ability, a few short sentences for the manual's "How it
   * works" (ADR 0049). Built from the constants the ability itself uses, so it never goes stale.
   * Text only: it never changes a fight. A ball without it shows no such section.
   */
  readonly howItWorks?: readonly string[];
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
   * True while the ball is phased (ADR 0026, 0049): nothing touches it. It passes through other
   * balls, shots, skulls and bombs, and contact damage is dealt neither to it nor by it. Its own
   * `onHitBall` still runs when it starts overlapping a ball. A pure query of its own state, like
   * `cruiseSpeed`. Defaults to never phased.
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
   * planted shield takes half of every hit (ADR 0047), the phased Ghost all of it (ADR 0049). A pure
   * query of its own state, applied on both damage paths before the hit lands and rounded to a whole number between
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
   * True while `ball` is phased (ADR 0026, 0049): nothing touches it. Read from its definition's
   * `phasedOf`, so a hook never needs the definitions itself.
   */
  readonly isPhased: (ball: BallState) => boolean;
  /**
   * A ball's full health, read from its definition (ADR 0049: the Hex's curse bursts for a share of
   * it), so a hook never needs the definitions itself.
   */
  readonly maxHealthOf: (ball: BallState) => number;
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

// The world a match is made of, and the events a tick emits, live in their own files; every module
// still imports them from here.
export type * from './types/world.ts';
export type * from './types/events.ts';
