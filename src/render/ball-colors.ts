import type { BallState, DefinitionLookup } from '../sim/types.ts';
import { theme } from './theme.ts';

/** Mixes a `#rrggbb` colour towards white by `amount` (0 = unchanged, 1 = white). */
export function lighten(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match?.[1] === undefined) return hex;
  const value = Number.parseInt(match[1], 16);
  const channel = (shift: number): string => {
    const original = (value >> shift) & 0xff;
    const mixed = Math.round(original + (255 - original) * amount);
    return mixed.toString(16).padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * True for a ball whose definition already appeared earlier in the match, e.g. ball B in a mirror
 * match. Such balls are drawn in a lighter shade with a ring so the two can be told apart.
 */
export function isRepeatOfEarlierBall(balls: readonly BallState[], index: number): boolean {
  const ball = balls[index];
  return (
    ball !== undefined &&
    balls.slice(0, index).some((other) => other.definitionId === ball.definitionId)
  );
}

/** The colour to draw a ball in: its definition's colour, lightened for a repeat. */
export function ballColor(baseColor: string, isRepeat: boolean): string {
  return isRepeat ? lighten(baseColor, theme.repeatLighten) : baseColor;
}

/**
 * The colour of the ball with `ballId`, as it is drawn (lighter for a repeat), for things it owns
 * such as projectiles and zones. Falls back to the theme's unknown colour so a bad id is visible.
 */
export function ownerColor(
  balls: readonly BallState[],
  definitions: DefinitionLookup,
  ballId: string,
): string {
  const index = balls.findIndex((ball) => ball.id === ballId);
  const owner = balls[index];
  const base = owner === undefined ? undefined : definitions.get(owner.definitionId)?.color;
  return ballColor(base ?? theme.unknownBall, isRepeatOfEarlierBall(balls, index));
}
