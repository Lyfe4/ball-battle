// A smear behind each ball on slow frames (iPhone Low Power Mode holds Safari to 30 frames a
// second while the sim runs 60 ticks): at 30 a ball jumps about a quarter of its width between
// pictures, which the eye sees as stutter even when the frames are perfectly even. A faint smear
// over the stretch of path between the last picture and this one fills that in, as motion blur does
// for film. Trailing only, so nothing is drawn ahead of the sim. Pure and render-only (ADR 0007,
// 0063 addendum); drawn in draw-feel.ts.
import type { Vec2, WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** One ball's smear: from where its edge was drawn last frame to where it is drawn now. */
export interface Smear {
  readonly ballId: string;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly radius: number;
}

/**
 * The smears for a frame drawn `frameMs` of real time after `before` (the world drawn last frame,
 * blended as it was shown). None on frames faster than `theme.smearMinFrameMs` (60 Hz and faster
 * look as they always did), under reduced motion, before the first tick, after the match ends, for
 * a ball that stood still (a hit-stop) or jumped (a rewind, a split, a new match).
 */
export function smearsOf(
  before: WorldState | undefined,
  drawn: WorldState,
  frameMs: number,
  reducedMotion: boolean,
): readonly Smear[] {
  if (reducedMotion || before === undefined || frameMs < theme.smearMinFrameMs) return [];
  if (drawn.match.status !== 'running' || drawn.tick <= 0) return [];
  const was = new Map(before.balls.map((ball) => [ball.id, ball.position]));
  const smears: Smear[] = [];
  for (const ball of drawn.balls) {
    const from = was.get(ball.id);
    if (from === undefined || ball.health <= 0) continue;
    const step = Math.hypot(ball.position.x - from.x, ball.position.y - from.y);
    if (step < theme.smearMinStep || step > ball.radius * theme.smearMaxStepRadii) continue;
    smears.push({ ballId: ball.id, from, to: ball.position, radius: ball.radius });
  }
  return smears;
}
