// Painting a ball's design in its own frame: what the design is told (DesignView) and where it is
// drawn (centred on the ball, turned to its heading). Used for the markings inside the ball and for
// the few parts a design draws over the outline (`BallDesign.over`).
import type { BallState, Vec2, WorldState } from '../../sim/types.ts';
import { theme } from '../theme.ts';
import { aimHeading, useSimpleDesign, velocityHeading } from './state.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/** What a design needs from the ball's look (a subset of draw.ts's BallLook). */
export interface ViewLook {
  readonly color: string;
  readonly heal: number;
  /** A hit just glanced off its defence: 1 down to 0. */
  readonly glance?: number;
  readonly cssPixelsPerUnit: number;
  readonly detail?: 'full' | 'simple';
  /** How a floating ball drifts (drift.ts). */
  readonly drift?: Vec2;
  /** Reduced motion: a design's own wavering holds still. */
  readonly still?: boolean;
}

/** Which way a design faces, in the world it is drawn in. */
function headingFor(design: BallDesign, ball: BallState, world: WorldState) {
  if (design.facing === 'velocity') return velocityHeading(ball.velocity);
  if (design.facing === 'aim')
    return aimHeading(ball, world.balls, world.minions, world.arena.size);
  return undefined;
}

export function designView(
  design: BallDesign,
  ball: BallState,
  world: WorldState,
  look: ViewLook,
): DesignView {
  return {
    ball,
    radius: ball.radius,
    base: look.color,
    accent: theme.ballAccents[ball.definitionId] ?? theme.defaultAccent,
    tick: world.tick,
    heading: headingFor(design, ball, world),
    heal: ball.health > 0 ? look.heal : 0,
    simple:
      look.detail === undefined
        ? useSimpleDesign(ball.radius * look.cssPixelsPerUnit)
        : look.detail === 'simple',
    shotsOut: world.projectiles.filter((shot) => shot.ownerId === ball.id).length,
    minionsOut: world.minions.filter((minion) => minion.ownerId === ball.id).length,
    ...(look.drift === undefined ? {} : { drift: look.drift }),
    ...(look.still === true ? { still: true } : {}),
    ...(look.glance === undefined || ball.health <= 0 ? {} : { glance: look.glance }),
  };
}

/** Runs one of a design's painters with the origin at the ball's centre, +x along its heading. */
export function paintDesign(
  painter: Painter,
  view: DesignView,
  paint: (painter: Painter, view: DesignView) => void,
): void {
  const { heading } = view;
  painter.save();
  painter.translate(view.ball.position.x, view.ball.position.y);
  if (heading !== undefined) painter.rotate(Math.atan2(heading.y, heading.x));
  paint(painter, view);
  painter.restore();
}
