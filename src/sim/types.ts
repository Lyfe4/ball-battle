/** A 2D vector in world units. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** The square play area. Spans [0, size] on both axes. */
export interface Arena {
  readonly size: number;
}

/**
 * What a kind of ball is: plain data plus optional behaviour hooks. One definition per file in
 * src/sim/balls/. Definitions are static; per-match values live in BallState.
 */
export interface BallDefinition {
  readonly id: string;
  readonly name: string;
  /** CSS colour used to draw the ball. Part of the ball's identity, not a theme token. */
  readonly color: string;
  /** World units. */
  readonly radius: number;
  /** Launch speed in world units per second. */
  readonly speed: number;
  readonly maxHealth: number;
  /** Health removed from the other ball each time the two start touching. */
  readonly contactDamage: number;
  readonly hooks?: BallHooks;
}

/** Read-only view of the world handed to a hook. */
export interface HookContext {
  readonly world: WorldState;
  readonly self: BallState;
}

/**
 * A hook returns the ball's next state instead of mutating it, so step() stays pure. Hooks must
 * follow the same rules as the rest of src/sim: deterministic, randomness only via rng.ts.
 */
export type BallHook = (context: HookContext) => BallState;

/**
 * Optional ability hooks. The shape is in place so definitions can grow into it; the simulation
 * does not call any hooks yet.
 */
export interface BallHooks {
  readonly onTick?: BallHook;
  readonly onWallHit?: BallHook;
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
  /** Health actually removed (never more than the target had left). */
  readonly amount: number;
  readonly healthAfter: number;
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
 * replays, and never feed back into the simulation (ADR 0002). Within a tick they are ordered
 * collision, damage, ballDefeated, matchEnded.
 */
export type SimEvent = CollisionEvent | DamageEvent | BallDefeatedEvent | MatchEndedEvent;

export interface StepResult {
  readonly world: WorldState;
  readonly events: readonly SimEvent[];
}
