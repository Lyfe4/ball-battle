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
  readonly initialAbilityState: S;
  readonly hooks: BallHooks<S>;
}

/** A ball as its own hooks see it: its ability state has the definition's type. */
export type BallView<S extends AbilityState> = Omit<BallState, 'abilityState'> & {
  readonly abilityState: S;
};

export type HookName = 'onTick' | 'onWallHit' | 'onHitBall' | 'onDamageDealt';

export type DamageCause = 'contact' | 'ability';

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

/**
 * What a hook asks the simulation to do. Plain data; step() applies actions in the order they are
 * returned (ADR 0003). New kinds are added here and in apply-actions.ts without touching balls
 * that don't use them.
 */
export type AbilityAction<S extends AbilityState = AbilityState> =
  | { readonly kind: 'damage'; readonly targetId: string; readonly amount: number }
  | { readonly kind: 'heal'; readonly targetId: string; readonly amount: number }
  /** Own ball only. */
  | { readonly kind: 'setVelocity'; readonly velocity: Vec2 }
  /** Own ball only. */
  | { readonly kind: 'scaleVelocity'; readonly factor: number }
  /** Own ball only; replaces the whole state. */
  | { readonly kind: 'setAbilityState'; readonly state: S };

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
   * Impact strength the damage was scaled by: the source's speed towards the target before the
   * bounce, over its definition speed, clamped to [MIN_IMPACT_MULTIPLIER, MAX_IMPACT_MULTIPLIER].
   * Always 1 for ability damage.
   */
  readonly multiplier: number;
  /**
   * True when this hit would have been lethal but the target survived on 1 health because it dealt
   * the larger raw damage in a mutual lethal exchange (ADR 0002). `amount` and `healthAfter`
   * describe what actually happened.
   */
  readonly survivedLethal: boolean;
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
 * step.ts): onTick and onWallHit effects, collisions, contact damage, onHitBall and onDamageDealt
 * effects, defeats, match end.
 */
export type SimEvent =
  | CollisionEvent
  | DamageEvent
  | HealedEvent
  | AbilityTriggeredEvent
  | BallDefeatedEvent
  | MatchEndedEvent;

export interface StepResult {
  readonly world: WorldState;
  readonly events: readonly SimEvent[];
}
