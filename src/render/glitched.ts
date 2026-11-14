// A glitched ball (proposal): its ability is off, so its markings fade, bands of static run across
// it, and a broken ring outside it empties as the glitch wears off. The static jumps a few times a
// second (holds still with reduced motion). Reads sim state only.
import { GLITCH_TICKS } from '../sim/balls/glitch.ts';
import type { BallState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** A small whole-number hash, so the static is the same on every replay. Never Math.random. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** How much of the glitch is left on `tick`, from 1 (just glitched) to 0 (ability back). */
export function glitchLeft(ball: BallState, tick: number): number {
  const status = ball.statuses.find((candidate) => candidate.kind === 'glitched');
  if (status === undefined) return 0;
  return Math.max(0, Math.min(1, (status.expiresTick - tick) / GLITCH_TICKS));
}

/** Static and the broken ring over a glitched ball; `ringRadius` is where its ring goes. */
export function drawGlitched(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  tick: number,
  ringRadius: number,
  reducedMotion: boolean,
): void {
  const left = glitchLeft(ball, tick);
  if (left <= 0) return;
  const { x, y } = ball.position;
  const r = ball.radius;
  const frame = reducedMotion ? 0 : Math.floor(tick / theme.glitchFrameTicks);
  const seed = ball.id.length * 31 + ball.id.charCodeAt(ball.id.length - 1);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const band = theme.glitchBand * r;
  const block = theme.glitchBlock * r;
  for (let index = 0; index < theme.glitchBands; index++) {
    const h = hash(seed + index, frame);
    const top = y - r + ((h % 1000) / 1000) * (2 * r - band);
    const offset = ((h >>> 10) % 100) / 100;
    for (let column = -1; column * block < 2 * r; column++) {
      const shade = hash(h, column) % 3;
      if (shade === 0) continue;
      ctx.fillStyle = shade === 1 ? theme.glitchDark : theme.glitchLight;
      ctx.fillRect(x - r + (column + offset) * block, top, block, band);
    }
  }
  ctx.restore();
  // The broken ring, emptying clockwise from the top as its ability comes back.
  ctx.save();
  ctx.strokeStyle = theme.glitchLight;
  ctx.lineWidth = theme.glitchRingWidth;
  ctx.setLineDash([...theme.glitchRingDash]);
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
