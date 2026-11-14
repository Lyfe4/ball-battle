// The Spider's webs (ADR 0049): a fan of silk against the wall where it bounced, under the balls
// like a zone, fading out at the end of its life. Reads sim state only.
import { WEB_HALF_LENGTH, websOf } from '../sim/balls/spider.ts';
import { abilityTickOf } from '../sim/glitch.ts';
import type { WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** Where each wall's web is drawn from, and which way is into the court (+y after rotating). */
function frameOf(side: number, at: number, size: number) {
  if (side === 0) return { x: 0, y: at, angle: -Math.PI / 2 };
  if (side === 1) return { x: size, y: at, angle: Math.PI / 2 };
  if (side === 2) return { x: at, y: 0, angle: 0 };
  return { x: at, y: size, angle: Math.PI };
}

/** Every live Spider's webs, faint silk fans on the walls. Drawn under the balls. */
export function drawWebs(ctx: CanvasRenderingContext2D, world: WorldState): void {
  const size = world.arena.size;
  const depth = WEB_HALF_LENGTH * theme.webDepth;
  for (const ball of world.balls) {
    const webs = websOf(ball);
    if (webs === undefined || ball.health <= 0) continue;
    for (const web of webs) {
      const left = web.until - abilityTickOf(ball, world.tick);
      if (left <= 0) continue;
      const frame = frameOf(web.side, web.at, size);
      ctx.save();
      ctx.translate(frame.x, frame.y);
      ctx.rotate(frame.angle);
      ctx.globalAlpha = theme.webAlpha * Math.min(1, left / theme.webFadeTicks);
      ctx.strokeStyle = theme.web;
      ctx.lineWidth = theme.webWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Spokes from the middle of the strand on the wall, fanning into the court.
      for (let spoke = 0; spoke <= theme.webSpokes; spoke++) {
        const angle = (spoke / theme.webSpokes) * Math.PI;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * WEB_HALF_LENGTH, Math.sin(angle) * depth);
      }
      // Two rings of silk across the spokes.
      for (const share of [0.5, 0.95]) {
        for (let spoke = 0; spoke <= theme.webSpokes; spoke++) {
          const angle = (spoke / theme.webSpokes) * Math.PI;
          const x = Math.cos(angle) * WEB_HALF_LENGTH * share;
          const y = Math.sin(angle) * depth * share;
          if (spoke === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}
