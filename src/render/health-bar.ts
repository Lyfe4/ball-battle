import type { BallState } from '../sim/types.ts';
import { theme } from './theme.ts';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where a ball's health bar goes, in world units: centred above the ball, or below it when the
 * ball is too close to the top wall for the bar to fit, and kept inside the arena horizontally.
 */
export function healthBarRect(ball: BallState, arenaSize: number): Rect {
  const width = Math.max(theme.healthBarMinWidth, ball.radius * 1.6);
  const height = theme.healthBarHeight;
  const above = ball.position.y - ball.radius - theme.healthBarGap - height;
  const y = above >= 0 ? above : ball.position.y + ball.radius + theme.healthBarGap;
  const x = Math.min(arenaSize - width, Math.max(0, ball.position.x - width / 2));
  return { x, y, width, height };
}

export function healthColor(fraction: number): string {
  if (fraction > 0.5) return theme.healthHigh;
  if (fraction > 0.25) return theme.healthMid;
  return theme.healthLow;
}
