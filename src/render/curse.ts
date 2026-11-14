// The Hex's curse (ADR 0049) on the ball it marked: a hexagon badge on the ball's lower edge, clear
// of its health bar, and a ring that empties as the burst comes, flickering in its last stretch
// (steady with reduced motion). Reads sim state only.
import { CURSE_FUSE_TICKS, hexCurseOf } from '../sim/balls/hex.ts';
import { abilityTickOf } from '../sim/glitch.ts';
import type { WorldState } from '../sim/types.ts';
import { hexagonPath } from './ball-designs/hex.ts';
import { theme } from './theme.ts';

/** How much of the fuse is left on `tick`, from 1 (just laid) down to 0 (bursting). */
export function curseLeft(curse: { readonly burstTick: number }, tick: number): number {
  return Math.max(0, Math.min(1, (curse.burstTick - tick) / CURSE_FUSE_TICKS));
}

/** True when the curse is dimmed on this tick: the flicker of its last stretch. */
export function curseDimmed(left: number, tick: number, reducedMotion: boolean): boolean {
  if (reducedMotion || 1 - left < theme.curseFlickerFrom) return false;
  return Math.floor(tick / theme.curseFlickerTicks) % 2 === 1;
}

/** Every live Hex's curse, over the ball it marked. Drawn after the balls and their rings. */
export function drawCurses(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  reducedMotion: boolean,
): void {
  for (const owner of world.balls) {
    const curse = hexCurseOf(owner);
    if (curse === undefined || owner.health <= 0) continue;
    const target = world.balls.find((ball) => ball.id === curse.cursedId);
    if (target === undefined || target.health <= 0) continue;
    const left = curseLeft(curse, abilityTickOf(owner, world.tick));
    const { x, y } = target.position;
    const r = target.radius;
    ctx.save();
    ctx.globalAlpha = curseDimmed(left, world.tick, reducedMotion) ? theme.curseFlickerDim : 1;
    // The countdown: a ring that empties clockwise from the top.
    ctx.strokeStyle = theme.curseRune;
    ctx.lineWidth = theme.curseRingWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r + theme.curseRingGap, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    ctx.stroke();
    // The badge: dark, on the ball's lower edge, with the Hex's hexagon and a dot.
    const badge = theme.curseBadgeSize * r;
    ctx.fillStyle = theme.curseBadge;
    ctx.beginPath();
    ctx.arc(x, y + r, badge, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.curseRune;
    ctx.lineWidth = theme.markLine * r;
    ctx.lineJoin = 'round';
    hexagonPath(ctx, x, y + r, badge * 0.62);
    ctx.stroke();
    ctx.fillStyle = theme.curseRune;
    ctx.beginPath();
    ctx.arc(x, y + r, badge * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
