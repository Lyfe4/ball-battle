// The Scorpion's reach and stings on the court (prototype): a faint ring at the tail's reach, and
// for a moment after each sting a line from its edge to the point the tail struck. Reads sim
// state only.
import { JAB_TICKS, scorpionStateOf, STING_REACH } from '../sim/balls/scorpion.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { ownerColor } from './ball-colors.ts';

const RING_ALPHA = 0.18;
const JAB_WIDTH = 6;

export function drawStings(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  definitions: DefinitionLookup,
): void {
  if (world.match.status === 'finished') return;
  for (const ball of world.balls) {
    const state = scorpionStateOf(ball);
    if (state === undefined || ball.health <= 0) continue;
    const color = ownerColor(world.balls, definitions, ball.id);
    const { x, y } = ball.position;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = RING_ALPHA;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(x, y, ball.radius + STING_REACH, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const age = world.tick - state.stungTick;
    if (state.stungTick >= 0 && age < JAB_TICKS) {
      const dx = state.stungX - x;
      const dy = state.stungY - y;
      const length = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha = 1 - age / JAB_TICKS;
      ctx.lineWidth = JAB_WIDTH;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + (dx / length) * ball.radius, y + (dy / length) * ball.radius);
      ctx.lineTo(state.stungX, state.stungY);
      ctx.stroke();
    }
    ctx.restore();
  }
}
