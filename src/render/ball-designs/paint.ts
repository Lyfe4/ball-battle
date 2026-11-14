// Painting a ball's design in its own frame: what the design is told (DesignView) and where it is
// drawn (centred on the ball, turned to its heading). Used for the markings inside the ball and for
// the few parts a design draws over the outline (`BallDesign.over`).
import { abilityTickOf } from '../../sim/glitch.ts';
import type { BallState, WorldState } from '../../sim/types.ts';
import { theme } from '../theme.ts';
import { aimHeading, useSimpleDesign, velocityHeading } from './state.ts';
import type { BallDesign, DesignView, Painter } from './types.ts';

/** What a design needs from the ball's look (a subset of draw.ts's BallLook). */
export interface ViewLook {
  readonly color: string;
  readonly heal: number;
  readonly cssPixelsPerUnit: number;
  readonly detail?: 'full' | 'simple';
}

/** Which way a design faces, in the world it is drawn in. */
function headingFor(design: BallDesign, ball: BallState, world: WorldState) {
  if (design.facing === 'velocity') return velocityHeading(ball.velocity);
  if (design.facing === 'aim') return aimHeading(ball, world.balls, world.minions);
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
    // Its ability's timers read on its ability clock, which stands still while it is glitched.
    tick: abilityTickOf(ball, world.tick),
    heading: headingFor(design, ball, world),
    heal: ball.health > 0 ? look.heal : 0,
    simple:
      look.detail === undefined
        ? useSimpleDesign(ball.radius * look.cssPixelsPerUnit)
        : look.detail === 'simple',
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
