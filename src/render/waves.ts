// Poseidon's wave on the court (prototype): a band in its colour sweeping from one wall to the
// other, its crest a bright line at the front. Under the balls, like a zone. Reads sim state
// only, so it moves only as the sim's clock does.
import { WAVE_DEPTH, WAVE_TICKS, waveFront } from '../sim/balls/poseidon.ts';
import type { WorldState } from '../sim/types.ts';

/** How deep the band behind the crest is, in world units. */
const BAND = WAVE_DEPTH;
const WATER = '#3cc9a6';
const CREST = '#e6fffa';

/** Every live Poseidon's wave while it sweeps. Drawn under the balls. */
export function drawWaves(ctx: CanvasRenderingContext2D, world: WorldState): void {
  const size = world.arena.size;
  for (const ball of world.balls) {
    if (ball.health <= 0) continue;
    const { waveAt, dirX, dirY } = ball.abilityState;
    if (typeof waveAt !== 'number' || typeof dirX !== 'number' || typeof dirY !== 'number') {
      continue;
    }
    const since = world.tick - waveAt;
    if (since < 0 || since >= WAVE_TICKS) continue;
    const front = Math.min(size, waveFront(waveAt, world.tick, size));
    const back = Math.max(0, front - BAND);
    // Positions along the wave's axis, measured from its starting wall, as court coordinates.
    const at = (along: number): number => ((dirX || dirY) > 0 ? along : size - along);
    ctx.save();
    ctx.globalAlpha = 0.28 * (1 - since / WAVE_TICKS / 2);
    ctx.fillStyle = WATER;
    const a = at(back);
    const b = at(front);
    if (dirX !== 0) ctx.fillRect(Math.min(a, b), 0, Math.abs(b - a), size);
    else ctx.fillRect(0, Math.min(a, b), size, Math.abs(b - a));
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = CREST;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (dirX !== 0) {
      ctx.moveTo(b, 0);
      ctx.lineTo(b, size);
    } else {
      ctx.moveTo(0, b);
      ctx.lineTo(size, b);
    }
    ctx.stroke();
    ctx.restore();
  }
}
