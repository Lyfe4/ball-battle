// A light trail behind each ball on slow frames (iPhone Low Power Mode holds Safari to 30 frames a
// second while the sim runs 60 ticks): at 30 a ball jumps about a quarter of its width between
// pictures, which the eye sees as stutter even when the frames are perfectly even, and a ball that
// jumps is harder to follow. A faint band over its path through the last two pictures fills the
// jumps in and leaves a line for the eye, as motion blur does for film. Trailing only, so nothing
// is drawn ahead of the sim. Pure and render-only (ADR 0007, 0063 addendum); drawn in draw-feel.ts.
import type { Vec2, WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** One ball's trail: where it was drawn, oldest first, ending where it is drawn now. */
export interface Smear {
  readonly ballId: string;
  readonly points: readonly Vec2[];
  readonly radius: number;
}

/**
 * The trails for a frame drawn `frameMs` of real time after the last. `history` is the worlds drawn
 * on the frames before this one (blended, as shown), oldest first. None on frames faster than
 * `theme.smearMinFrameMs` (60 Hz and faster look as they always did), under reduced motion, before
 * the first tick or after the match ends. A trail stops at a step where the ball stood still (a
 * hit-stop) or jumped (a rewind, a split, a new match).
 */
export function smearsOf(
  history: readonly WorldState[],
  drawn: WorldState,
  frameMs: number,
  reducedMotion: boolean,
): readonly Smear[] {
  if (reducedMotion || history.length === 0 || frameMs < theme.smearMinFrameMs) return [];
  if (drawn.match.status !== 'running' || drawn.tick <= 0) return [];
  const smears: Smear[] = [];
  for (const ball of drawn.balls) {
    if (ball.health <= 0) continue;
    const points: Vec2[] = [ball.position];
    // Back through the frames before, newest first, while each step is a real move.
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const from = history[index]?.balls.find((other) => other.id === ball.id)?.position;
      const to = points[0];
      if (from === undefined || to === undefined) break;
      const step = Math.hypot(to.x - from.x, to.y - from.y);
      if (step < theme.smearMinStep || step > ball.radius * theme.smearMaxStepRadii) break;
      points.unshift(from);
    }
    if (points.length > 1) smears.push({ ballId: ball.id, points, radius: ball.radius });
  }
  return smears;
}
