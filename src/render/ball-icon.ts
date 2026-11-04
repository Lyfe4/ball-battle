import type { BallDefinition } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { BALL_DESIGNS } from './ball-designs/index.ts';
import { ballColor } from './ball-colors.ts';
import { drawBall } from './draw.ts';
import { theme } from './theme.ts';

/** Space around the ball inside the icon, as a fraction of its radius. */
const PADDING = 0.12;

/**
 * Draws one ball, exactly as the game draws it, filling a square canvas `cssSize` CSS pixels wide
 * (for the picker). Designs that face somewhere face up and to the right. At picker sizes the
 * game's simplified small-size design is used, as on a phone arena.
 */
export function drawBallIcon(
  canvas: HTMLCanvasElement,
  definition: BallDefinition,
  cssSize: number,
  isRepeat = false,
): void {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, theme.maxPixelRatio);
  const pixels = Math.round(cssSize * pixelRatio);
  canvas.width = pixels;
  canvas.height = pixels;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  // A second ball far up and to the right gives aiming designs (the Archer) a direction; it is
  // never drawn.
  const world = createWorld(0, [definition, definition]);
  const [self, other] = world.balls;
  if (self === undefined || other === undefined) return;
  const ball = { ...self, position: { x: 0, y: 0 }, velocity: { x: 0.8, y: -0.6 } };
  const balls = [ball, { ...other, position: { x: 10_000, y: -7_500 } }];

  const radiusCss = cssSize / 2 / (1 + PADDING);
  const scale = (radiusCss / ball.radius) * pixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixels, pixels);
  ctx.setTransform(scale, 0, 0, scale, pixels / 2, pixels / 2);
  drawBall(ctx, { ...world, balls }, ball, {
    color: ballColor(definition.color, isRepeat),
    isRepeat,
    flash: 0,
    heal: 0,
    design: BALL_DESIGNS.get(definition.id),
    cssPixelsPerUnit: radiusCss / ball.radius,
  });
}
