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
  /** Not used yet; reserved for health and damage. */
  readonly maxHealth: number;
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
}
