import type { BallState, Vec2 } from '../../sim/types.ts';

/**
 * The canvas calls a ball design uses. A subset of CanvasRenderingContext2D, declared here so
 * design code and its tests don't depend on the DOM lib; a real 2D context satisfies it.
 */
export interface Painter {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: CanvasLineCapLike;
  lineJoin: CanvasLineJoinLike;
  globalAlpha: number;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number, ccw?: boolean): void;
  rect(x: number, y: number, width: number, height: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  setLineDash(segments: number[]): void;
}

type CanvasLineCapLike = 'butt' | 'round' | 'square';
type CanvasLineJoinLike = 'bevel' | 'miter' | 'round';

/** What a design needs to draw one ball. Plain data, read from the world; never written back. */
export interface DesignView {
  readonly ball: BallState;
  readonly radius: number;
  /** The ball's colour as drawn (already lighter for a mirror match's ball B). */
  readonly base: string;
  /** The ball's one accent colour, from the theme. */
  readonly accent: string;
  readonly tick: number;
  /** Unit vector the design faces, for designs that rotate; undefined if it has none. */
  readonly heading: Vec2 | undefined;
  /** Heal effect strength, 1 just healed down to 0. */
  readonly heal: number;
  /**
   * True when the ball is small on screen (see useSimpleDesign): drop fine detail and thicken the
   * main shape so it still reads at phone size.
   */
  readonly simple: boolean;
}

/**
 * How one kind of ball looks. `draw` paints the markings in a local frame: origin at the ball's
 * centre, +x along `heading` for rotating designs, y down. It must stay inside the ball.
 */
export interface BallDesign {
  readonly draw: (painter: Painter, view: DesignView) => void;
  /** Where `heading` comes from: none, the ball's velocity, or its aim at the nearest enemy. */
  readonly facing: 'none' | 'velocity' | 'aim';
  /**
   * How the ball's zones look when they strike: a lightning bolt (the default) or a clean
   * shockwave ring that sweeps out to the zone's edge.
   */
  readonly strike?: 'bolt' | 'shockwave';
}
